/**
 * Deterministic fake applications, for developing against a populated UI.
 *
 * Ported from the prototype's `makeRows`. This is a development aid only —
 * nothing here is ever written to the database. The real app starts empty.
 */

import { normalizeLoc } from '../lib/locations';
import type { Application, Status } from '../lib/schema';
import { DAY, reachedFor } from '../lib/schema';
import { isoOf } from '../lib/derive';

type Company = { n: string; ind: string; c: string | null };
type Position = { t: string; f: keyof typeof FAM_SKILLS };

const COMPANIES: Company[] = [
  { n: 'Stripe', ind: 'Fintech', c: 'San Francisco, CA' },
  { n: 'Datadog', ind: 'Technology / SaaS', c: 'New York, NY' },
  { n: 'Snowflake', ind: 'Data / Analytics', c: 'Mountain View, CA' },
  { n: 'Databricks', ind: 'Data / Analytics', c: 'San Francisco, CA' },
  { n: 'Atlassian', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Notion', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Figma', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Rippling', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Ramp', ind: 'Fintech', c: 'New York, NY' },
  { n: 'Plaid', ind: 'Fintech', c: 'San Francisco, CA' },
  { n: 'Robinhood', ind: 'Fintech', c: 'Palo Alto, CA' },
  { n: 'Coinbase', ind: 'Fintech', c: null },
  { n: 'Airbnb', ind: 'E-commerce / Retail', c: 'San Francisco, CA' },
  { n: 'DoorDash', ind: 'E-commerce / Retail', c: 'San Francisco, CA' },
  { n: 'Instacart', ind: 'E-commerce / Retail', c: 'San Francisco, CA' },
  { n: 'Nvidia', ind: 'Hardware / Semiconductors', c: 'San Jose, CA' },
  { n: 'AMD', ind: 'Hardware / Semiconductors', c: 'Austin, TX' },
  { n: 'Palantir', ind: 'Data / Analytics', c: 'Denver, CO' },
  { n: 'Samsara', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Verkada', ind: 'Technology / SaaS', c: 'Palo Alto, CA' },
  { n: 'Gusto', ind: 'Fintech', c: 'Denver, CO' },
  { n: 'Brex', ind: 'Fintech', c: 'San Francisco, CA' },
  { n: 'Vanta', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Amplitude', ind: 'Data / Analytics', c: 'San Francisco, CA' },
  { n: 'Confluent', ind: 'Technology / SaaS', c: 'Mountain View, CA' },
  { n: 'Twilio', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Okta', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'CrowdStrike', ind: 'Technology / SaaS', c: 'Austin, TX' },
  { n: 'ServiceNow', ind: 'Technology / SaaS', c: 'San Jose, CA' },
  { n: 'Cloudflare', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'MongoDB', ind: 'Technology / SaaS', c: 'New York, NY' },
  { n: 'GitLab', ind: 'Technology / SaaS', c: null },
  { n: 'Asana', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Sprinklr', ind: 'Technology / SaaS', c: 'New York, NY' },
  { n: 'Zendesk', ind: 'Technology / SaaS', c: 'San Francisco, CA' },
  { n: 'Proofpoint', ind: 'Technology / SaaS', c: 'San Jose, CA' },
  { n: 'HCA Healthcare', ind: 'Healthcare', c: 'Nashville, TN' },
  { n: 'Quest Diagnostics', ind: 'Healthcare', c: null },
  { n: 'eClinicalWorks', ind: 'Healthcare', c: null },
  { n: 'Viatris', ind: 'Healthcare', c: null },
  { n: 'QuidelOrtho', ind: 'Healthcare', c: 'San Diego, CA' },
  { n: 'Otsuka', ind: 'Biotech / Pharma', c: null },
  { n: 'Bio-Techne', ind: 'Biotech / Pharma', c: 'Minneapolis, MN' },
  { n: 'Soleno Therapeutics', ind: 'Biotech / Pharma', c: 'Redwood City, CA' },
  { n: 'Zoox', ind: 'Hardware / Semiconductors', c: 'Redwood City, CA' },
  { n: 'Lam Research', ind: 'Hardware / Semiconductors', c: null },
  { n: 'Synaptics', ind: 'Hardware / Semiconductors', c: 'San Jose, CA' },
  { n: 'Ayar Labs', ind: 'Hardware / Semiconductors', c: 'San Jose, CA' },
  { n: 'Impinj', ind: 'Hardware / Semiconductors', c: 'Seattle, WA' },
  { n: 'King', ind: 'Media / Gaming', c: null },
  { n: 'Vizient', ind: 'Consulting', c: 'Irving, TX' },
  { n: 'Milliman', ind: 'Consulting', c: null },
  { n: 'Circana', ind: 'Data / Analytics', c: 'Chicago, IL' },
  { n: 'Cribl', ind: 'Data / Analytics', c: null },
  { n: 'NetApp', ind: 'Hardware / Semiconductors', c: null },
  { n: 'Shopify', ind: 'E-commerce / Retail', c: 'Ottawa, ON' },
  { n: 'Wealthsimple', ind: 'Fintech', c: 'Toronto, ON' },
  { n: 'Faire', ind: 'E-commerce / Retail', c: 'Waterloo, ON' },
  { n: 'Cohere', ind: 'Data / Analytics', c: 'Toronto, ON' },
  { n: 'Clio', ind: 'Technology / SaaS', c: 'Vancouver, BC' },
  { n: '1Password', ind: 'Technology / SaaS', c: 'Toronto, ON' },
  { n: 'Ada', ind: 'Technology / SaaS', c: 'Toronto, ON' },
];

const FAM_SKILLS = {
  analytics: [
    'SQL',
    'Python',
    'Excel',
    'Tableau',
    'Power BI',
    'Statistics',
    'A/B Testing',
    'Data Visualization',
    'Looker',
  ],
  datasci: [
    'Python',
    'Machine Learning',
    'Statistics',
    'SQL',
    'Pandas',
    'R',
    'Experimentation',
    'Data Visualization',
  ],
  dataeng: ['SQL', 'Python', 'Spark', 'Airflow', 'dbt', 'Snowflake', 'ETL', 'Git'],
  product: [
    'Product Sense',
    'Roadmapping',
    'SQL',
    'Stakeholder Mgmt',
    'Agile',
    'User Research',
    'Figma',
  ],
  ops: [
    'Excel',
    'SQL',
    'Process Improvement',
    'Stakeholder Mgmt',
    'Project Mgmt',
    'Communication',
    'Tableau',
  ],
  strategy: [
    'Excel',
    'Market Research',
    'Financial Modeling',
    'Communication',
    'SQL',
    'Storytelling',
  ],
  finance: ['Excel', 'Financial Modeling', 'SQL', 'Forecasting', 'Accounting', 'Power BI'],
  swe: ['Python', 'Java', 'JavaScript', 'Git', 'Data Structures', 'React', 'SQL'],
};

const FAM_RESUME: Record<keyof typeof FAM_SKILLS, string> = {
  analytics: 'Analytics v3',
  datasci: 'Analytics v3',
  dataeng: 'SWE v1',
  product: 'Product v2',
  ops: 'Ops v2',
  strategy: 'Ops v2',
  finance: 'Ops v2',
  swe: 'SWE v1',
};

const POSITIONS: Position[] = [
  { t: 'Data Analytics Intern', f: 'analytics' },
  { t: 'Business Intelligence Intern', f: 'analytics' },
  { t: 'Data Analyst Intern - Summer 2026', f: 'analytics' },
  { t: 'People Analytics Intern', f: 'analytics' },
  { t: 'Marketing Analytics Intern', f: 'analytics' },
  { t: 'Growth Analytics Intern', f: 'analytics' },
  { t: 'Data Science Intern', f: 'datasci' },
  { t: 'Machine Learning Intern', f: 'datasci' },
  { t: 'Data Engineering Intern', f: 'dataeng' },
  { t: 'Analytics Engineer, New Grad', f: 'dataeng' },
  { t: 'Product Management Intern', f: 'product' },
  { t: 'Associate Product Manager Intern', f: 'product' },
  { t: 'Technical Product Manager Intern', f: 'product' },
  { t: 'Product Operations Intern', f: 'product' },
  { t: 'Business Operations Intern', f: 'ops' },
  { t: 'Strategy & Operations Analyst Intern', f: 'ops' },
  { t: 'Revenue Operations Intern', f: 'ops' },
  { t: 'Supply Chain Analyst Intern', f: 'ops' },
  { t: 'Program Management Intern', f: 'ops' },
  { t: 'Corporate Strategy Intern', f: 'strategy' },
  { t: 'Business Strategy Analyst Intern', f: 'strategy' },
  { t: 'Financial Analyst Intern', f: 'finance' },
  { t: 'FP&A Intern - Summer 2026', f: 'finance' },
  { t: 'Software Engineer, New Grad', f: 'swe' },
  { t: 'Software Engineering Intern', f: 'swe' },
];

const NOTES_POOL = [
  '',
  '',
  '',
  '',
  '',
  '',
  'Referral — Priya',
  'Recruiter reached out on LinkedIn',
  'OA due soon',
  'Warm intro through alum',
  'Applied via careers page',
  'Following up next week',
];

const CITY_KEYS = [
  'San Francisco, CA',
  'New York, NY',
  'Seattle, WA',
  'Austin, TX',
  'Boston, MA',
  'Chicago, IL',
  'Denver, CO',
  'Atlanta, GA',
  'Nashville, TN',
  'Los Angeles, CA',
  'Mountain View, CA',
  'San Jose, CA',
  'Palo Alto, CA',
  'Portland, OR',
  'Minneapolis, MN',
  'Dallas, TX',
  'Washington, DC',
  'Durham, NC',
  'Redwood City, CA',
  'Irving, TX',
  'Philadelphia, PA',
  'San Diego, CA',
  'Phoenix, AZ',
  'Salt Lake City, UT',
  'Miami, FL',
  'Toronto, ON',
  'Vancouver, BC',
  'Montreal, QC',
  'Ottawa, ON',
  'Waterloo, ON',
  'Calgary, AB',
];

/** mulberry32 — small, fast, and seeded so the fixture is stable across reloads. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deliberately sloppy input, so the location normalizer gets exercised. */
function messy(key: string): string {
  const city = key.split(',')[0].toLowerCase();
  return city === 'san francisco' ? 'sf' : city;
}

export function makeSeedRows(n: number, now: Date): Application[] {
  const r = rng(20260721);
  const pick = <T>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const rows: Application[] = [];

  for (let i = 0; i < n; i++) {
    const co = pick(COMPANIES);
    const pos = pick(POSITIONS);

    // Status distribution roughly matching a real intern search: mostly silence.
    const sr = r();
    let status: Status;
    if (sr < 0.46) status = 'Submitted';
    else if (sr < 0.74) status = 'Rejected';
    else if (sr < 0.85) status = 'Ghosted';
    else if (sr < 0.9) status = 'OA';
    else if (sr < 0.955) status = 'Interview';
    else status = 'Offer';

    let reached = reachedFor(status);
    if (status === 'Rejected') {
      const x = r();
      reached = x < 0.5 ? 0 : x < 0.8 ? 1 : 2;
    }
    if (status === 'Ghosted') reached = r() < 0.85 ? 0 : 1;

    const lr = r();
    let location: string;
    if (co.c && lr < 0.5) location = co.c;
    else if (lr < 0.68) location = 'Remote';
    else if (lr < 0.8) location = '';
    else {
      const k = pick(CITY_KEYS);
      location = r() < 0.28 ? messy(k) : k;
    }

    const pool = FAM_SKILLS[pos.f];
    const nsk = 3 + Math.floor(r() * 3);
    const skills: string[] = [];
    const remaining = pool.slice();
    for (let j = 0; j < nsk && remaining.length; j++) {
      skills.push(remaining.splice(Math.floor(r() * remaining.length), 1)[0]);
    }

    let level = 'Entry-level';
    if (/New Grad/.test(pos.t)) level = 'New Grad';
    else if (/Intern/.test(pos.t)) level = 'Intern';

    let salary = '';
    if (level === 'Intern') {
      if (r() < 0.72) salary = '$' + (32 + Math.floor(r() * 24)) + '/hr';
    } else if (r() < 0.68) {
      salary = '$' + (98 + Math.floor(r() * 52)) + 'k';
    }

    // Recency-biased so the chart has a realistic ramp rather than a flat line.
    const off = Math.floor(Math.pow(r(), 1.35) * 74);
    const d = new Date(now.getTime() - off * DAY);
    const slug = co.n.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const id = String(n - i);

    rows.push({
      id,
      company: co.n,
      position: pos.t,
      industry: co.ind,
      level,
      salary,
      skills,
      status,
      reached,
      location,
      loc: normalizeLoc(location),
      applied: isoOf(d),
      appliedTs: d.getTime(),
      resume: FAM_RESUME[pos.f],
      notes: pick(NOTES_POOL),
      sourceUrl: r() < 0.7 ? 'https://careers.' + slug + '.com/' + id : '',
    });
  }

  rows.sort((a, b) => b.appliedTs - a.appliedTs);
  return rows;
}
