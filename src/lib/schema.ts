/**
 * Domain types and design constants, ported from the prototype's DCLogic class.
 *
 * Everything here is data — no React, no I/O — so it can be imported by the
 * pure logic modules, the components, and the tests alike.
 */

export const STATUSES = ['Submitted', 'OA', 'Interview', 'Offer', 'Rejected', 'Ghosted'] as const;

export type Status = (typeof STATUSES)[number];

/** Chip colours for each status in the applications table. */
export const STATUS_META: Record<Status, { bg: string; fg: string; border: string }> = {
  Submitted: { bg: 'transparent', fg: '#3f7d55', border: 'transparent' },
  OA: { bg: 'transparent', fg: '#a97f2b', border: 'transparent' },
  Interview: { bg: 'transparent', fg: '#2f6b9e', border: 'transparent' },
  Offer: { bg: '#c2410c', fg: '#ffffff', border: 'transparent' },
  Rejected: { bg: 'transparent', fg: '#a35242', border: 'transparent' },
  Ghosted: { bg: 'transparent', fg: '#9a9488', border: 'transparent' },
};

export const ACCENT = '#41678a';
export const ACCENT_DIM = '#a9b3a0';

/** Tints for the industry donut, lightest last. */
export const PIE_TINTS = [
  '#35597a',
  '#4a7396',
  '#6d92b0',
  '#8fadc4',
  '#afc6d6',
  '#c9d8e3',
  '#dde7ee',
  '#ecf1f5',
  '#f4f7f9',
];

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DAY = 86_400_000;

export const INDUSTRIES = [
  'Technology / SaaS',
  'Fintech',
  'Data / Analytics',
  'Healthcare',
  'Biotech / Pharma',
  'E-commerce / Retail',
  'Consumer Goods',
  'Hardware / Semiconductors',
  'Media / Gaming',
  'Consulting',
];

export const LEVELS = ['Intern', 'New Grad', 'Entry-level', 'Associate', 'Senior'];

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];

/** What a posting is assumed to be when it doesn't say. */
export const DEFAULT_EMPLOYMENT_TYPE = 'Full-time';

export const RESUMES = ['Analytics v3', 'Product v2', 'SWE v1', 'Ops v2', 'General v4'];

export const SKILL_POOL = [
  'SQL',
  'Python',
  'Excel',
  'Tableau',
  'Power BI',
  'Statistics',
  'A/B Testing',
  'Data Visualization',
  'Looker',
  'Machine Learning',
  'Pandas',
  'R',
  'Experimentation',
  'Spark',
  'Airflow',
  'dbt',
  'Snowflake',
  'ETL',
  'Git',
  'Product Sense',
  'Roadmapping',
  'Stakeholder Mgmt',
  'Agile',
  'User Research',
  'Figma',
  'Process Improvement',
  'Project Mgmt',
  'Communication',
  'Market Research',
  'Financial Modeling',
  'Forecasting',
  'Accounting',
  'Java',
  'JavaScript',
  'Data Structures',
  'React',
  'Storytelling',
];

/** A location string resolved into something the table and map can both use. */
export type NormalizedLocation = {
  type: 'unknown' | 'remote' | 'city';
  display: string;
  /** Canonical "City, ST" key. Absent when the city isn't recognised. */
  key?: string;
  lat?: number;
  lng?: number;
  country?: 'US' | 'CA';
};

/** One tracked job application. */
export type Application = {
  id: string;
  company: string;
  position: string;
  industry: string;
  level: string;
  /** Full-time, Contract, Internship, … See EMPLOYMENT_TYPES. */
  employmentType: string;
  /** Free text, e.g. "$48/hr" or "$120k". */
  salary: string;
  skills: string[];
  status: Status;
  /**
   * How far the application actually got, independent of `status`: a Rejected
   * row records whether it died at the resume screen (0) or after interviews (2).
   * The funnel chart reads this, not `status`.
   */
  reached: number;
  /** Exactly what the user typed. */
  location: string;
  /** Derived from `location` on load; never persisted. */
  loc: NormalizedLocation;
  /** ISO date, YYYY-MM-DD. */
  applied: string;
  appliedTs: number;
  /**
   * When the row was added to the tracker, as epoch ms — distinct from
   * `applied`, which is the date the user says they applied and can edit.
   * This one is set by the database and never edited, which is what makes it
   * usable for "what hour of the day do I actually get applications done".
   */
  createdAt: number;
  resume: string;
  notes: string;
  sourceUrl: string;
};

/** How far each status implies an application progressed, when not stated otherwise. */
export function reachedFor(status: Status): number {
  return { Submitted: 0, OA: 1, Interview: 2, Offer: 3, Rejected: 1, Ghosted: 0 }[status] ?? 0;
}

/** Whether the employer ever replied. Drives the response-rate stat. */
export function isResponse(app: Pick<Application, 'status'>): boolean {
  return app.status !== 'Submitted' && app.status !== 'Ghosted';
}
