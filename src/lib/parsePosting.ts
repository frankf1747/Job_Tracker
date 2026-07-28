/**
 * Extracting structured fields from a pasted job posting.
 *
 * This is the swap seam for the planned Claude-backed parser: the signature is
 * already async, so replacing the regex body with a `fetch('/api/parse-posting')`
 * call is a change confined to this file. Callers never learn which one ran.
 *
 * The guiding rule is that a wrong guess is worse than no guess: everything here
 * is shown in the review modal before it is saved, but a confident-looking wrong
 * value gets accepted, whereas a blank one gets filled in.
 */

import { DEFAULT_EMPLOYMENT_TYPE, INDUSTRIES, RESUMES, SKILL_POOL } from './schema';
import type { Application, Status } from './schema';
import { isoOf } from './derive';

/** A parsed posting, pre-filled into the review modal for the user to correct. */
export type Draft = {
  company: string;
  position: string;
  location: string;
  skills: string[];
  industry: string;
  level: string;
  employmentType: string;
  salary: string;
  sourceUrl: string;
  status: Status;
  appliedDate: string;
  /** Which resume version was sent. Not inferable from the posting — the user picks. */
  resume: string;
  /** In-progress text in the "add a skill" input. */
  draft: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (s: string) => new RegExp('\\b' + escapeRe(s) + '\\b', 'i');
const clean = (s: string) =>
  s
    .trim()
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,;:]$/, '');

/** How far into the posting the company name can plausibly appear. */
const HEAD_LINES = 5;

/**
 * Company names recognised verbatim. Only consulted near the top of a posting —
 * several of these are also tools that appear in requirements lists.
 */
const KNOWN_COMPANIES = [
  'Stripe',
  'Datadog',
  'Snowflake',
  'Databricks',
  'Atlassian',
  'Notion',
  'Figma',
  'Rippling',
  'Ramp',
  'Plaid',
  'Robinhood',
  'Coinbase',
  'Airbnb',
  'DoorDash',
  'Instacart',
  'Nvidia',
  'AMD',
  'Palantir',
  'Samsara',
  'Verkada',
  'Gusto',
  'Brex',
  'Vanta',
  'Amplitude',
  'Confluent',
  'Twilio',
  'Okta',
  'CrowdStrike',
  'ServiceNow',
  'Cloudflare',
  'MongoDB',
  'GitLab',
  'Asana',
  'Sprinklr',
  'Zendesk',
  'Proofpoint',
  'HCA Healthcare',
  'Quest Diagnostics',
  'eClinicalWorks',
  'Viatris',
  'QuidelOrtho',
  'Otsuka',
  'Bio-Techne',
  'Soleno Therapeutics',
  'Zoox',
  'Lam Research',
  'Synaptics',
  'Ayar Labs',
  'Impinj',
  'King',
  'Vizient',
  'Milliman',
  'Circana',
  'Cribl',
  'NetApp',
  'Shopify',
  'Wealthsimple',
  'Faire',
  'Cohere',
  'Clio',
  '1Password',
  'Ada',
];

const ROLE_RE =
  /(intern|internship|new grad|new-grad|graduate|engineer|analyst|manager|scientist|associate|developer|coordinator|specialist|designer|architect)/i;

/** Job-board furniture that is never the company or the position. */
const BOILERPLATE =
  /^(save|saved|apply|easy apply|about the job|about us|about the role|job purpose|job description|promoted|posted|reposted|show more|see more|did you finish|responses managed|people you can reach|hiring|be an early applicant|no longer accepting|full[-\s]?time|part[-\s]?time|contract|temporary|internship|on-?site|remote|hybrid|entry level|mid-senior|associate level|\d+ (applicant|people)|you applied for this job|view application|view all|locations?|time type|job requisition id|option to work remote)/i;

