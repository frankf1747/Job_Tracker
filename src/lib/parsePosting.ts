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

import { parseLocation } from './places';
import { DEFAULT_EMPLOYMENT_TYPE, INDUSTRIES } from './schema';
import { extractSkills } from './skills';
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
  /** The posting's text, kept with the application. */
  description: string;
  /** The queue's triage verdict when promoted from it; '' otherwise. */
  fitReason: string;
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
  /\b(intern|internship|new[- ]grad|graduate|engineer|analyst|manager|scientist|associate|developer|coordinator|specialist|designer|architect|builder|consultant|strategist|advisor|director|officer|administrator|researcher|generalist|producer|planner|technician|lead)\b/i;

/** Job-board furniture that is never the company or the position. */
const BOILERPLATE =
  /^(save|saved|apply|easy apply|about the job|about us|about the role|job purpose|job description|promoted|posted|reposted|show more|see more|did you finish|responses managed|people you can reach|hiring|be an early applicant|no longer accepting|full[-\s]?time|part[-\s]?time|contract|temporary|internship|on-?site|remote|hybrid|entry level|mid-senior|associate level|\d+ (applicant|people)|you applied for this job|view application|view all|locations?|time type|job requisition id|option to work remote|see all|back to search|job id|improve my match|low match|high match|strengthen your resume|\d+ out of \d+ keywords|this job is (available|associated)|additional info|key competencies|key responsibilities|what you.{0,4}ll (do|bring)|who we are|required tool)/i;

/**
 * "Title - Company", the shape a corporate ATS puts at the top of its page.
 *
 * On those pages the employer often appears nowhere else as a line of its own,
 * so without this the company falls through to whatever furniture comes next —
 * a job id, in the posting that prompted this.
 *
 * A spaced hyphen or pipe only. An em dash is how titles qualify themselves
 * ("Data Analytics Intern — Summer 2026") and splitting there would name the
 * season as the employer.
 */
const TITLE_COMPANY = /^(.{4,70}?)\s+[-|]\s+([^\s-][^|]{1,38})$/;

/** A country or work mode the title is qualified by, not part of the role. */
const TITLE_TAIL =
  /,\s*(?:United States|USA?|Canada|United Kingdom|UK|EMEA|APAC|Remote|Hybrid|On-?site)\s*$/i;

/** The title and employer out of one line, when it carries both. */
export function splitTitleCompany(line: string): { position: string; company: string } | null {
  const m = TITLE_COMPANY.exec(line.trim());
  if (!m) return null;
  const position = clean(m[1]).replace(TITLE_TAIL, '').trim();
  const company = clean(m[2]);
  // The tail has to be a name. "Analyst - Remote" and "Analyst - Full-time"
  // are a location and a job type wearing the same punctuation.
  if (!/[A-Za-z]/.test(company)) return null;
  if (BOILERPLATE.test(company) || looksLikeLocation(company) || looksLikeRole(company))
    return null;
  if (!looksLikeRole(position)) return null;
  return { position, company };
}

