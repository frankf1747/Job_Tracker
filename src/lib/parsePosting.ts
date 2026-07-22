/**
 * Extracting structured fields from a pasted job posting.
 *
 * This is the swap seam for the planned Claude-backed parser: the signature is
 * already async, so replacing the regex body with a `fetch('/api/parse-posting')`
 * call is a change confined to this file. Callers never learn which one ran.
 */

import { INDUSTRIES, SKILL_POOL } from './schema';
import type { Status } from './schema';
import { isoOf } from './derive';

/** A parsed posting, pre-filled into the review modal for the user to correct. */
export type Draft = {
  company: string;
  position: string;
  location: string;
  skills: string[];
  industry: string;
  level: string;
  salary: string;
  sourceUrl: string;
  status: Status;
  appliedDate: string;
  /** In-progress text in the "add a skill" input. */
  draft: string;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Company names the parser recognises verbatim, before falling back to patterns. */
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

const INDUSTRY_TESTS: [RegExp, string][] = [
  [/healthcare|clinic|patient|hospital|pharma/i, 'Healthcare'],
  [/biotech|therapeut|genom|molecul|clinical trial/i, 'Biotech / Pharma'],
  [/bank|payment|fintech|trading|lending|financ/i, 'Fintech'],
  [/retail|commerce|marketplace|shopping|consumer goods/i, 'E-commerce / Retail'],
  [/semiconductor|hardware|chip|silicon|device|robot/i, 'Hardware / Semiconductors'],
  [/game|gaming|media|entertainment|studio/i, 'Media / Gaming'],
  [/consult|advisory/i, 'Consulting'],
  [/analytics|data platform|business intelligence/i, 'Data / Analytics'],
];

export function guessIndustry(text: string): string {
  for (const [re, ind] of INDUSTRY_TESTS) {
    if (re.test(text)) return ind;
  }
  return INDUSTRIES[0];
}

export function guessLevel(text: string): string {
  if (/new grad|new-grad|university grad|recent grad/i.test(text)) return 'New Grad';
  if (/\bintern|internship\b/i.test(text)) return 'Intern';
  if (/\bsenior|sr\.?\b/i.test(text)) return 'Senior';
  if (/\bassociate\b/i.test(text)) return 'Associate';
  return 'Entry-level';
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
export function parsePostingLocal(text: string, today: Date): Draft {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const low = text.toLowerCase();

  let company = '';
  const known = KNOWN_COMPANIES.find((n) =>
    new RegExp('\\b' + escapeRe(n) + '\\b', 'i').test(text),
  );
  if (known) company = known;
  if (!company) {
    const m = text.match(/\bat\s+([A-Z][A-Za-z0-9&.\-' ]{2,28})/);
    if (m) company = m[1].trim().replace(/[.,]$/, '');
  }
  if (!company) {
    const m = text.match(/company[:\s]+([A-Za-z0-9&.\-' ]{2,28})/i);
    if (m) company = m[1].trim();
  }

  let position = '';
  const roleRe =
    /(intern|internship|new grad|new-grad|graduate|engineer|analyst|manager|scientist|associate|developer|coordinator|specialist)/i;
  const pline = lines.find((l) => roleRe.test(l) && l.length <= 72);
  if (pline) position = pline.replace(/\s{2,}/g, ' ').trim();
  if (!position) {
    const m = text.match(/(position|role|job title|title)[:\s]+([^\n]{3,72})/i);
    if (m) position = m[2].trim();
  }

  let location = '';
  // A line that is *only* "City, ST" is the strongest signal.
  for (const l of lines) {
    const mm = l.trim().match(/^([A-Za-z.\-' ]{2,30},\s*[A-Z]{2})$/);
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

  let sourceUrl = '';
  const um = text.match(/https?:\/\/[^\s)"']+/);
  if (um) sourceUrl = um[0];

  return {
    company: company || 'Company (edit me)',
    position: position || 'Role (edit me)',
    location,
    skills,
    industry: guessIndustry(low),
    level: guessLevel(text),
    salary,
    sourceUrl,
    status: 'Submitted',
    appliedDate: isoOf(today),
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