/** A line that is only a place, e.g. "Toronto, ON · 6 days ago". */
const LOCATION_LINE = /^[A-Za-z.\-' ]{2,30},\s*[A-Z]{2}\b/;

/** A Workday location code that is a line to itself, e.g. "US-DE-Wilmington". */
const LOCATION_CODE = /^[A-Za-z]{2,}-[A-Za-z]{2,}-[A-Za-z]/;

const INDUSTRY_TESTS: [RegExp, string][] = [
  [/healthcare|clinic|patient|hospital|pharma/i, 'Healthcare'],
  [/biotech|therapeut|genom|molecul|clinical trial/i, 'Biotech / Pharma'],
  [/bank|payment|fintech|trading|lending|financ/i, 'Fintech'],
  [/retail|commerce|marketplace|shopping/i, 'E-commerce / Retail'],
  // Unilever-style CPG: no "retail" anywhere, but unmistakable supply-chain language.
  [
    /consumer goods|\bcpg\b|\bfmcg\b|supply chain|replenishment|on-?shelf|grocer|packaged goods/i,
    'Consumer Goods',
  ],
  [/semiconductor|hardware|chip|silicon|device|robot/i, 'Hardware / Semiconductors'],
  [/game|gaming|media|entertainment|studio/i, 'Media / Gaming'],
  [/consult|advisory/i, 'Consulting'],
  [/analytics|data platform|business intelligence/i, 'Data / Analytics'],
];

/**
 * One money amount: "$48", "$120,000", "$95k".
 *
 * The `k` suffix has to live inside this piece rather than in a separate
 * alternative pattern — the prototype tried the plain form first and let `||`
 * short-circuit, so "$95k" came back as "$95".
 */
const AMOUNT = String.raw`\$\s?\d{2,3}(?:,\d{3})?(?:\s?[kK])?`;

/** An amount, optionally a range, optionally a rate suffix. */
const SALARY_RE = new RegExp(
  `${AMOUNT}(?:\\s?[-–—]\\s?\\$?\\s?\\d{2,3}(?:,\\d{3})?(?:\\s?[kK])?)?(?:\\s?/?\\s?(?:hr|hour|yr|year))?`,
  'i',
);

type MdLink = { label: string; url: string };

/**
 * Flatten `[label](url)` to `label`, keeping the pairs.
 *
 * Pasting from LinkedIn yields markdown, and the raw form breaks line-based
 * heuristics badly: a tracking URL can push a two-word job title past any
 * sane length limit.
 */
export function stripMarkdownLinks(raw: string): { text: string; links: MdLink[] } {
  const links: MdLink[] = [];
  const text = raw.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label: string, url: string) => {
      const l = label.trim();
      if (l) links.push({ label: l, url });
      return l;
    },
  );
  return { text, links };
}

export function guessIndustry(text: string): string {
  for (const [re, ind] of INDUSTRY_TESTS) {
    if (re.test(text)) return ind;
  }
  return INDUSTRIES[0];
}

export function guessLevel(text: string): string {
  if (/\b(new[-\s]?grad|university grad|recent grad)\b/i.test(text)) return 'New Grad';
  // Both sides need a boundary. Without the trailing one, "intern" matched
  // "internal stakeholders" and filed full-time roles as internships.
  if (/\b(intern|interns|internship|internships)\b/i.test(text)) return 'Intern';
  if (/\b(senior|sr\.?)\b/i.test(text)) return 'Senior';
  if (/\bassociate\b/i.test(text)) return 'Associate';
  return 'Entry-level';
}

export function guessEmploymentType(text: string, level: string): string {
  if (/\bpart[-\s]?time\b/i.test(text)) return 'Part-time';
  if (/\b(contract|contractor|contract-to-hire)\b/i.test(text)) return 'Contract';
  if (/\b(temporary|temp|seasonal)\b/i.test(text)) return 'Temporary';
  if (/\b(internship|internships|co-?op)\b/i.test(text) || level === 'Intern') return 'Internship';
  return DEFAULT_EMPLOYMENT_TYPE;
}

function looksLikeRole(line: string) {
  return ROLE_RE.test(line);
}