/** A line that is only a place, e.g. "Toronto, ON · 6 days ago". */
const LOCATION_LINE = /^[A-Za-z.\-' ]{2,30},\s*[A-Z]{2}\b/;

/** A Workday location code that is a line to itself, e.g. "US-DE-Wilmington". */
const LOCATION_CODE = /^[A-Za-z]{2,}-[A-Za-z]{2,}-[A-Za-z]/;

/**
 * Vocabulary for each industry, whole words only. "financ" as a bare prefix
 * matched "financial wellness" in every benefits section, and "chip" matched
 * "chipping in".
 */
const INDUSTRY_TERMS: [RegExp, string][] = [
  [
    /\b(health\s?care|clinics?|clinical|patients?|hospitals?|pharma\w*|biotech\w*|therapeutics?|genomic\w*|life sciences|medical|medicines?|biologics?|diagnostics?)\b/gi,
    'Bio / Healthcare',
  ],
  [
    /\b(fintech|banks?|banking|payments?|lending|lenders?|trading|brokerage|credit cards?|financial services|wealth management|asset management)\b/gi,
    'Fintech',
  ],
  [
    /\b(retail(?:er|ers)?|e-?commerce|marketplaces?|shoppers?|stores?|merchandis\w*|apparel|fashion)\b/gi,
    'E-commerce / Retail',
  ],
  [
    /\b(consumer goods|cpg|fmcg|consumer products?|packaged goods|grocer\w*|beverages?|household brands?|cpfr|replenishment|on-?shelf)\b/gi,
    'Consumer Goods',
  ],
  [
    /\b(semiconductors?|hardware|chips?|silicon|wafers?|devices?|robots?|robotics|electronics|equipment)\b/gi,
    'Hardware / Semiconductors',
  ],
  [
    /\b(games?|gaming|gamers?|media|entertainment|studios?|streaming|players)\b/gi,
    'Media / Gaming',
  ],
  [/\b(consulting|consultancy|consultants?|advisory)\b/gi, 'Consulting'],
  [
    /\b(analytics platform|data platform|data cloud|business intelligence platform)\b/gi,
    'Data / Analytics',
  ],
];

/**
 * Lines about pay, benefits and the law. They are the same at every employer,
 * name every industry's words ("health insurance", "financial wellness"), and
 * say nothing about what this one does.
 */
const BOILERPLATE_LINE =
  /\b(insurance|401\s?\(?k\)?|benefits?|equal (?:employment )?opportunit\w*|eeo|disabilit\w*|veterans?|paid time off|pto|wellness|dental|vision|parental|accommodation|background check|e-verify|salary|compensation|pay range|bonus|equity)\b/i;

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

/**
 * The industry whose vocabulary the posting uses most.
 *
 * Boilerplate lines are skipped, and the opening of the posting counts double,
 * since that is where a company says what it does. A single passing word is
 * not enough to leave the default.
 */
export function guessIndustry(text: string): string {
  const lines = text.split('\n').filter((l) => !BOILERPLATE_LINE.test(l));
  const body = lines.join('\n');
  const opening = body.slice(0, Math.max(600, Math.floor(body.length / 4)));
  let best: string = INDUSTRIES[0];
  let top = 1;
  for (const [re, industry] of INDUSTRY_TERMS) {
    const n = (body.match(re)?.length ?? 0) + (opening.match(re)?.length ?? 0);
    if (n > top) [best, top] = [industry, n];
  }
  return best;
}

const NEW_GRAD =
  /\b(new[-\s]?grads?|university grad(?:uate)?s?|recent grad(?:uate)?s?|college grad(?:uate)?s?)\b/i;
const INTERN = /\b(intern|interns|internship|internships|co-?op)\b/i;

/**
 * Level, decided by the job title first.
 *
 * The title is the one place a posting states the level of this role. The body
 * mentions levels constantly about other people — "reports to a Senior
 * Manager", "internship experience counts", "work with senior leaders" — and
 * reading those filed a fifth of all postings at the wrong level. So the body
 * is consulted only when the title says nothing, and only for phrasing that
 * describes the role itself.
 */
export function guessLevel(title: string, body = ''): string {
  if (NEW_GRAD.test(title)) return 'New Grad';
  // Whole words only: "intern" must not match "internal" or "international".
  if (INTERN.test(title)) return 'Intern';
  if (/\b(senior|sr\.?)\b/i.test(title)) return 'Senior';
  if (/\b(associate|assoc\.?)\b/i.test(title)) return 'Associate';

  if (NEW_GRAD.test(body)) return 'New Grad';
  if (
    /\b(?:this|our|the)\s+(?:summer\s+|fall\s+|spring\s+)?(?:\d{4}\s+)?internship\b|\binternship\s+(?:program|position|role|opportunity)\b|\b(?:summer|fall|spring)\s+20\d\d\s+intern(?:ship)?\b/i.test(
      body,
    )
  ) {
    return 'Intern';
  }
  return 'Entry-level';
}

/** "Employment type: Full-time", "Time Type: Part time", "Status: Full-Time". */
const TYPE_LABEL = /\b(?:employment|job|time|worker|position)\s+type|\bstatus\b|\bschedule\b/i;
const TYPE_VALUE: [RegExp, string][] = [
  [/\bfull[-\s]?time\b/i, 'Full-time'],
  [/\bpart[-\s]?time\b/i, 'Part-time'],
  [/\b(contract|contractor|fixed[-\s]term)\b/i, 'Contract'],
  [/\b(temporary|temp|seasonal)\b/i, 'Temporary'],
  [/\b(intern|internship|co-?op)\b/i, 'Internship'],
];
const typeIn = (s: string) => TYPE_VALUE.find(([re]) => re.test(s))?.[1] ?? null;

/**
 * Employment type: a labelled field, then the title, then only phrasing that
 * describes this role.
 *
 * Bodies list every type in their boilerplate — "benefits for full-time and
 * part-time employees", "contract manufacturing partners", "seasonal
 * forecasts" — so a bare mention anywhere is not evidence.
 */
export function guessEmploymentType(title: string, body: string, level: string): string {
  for (const line of body.split('\n')) {
    // A short labelled line, or LinkedIn's "Full-time · On-site" insight row.
    const m = /^\s*([^:]{2,30}):\s*(.{2,40})$/.exec(line);
    if (m && TYPE_LABEL.test(m[1])) {
      const t = typeIn(m[2]);
      if (t) return t;
    }
    const row = /^\s*(full[-\s]?time|part[-\s]?time|contract|temporary|internship)\s*(?:·|$)/i.exec(
      line,
    );
    if (row) return typeIn(row[1])!;
  }

  // An intern title is left to the end: "part-time internship" is part-time.
  const fromTitle = typeIn(title);
  if (fromTitle && fromTitle !== 'Full-time' && fromTitle !== 'Internship') return fromTitle;

  if (
    /\b(?:is|be)\s+an?\s+part[-\s]?time\b|\bpart[-\s]?time\s+(?:position|role|job|internship|opportunity)\b/i.test(
      body,
    )
  )
    return 'Part-time';
  if (
    /\bcontract[-\s]to[-\s]hire\b|\b\d+[-\s]?(?:month|mo)\s+contract\b|\b(?:is|be)\s+an?\s+contract\b|\bcontract\s+(?:position|role|assignment)\b/i.test(
      body,
    )
  )
    return 'Contract';
  if (
    /\b(?:is|be)\s+an?\s+(?:temporary|seasonal)\b|\b(?:temporary|seasonal)\s+(?:position|role|assignment)\b/i.test(
      body,
    )
  )
    return 'Temporary';
  if (level === 'Intern' || fromTitle === 'Internship') return 'Internship';
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

  // A title line that carries the employer after a dash.
  for (const l of head) {
    const split = splitTitleCompany(l);
    if (split) return split.company;
  }

  // Otherwise the first line up top that reads like a name rather than a title,
  // a place, or job-board furniture.
  for (const l of head) {
    if (looksLikeRole(l) || looksLikeLocation(l) || BOILERPLATE.test(l)) continue;
    if (l.length < 2 || l.length > 40) continue;
    // A requisition number is not a name.
    if (!/[A-Za-z]/.test(l)) continue;
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
  if (line) {
    const split = splitTitleCompany(line);
    return split ? split.position : clean(line).replace(TITLE_TAIL, '').trim();
  }

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
export function parsePostingLocal(
  raw: string,
  today: Date,
  /** What is already known from elsewhere, e.g. a title the extension captured. */
  known: { position?: string } = {},
): Draft {
  const { text, links } = stripMarkdownLinks(raw);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const company = guessCompany(lines, text);
  const position = guessPosition(lines, text);

  let location = parseLocation(text);
  // Postings often run company and location together: "Stripe San Francisco, CA".
  if (location && company && location.indexOf(company) === 0) {
    location = location.slice(company.length).trim();
  }

  const skills = extractSkills(text, 7, company);

  let salary = '';
  const sm = text.match(SALARY_RE);
  if (sm) salary = sm[0].replace(/\s+/g, ' ').trim();

  // A title captured from the page beats one guessed from the pasted lines.
  const title = known.position || position;
  const level = guessLevel(title, text);

  return {
    company: company || 'Company (edit me)',
    position: position || 'Role (edit me)',
    location,
    skills,
    industry: guessIndustry(text),
    level,
    employmentType: guessEmploymentType(title, text, level),
    salary,
    sourceUrl: pickSourceUrl(links, position, text),
    status: 'Submitted',
    appliedDate: isoOf(today),
    // No resume by default: picking one is a deliberate act, so a fresh paste
    // shouldn't silently attach whichever resume happens to be first.
    resume: '',
    draft: '',
    // The text as pasted, minus markdown link syntax: LinkedIn's clipboard
    // wraps every link in tracking URLs hundreds of characters long.
    description: text.trim(),
    fitReason: '',
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
/**
 * An empty draft, for a position whose posting is no longer to hand.
 *
 * Company and position start empty rather than as "(edit me)" placeholders,
 * so there is nothing to delete before typing. The review form will not save
 * while either is empty, which is what makes leaving them blank safe.
 */
export function blankDraft(today: Date): Draft {
  return {
    company: '',
    position: '',
    location: '',
    skills: [],
    industry: INDUSTRIES[0],
    level: guessLevel(''),
    employmentType: DEFAULT_EMPLOYMENT_TYPE,
    salary: '',
    sourceUrl: '',
    status: 'Submitted',
    appliedDate: isoOf(today),
    resume: '',
    draft: '',
    description: '',
    fitReason: '',
  };
}

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
    description: app.description,
    fitReason: app.fitReason,
  };
}
