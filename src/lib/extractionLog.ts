/**
 * The extraction log: what the parser proposed for a posting, and what was
 * actually saved.
 *
 * Every review that starts from a posting (a queued capture or a paste) is a
 * labelled example. The parser fills the form and the person fixes what is
 * wrong, so the saved row is the right answer to the parser's guess. Logging
 * both is what lets the rules be improved later from real misses rather than
 * from whichever posting happened to be noticed. Edits made after saving are
 * logged too: a wrong location fixed a week later is a miss the modal never saw.
 *
 * Pure: building the entry is here, writing it is in data/extractionLog.ts.
 */

import type { Draft } from './parsePosting';

/**
 * Bumped whenever the extraction rules change, so the report can tell a miss
 * the current parser makes from one an older version made.
 */
export const PARSER_VERSION = '2026-11-11';

/** The fields the parser or the capture fills in. */
export const EXTRACTED_FIELDS = [
  'company',
  'position',
  'location',
  'skills',
  'industry',
  'level',
  'employmentType',
  'salary',
] as const;
export type ExtractedField = (typeof EXTRACTED_FIELDS)[number];

export type Extracted = { [K in ExtractedField]: Draft[K] };

/**
 * How the review began. A queued job was captured by the extension, a paste
 * went through the parser, and an edit reopened a saved application.
 */
export type Origin = 'queue' | 'paste' | 'edit';

/** Who filled a field: the extension reading the page, or the text parser. */
export type FieldSource = 'capture' | 'parser';

/** What was proposed when the review opened, kept until it saves. */
export type Proposal = {
  origin: Origin;
  proposed: Extracted;
  /** Only for queued jobs, where some fields come from the capture. */
  sources?: Partial<Record<ExtractedField, FieldSource>>;
};

export type LogEntry = {
  origin: Origin;
  proposed: Extracted;
  saved: Extracted;
  /** The fields that differ, so the report need not recompute them. */
  changed: ExtractedField[];
  sources: Partial<Record<ExtractedField, FieldSource>>;
  /** The posting's host, e.g. "boards.greenhouse.io", which is where rules break. */
  site: string;
  parserVersion: string;
};

export function extracted(d: Extracted): Extracted {
  return {
    company: d.company,
    position: d.position,
    location: d.location,
    skills: d.skills.slice(),
    industry: d.industry,
    level: d.level,
    employmentType: d.employmentType,
    salary: d.salary,
  };
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * Whether a field was changed. Whitespace is not a change, and nor is
 * reordering skills: the question is whether the parser was right.
 */
export function fieldChanged(field: ExtractedField, a: Extracted, b: Extracted): boolean {
  if (field === 'skills') {
    const x = new Set(a.skills.map((s) => s.toLowerCase()));
    const y = new Set(b.skills.map((s) => s.toLowerCase()));
    return x.size !== y.size || [...x].some((s) => !y.has(s));
  }
  return norm(a[field]) !== norm(b[field]);
}

/** The host of a URL without "www.", or '' when it is not one. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * The entry to log for a save, or null when there is nothing to learn.
 *
 * A review from a posting is always logged, unchanged fields included: those
 * are what turn a list of misses into an accuracy rate. An edit is logged only
 * when it changed an extracted field, since reopening a row to change its
 * resume says nothing about the parser.
 */
export function buildLogEntry(proposal: Proposal, saved: Draft): LogEntry | null {
  const final = extracted(saved);
  const changed = EXTRACTED_FIELDS.filter((f) => fieldChanged(f, proposal.proposed, final));
  if (proposal.origin === 'edit' && changed.length === 0) return null;
  return {
    origin: proposal.origin,
    proposed: proposal.proposed,
    saved: final,
    changed,
    sources: proposal.sources ?? {},
    site: siteOf(saved.sourceUrl),
    parserVersion: PARSER_VERSION,
  };
}