function looksLikeLocation(line: string) {
  return LOCATION_LINE.test(line) || LOCATION_CODE.test(line) || /\bremote\b/i.test(line);
}

/** A line that is only the logo's alt text, carrying no company name. */
const LOGO_ONLY = /^(?:company\s+)?logo$/i;
/** "Company logo for, Acme" — the name is glued onto the alt text. */
const LOGO_FOR = /^(?:company\s+)?logo\s+for[,:]?\s*/i;
/** "Acme logo" — the name comes first. */
const LOGO_SUFFIX = /\s+logo$/i;

/**
 * Remove the logo alt text LinkedIn pastes above every company name.
 *
 * Copying a posting brings the image's alt text along as a line of its own,
 * in several shapes: sometimes it is only "Company logo", sometimes the name is
 * glued to it as "Company logo for, Acme". Returns the bare name, or an empty
 * string when the line was nothing but alt text and the real name follows.
 */
export function stripLogoNoise(line: string): string {
  const t = line.trim();
  if (LOGO_ONLY.test(t)) return '';
  if (LOGO_FOR.test(t)) return t.replace(LOGO_FOR, '').trim();
  if (LOGO_SUFFIX.test(t)) return t.replace(LOGO_SUFFIX, '').trim();
  return t;
}

export function guessCompany(lines: string[], text: string): string {
  // An explicit label always wins.
  const labelled = text.match(/^\s*company\s*[:-]\s*(.{2,40})$/im);
  if (labelled) return clean(labelled[1]);

  // A name we recognise, but only near the top. Scanning the whole document is
  // what made "proficiency in Power BI, Databricks" outrank the real employer.
  // Sliced wide then trimmed back, so dropping pure alt-text lines doesn't
  // shorten how far into the posting we actually look.
  const head = lines
    .slice(0, HEAD_LINES + 2)
    .map(stripLogoNoise)
    .filter(Boolean)
    .slice(0, HEAD_LINES);
  const known = KNOWN_COMPANIES.find((n) => head.some((l) => wordRe(n).test(l)));
  if (known) return known;

  // Otherwise the first line up top that reads like a name rather than a title,
  // a place, or job-board furniture.
  for (const l of head) {
    if (looksLikeRole(l) || looksLikeLocation(l) || BOILERPLATE.test(l)) continue;
    if (l.length < 2 || l.length > 40) continue;
    return clean(l);
  }

  // "... Intern at Hooli Systems", or a description that opens "At Agilent, we
  // ...". Either case of the anchor, but the captured name stays capitalised, so
  // "at the forefront" cannot pass as a company. Spaces rather than \s, so it
  // stops at a sentence break or a line end instead of swallowing the next line.
  const at = text.match(/\b[Aa]t[ \t]+([A-Z][A-Za-z0-9&'-]*(?:[ \t]+[A-Z][A-Za-z0-9&'-]*){0,3})/);
  if (at) return clean(at[1]);

  // Deliberately no document-wide fallback: an editable placeholder beats
  // confidently naming a tool from the requirements list.
  return '';
}

export function guessPosition(lines: string[], text: string): string {
  const line = lines.find((l) => looksLikeRole(l) && l.length <= 72 && !BOILERPLATE.test(l));
  if (line) return clean(line);

  // Anchored to a whole line. Unanchored, this matched "a critical role in
  // driving collaborative planning…" and used that as the job title.
  const labelled = text.match(/^\s*(?:position|role|job title|title)\s*[:-]\s*(.{3,72})$/im);
  if (labelled) return clean(labelled[1]);

  return '';
}

/** Prefer a link to the posting itself over a company page or a search result. */
function scoreUrl(url: string): number {
  let score = 0;
  if (
    /\/jobs?\/view\/|\/job\/|\/careers?\/|greenhouse\.io|lever\.co|myworkdayjobs|ashbyhq|smartrecruiters/i.test(
      url,
    )
  ) {
    score += 3;
  }
  if (/\/company\/|\/search|search-results|\/safety\/go|\/preload\/|\/jobs-tracker/i.test(url)) {
    score -= 3;
  }
  return score;
}

