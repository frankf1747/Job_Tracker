import { describe, expect, test } from 'vitest';
import { guessIndustry, guessLevel, looksLikePosting, parsePostingLocal } from './parsePosting';

const TODAY = new Date(2026, 6, 21);
const parse = (t: string) => parsePostingLocal(t, TODAY);

const STRIPE_POSTING = `
Data Analytics Intern — Summer 2026
Stripe
San Francisco, CA

About the role
You'll partner with our finance and payments teams to build dashboards and
run experiments. We're looking for someone comfortable with SQL and Python,
with exposure to Tableau and A/B Testing.

Compensation: $48/hr
Apply: https://stripe.com/jobs/12841
`;

describe('looksLikePosting', () => {
  test('rejects short pastes that are probably not postings', () => {
    expect(looksLikePosting('')).toBe(false);
    expect(looksLikePosting('hello world')).toBe(false);
    // Long enough in characters, but too few words.
    expect(looksLikePosting('a'.repeat(60))).toBe(false);
  });

  test('accepts a realistic posting', () => {
    expect(looksLikePosting(STRIPE_POSTING)).toBe(true);
  });
});

describe('parsePostingLocal', () => {
  test('extracts every field from a well-formed posting', () => {
    const d = parse(STRIPE_POSTING);
    expect(d.company).toBe('Stripe');
    expect(d.position).toBe('Data Analytics Intern — Summer 2026');
    expect(d.location).toBe('San Francisco, CA');
    expect(d.level).toBe('Intern');
    expect(d.salary).toBe('$48/hr');
    expect(d.sourceUrl).toBe('https://stripe.com/jobs/12841');
    expect(d.skills).toEqual(expect.arrayContaining(['SQL', 'Python', 'Tableau', 'A/B Testing']));
  });

  test('a new draft always starts as Submitted, applied today', () => {
    const d = parse(STRIPE_POSTING);
    expect(d.status).toBe('Submitted');
    expect(d.appliedDate).toBe('2026-07-21');
    expect(d.draft).toBe('');
  });

  test('falls back to editable placeholders rather than inventing data', () => {
    const d = parse('We are hiring! Great benefits, flexible hours, and a wonderful team culture.');
    expect(d.company).toBe('Company (edit me)');
    expect(d.position).toBe('Role (edit me)');
  });

  test('finds a company after "at" when the name is unknown', () => {
    const d = parse(
      'Software Engineering Intern at Hooli Systems\nWe build distributed systems for the modern web.',
    );
    expect(d.company).toBe('Hooli Systems');
  });

  test('reads an explicit Company: label', () => {
    const d = parse(
      'Company: Initech\nSenior Analyst role open now, apply through our site today.',
    );
    expect(d.company).toBe('Initech');
  });

  test('detects Remote when no city is present', () => {
    const d = parse(
      'Data Science Intern\nAcme Corp\nThis is a fully remote position open to US applicants.',
    );
    expect(d.location).toBe('Remote');
  });

  test('splits location off a company-prefixed line', () => {
    const d = parse(
      'Product Management Intern\nRamp\nRamp New York, NY\nBuild the future of finance.',
    );
    expect(d.location).toBe('New York, NY');
  });

  test('caps extracted skills at seven', () => {
    const d = parse(
      `Analytics Intern at Acme.
       Requirements: SQL, Python, Excel, Tableau, Power BI, Statistics,
       A/B Testing, Data Visualization, Looker, Machine Learning, Pandas, R.`,
    );
    expect(d.skills).toHaveLength(7);
  });

  test('does not match a skill inside a longer word', () => {
    const d = parse('Analyst at Acme. You will use Rust and Java daily to build our platform.');
    expect(d.skills).not.toContain('R');
    expect(d.skills).toContain('Java');
  });

  test('reads annual salary ranges as well as hourly', () => {
    expect(
      parse('Analyst at Acme. Base pay $120,000 - $150,000 per year plus equity.').salary,
    ).toContain('$120,000');
    expect(parse('Analyst at Acme. This role pays $95k annually with full benefits.').salary).toBe(
      '$95k',
    );
  });

  test('keeps the k suffix on abbreviated salaries', () => {
    // Regression: the prototype's fallback ordering truncated "$95k" to "$95".
    expect(parse('Analyst at Acme. Compensation is $95k for this role, plus bonus.').salary).toBe(
      '$95k',
    );
    expect(parse('Analyst at Acme. Range is $95k - $120k depending on experience.').salary).toBe(
      '$95k - $120k',
    );
  });

  test('leaves salary and url empty when the posting omits them', () => {
    const d = parse('Data Analyst Intern at Acme. Join our team and help us grow the business.');
    expect(d.salary).toBe('');
    expect(d.sourceUrl).toBe('');
  });
});

describe('guessLevel', () => {
  test('picks the most specific level mentioned', () => {
    expect(guessLevel('Software Engineer, New Grad')).toBe('New Grad');
    expect(guessLevel('Data Science Internship')).toBe('Intern');
    expect(guessLevel('Senior Product Manager')).toBe('Senior');
    expect(guessLevel('Associate Analyst')).toBe('Associate');
    expect(guessLevel('Data Analyst')).toBe('Entry-level');
  });

  test('new grad wins over intern when both appear', () => {
    expect(guessLevel('New Grad role, formerly an internship pipeline')).toBe('New Grad');
  });
});

describe('guessIndustry', () => {
  test('maps domain vocabulary to an industry', () => {
    expect(guessIndustry('we serve hospital and patient data')).toBe('Healthcare');
    expect(guessIndustry('payment processing and lending')).toBe('Fintech');
    expect(guessIndustry('semiconductor design')).toBe('Hardware / Semiconductors');
    expect(guessIndustry('a game studio')).toBe('Media / Gaming');
  });

  test('defaults to Technology / SaaS when nothing matches', () => {
    expect(guessIndustry('we make software for people')).toBe('Technology / SaaS');
  });
});
