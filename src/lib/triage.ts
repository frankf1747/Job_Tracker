/**
 * Queue triage — what a captured job deserves.
 *
 * Scoring itself happens in a Claude Code session against the frank-resume
 * skill; nothing here calls a model. These are the pure functions that turn a
 * stored result into an order and a set of labels, which is the only part of
 * triage worth unit-testing.
 *
 * The rubric, and the reasoning behind the weights, is in
 * docs/superpowers/specs/2026-09-17-queue-triage-design.md.
 */

export type Decision = 'tailor' | 'general' | 'skip' | 'blocked';
export type HrVerdict = 'pass' | 'drag' | 'fail';
export type Gate = 'years' | 'system' | 'salary' | 'clearance' | 'authorization';
export type ResumeTarget = 'operations' | 'data' | 'insights';

/** What the queue page renders as a section. */
export type Band = 'tailor' | 'general' | 'unscored' | 'skip' | 'blocked';

/**
 * The fields banding depends on. Deliberately narrower than QueuedJob so this
 * module stays independent of the data layer that imports its types.
 */
export type Triaged = {
  fitScore: number | null;
  decision: Decision | null;
  gate: Gate | null;
  /** Null means never scored, which is a state of its own — not a zero. */
  scoredAt: number | null;
  capturedAt: number;
};

/** Top to bottom on the page: most actionable first, disqualified last. */
export const BANDS: readonly Band[] = ['tailor', 'general', 'unscored', 'skip', 'blocked'];

/** Bands kept behind a count, because nothing in them needs a decision. */
export const COLLAPSED: readonly Band[] = ['skip', 'blocked'];

export function bandOf(job: Triaged): Band {
  if (job.scoredAt == null) return 'unscored';
  // A gate outranks the score. A job can be an excellent fit and still be
  // unreachable, and the row has to lead with that rather than with a number.
  if (job.gate != null || job.decision === 'blocked') return 'blocked';
  return job.decision ?? 'unscored';
}

/** Band order, then score descending, then the more recent capture. */
export function sortQueue<T extends Triaged>(jobs: readonly T[]): T[] {
  return [...jobs].sort((a, b) => {
    const band = BANDS.indexOf(bandOf(a)) - BANDS.indexOf(bandOf(b));
    if (band !== 0) return band;
    const score = (b.fitScore ?? 0) - (a.fitScore ?? 0);
    if (score !== 0) return score;
    return b.capturedAt - a.capturedAt;
  });
}

/** Every band, empty ones included, so a count can render without a guard. */
export function groupQueue<T extends Triaged>(jobs: readonly T[]): Record<Band, T[]> {
  const out = Object.fromEntries(BANDS.map((b) => [b, [] as T[]])) as Record<Band, T[]>;
  for (const job of sortQueue(jobs)) out[bandOf(job)].push(job);
  return out;
}

const GATE_LABELS: Record<Gate, string> = {
  years: 'Years floor, no equivalency clause',
  system: 'Requires a system never used',
  salary: 'Band well above range',
  clearance: 'Citizenship or clearance required',
  authorization: 'Will not sponsor',
};

export function gateLabel(gate: Gate): string {
  return GATE_LABELS[gate];
}

const TARGET_LABELS: Record<ResumeTarget, string> = {
  operations: 'Operations',
  data: 'Data',
  insights: 'Commercial & Insights',
};

export function targetLabel(target: ResumeTarget): string {
  return TARGET_LABELS[target];
}

const BAND_LABELS: Record<Band, string> = {
  tailor: 'Worth tailoring',
  general: 'General resume',
  unscored: 'Not yet scored',
  skip: 'Skip',
  blocked: 'Blocked',
};

export function bandLabel(band: Band): string {
  return BAND_LABELS[band];
}

/** The three dimensions, with the ceiling each is scored against. */
export const DIMENSIONS = [
  { key: 'fitProblem', label: 'Problem', max: 45 },
  { key: 'fitSkills', label: 'Skills', max: 30 },
  { key: 'fitExperience', label: 'Experience', max: 25 },
] as const;