export function pickSourceUrl(links: MdLink[], position: string, text: string): string {
  // The link wrapping the job title is the posting, by construction.
  const onTitle = links.find((l) => l.label === position);
  if (onTitle) return onTitle.url;

  const bare = text.match(/https?:\/\/[^\s)"']+/g) ?? [];
  const all = [...links.map((l) => l.url), ...bare];
  if (!all.length) return '';

  return all.reduce((best, u) => (scoreUrl(u) > scoreUrl(best) ? u : best));
}

/** Whether a paste is substantial enough to be worth parsing at all. */
export function looksLikePosting(text: string): boolean {
  const clean = text.trim();
  return clean.length >= 45 && clean.split(/\s+/).length >= 8;
}

/**
 * Regex extraction. Deliberately permissive: anything it gets wrong is visible
 * and editable in the review modal before the row is saved.
 */
export function parsePostingLocal(raw: string, today: Date): Draft {
  const { text, links } = stripMarkdownLinks(raw);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const low = text.toLowerCase();

  const company = guessCompany(lines, text);
  const position = guessPosition(lines, text);

  let location = '';
  // A line that is *only* "City, ST" is the strongest signal.
  for (const l of lines) {
    const mm = l.match(/^([A-Za-z.\-' ]{2,30},\s*[A-Z]{2})\b/);
    if (mm) {
      location = mm[1].trim();
      break;
    }
  }
  if (!location) {
    const m = text.match(/\b([A-Z][a-z.\-']+(?:[ \t][A-Z][a-z.\-']+){0,2},[ \t]*[A-Z]{2})\b/);
    if (m) location = m[1];
  }
  if (!location && /\bremote\b/i.test(text)) location = 'Remote';
  if (!location) {
    const l = text.match(/location[:\s]+([^\n]{2,30})/i);
    if (l) location = l[1].trim();
  }
  // Postings often run company and location together: "Stripe San Francisco, CA".
  if (location && company && location.indexOf(company) === 0) {
    location = location.slice(company.length).trim();
  }

  const skills = SKILL_POOL.filter((s) =>
    new RegExp('(^|[^a-zA-Z])' + escapeRe(s.toLowerCase()) + '([^a-zA-Z]|$)', 'i').test(low),
  ).slice(0, 7);

  let salary = '';
  const sm = text.match(SALARY_RE);
  if (sm) salary = sm[0].replace(/\s+/g, ' ').trim();

  const level = guessLevel(text);

  return {
    company: company || 'Company (edit me)',
    position: position || 'Role (edit me)',
    location,
    skills,
    industry: guessIndustry(low),
    level,
    employmentType: guessEmploymentType(text, level),
    salary,
    sourceUrl: pickSourceUrl(links, position, text),
    status: 'Submitted',
    appliedDate: isoOf(today),
    resume: RESUMES[0],
    draft: '',
  };
}

/**
 * Parse a pasted posting into a draft row.
 *
 * Async by design — see the module comment.
 */
export async function parsePosting(text: string, today: Date): Promise<Draft> {
  return parsePostingLocal(text, today);
}

/**
 * Turn an existing application back into an editable draft, so the same review
 * modal that adds a row can also edit one. The inverse of how addToTracker
 * reads a draft; the id and derived fields (loc, appliedTs) are left to the
 * caller, which already has the row.
 */
export function draftFromApplication(app: Application): Draft {
  return {
    company: app.company,
    position: app.position,
    location: app.location,
    skills: app.skills.slice(),
    industry: app.industry,
    level: app.level,
    employmentType: app.employmentType,
    salary: app.salary,
    sourceUrl: app.sourceUrl,
    status: app.status,
    appliedDate: app.applied,
    resume: app.resume,
    draft: '',
  };
}
