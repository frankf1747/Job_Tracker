import { describe, expect, test } from 'vitest';
import {
  draftFromApplication,
  guessEmploymentType,
  guessIndustry,
  guessLevel,
  looksLikePosting,
  parsePostingLocal,
  stripLogoNoise,
  stripMarkdownLinks,
} from './parsePosting';
import { normalizeLoc } from './locations';
import type { Application } from './schema';

/**
 * A real LinkedIn paste, in the markdown form the clipboard actually produces.
 * Every field below was wrong before: the employer lost to a tool named in the
 * requirements, "internal stakeholders" made it an internship, and the job title
 * came out as a fragment of a sentence.
 */
const UNILEVER = `[Unilever](https://www.linkedin.com/company/unilever/life/)
[CPFR Analyst](https://www.linkedin.com/jobs/view/4440231632/?trackingId=2SDxbv9RfRjcskahH9BqqQ%3D%3D&refId=jRPL23HCJronUcknDkOwLQ)
Toronto, ON · 6 days ago · Over 100 people clicked apply
Promoted by hirer · Responses managed off LinkedIn
[On-site](https://www.linkedin.com/jobs/search-results/?currentJobId=4440231632)
[Full-time](https://www.linkedin.com/jobs/search-results/?currentJobId=4440231632)
[Apply](https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fdsp%2Eprng%2Eco%2F1vjOnQb)
Save
About the job
Job Purpose

The CPFR Analyst plays a critical role in driving collaborative planning, forecasting, and
replenishment with your assigned customer and internal stakeholders to ensure optimal product
availability, minimize unproductive inventory, and deliver an exceptional customer experience.

* Analyze customer and internal data to proactively identify risks and improve inventory efficiency.
* Develop and maintain dashboards and workflows using Power BI, and automation tools.
* Communicate trends through compelling data storytelling to drive incremental sales.
* Strong analytical and technical skills with proficiency in Power BI, Databricks, and automation tools.
* Deep understanding of end-to-end supply chain processes and demand forecasting.

Pay: The pay range for this position is $71,000-$106,600.`;

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

describe('a real LinkedIn markdown paste', () => {
  const d = parse(UNILEVER);

  test('names the employer, not a tool from the requirements list', () => {
    // "proficiency in Power BI, Databricks" used to outrank Unilever on line 1.
    expect(d.company).toBe('Unilever');
  });

  test('reads the job title from its own line', () => {
    expect(d.position).toBe('CPFR Analyst');
  });

  test('does not mistake "internal" for an internship', () => {
    expect(d.level).toBe('Entry-level');
    expect(d.employmentType).toBe('Full-time');
  });

  test('classifies supply-chain work as consumer goods', () => {
    expect(d.industry).toBe('Consumer Goods');
  });

  test('links to the posting rather than the company page', () => {
    expect(d.sourceUrl).toContain('/jobs/view/4440231632');
  });

  test('picks up location and pay range', () => {
    expect(d.location).toBe('Toronto, ON');
    expect(d.salary).toBe('$71,000-$106,600');
  });

  test('extracts the tools actually asked for', () => {
    expect(d.skills).toEqual(expect.arrayContaining(['Power BI', 'Forecasting', 'Storytelling']));
    // Databricks is named as a tool here, but it is not in the tracked skill pool.
    expect(d.skills).not.toContain('Databricks');
  });
});

/**
 * A Workday paste from an already-applied posting. The head is nothing but
 * furniture — the confirmation line, "View Application", "locations", a bare
 * location code — and the employer's name shows up only in the body prose,
 * "At Agilent, we ...". The old head-line scan stopped on "View Application".
 */
const WORKDAY_APPLIED = `Advanced Data Analyst
You applied for this job on July 26, 2026.
View Application
locations
US-DE-Wilmington
Option to Work Remote in Germany
time type
Full time
posted on
Posted 10 Days Ago
job requisition id
4038648
At Agilent, we are committed to advancing the quality of life. We are seeking an
Advanced Data Analyst to join our global analytics team, leveraging Microsoft
Fabric, Power BI, and Snowflake. Strong hands-on experience with SQL and Python.`;

describe('a Workday paste from an already-applied posting', () => {
  const d = parse(WORKDAY_APPLIED);

  test('names the employer from the body, not the "View Application" furniture', () => {
    expect(d.company).toBe('Agilent');
  });

  test('still reads the job title', () => {
    expect(d.position).toBe('Advanced Data Analyst');
  });
});

describe('stripMarkdownLinks', () => {
  test('keeps the label and captures the target', () => {
    const { text, links } = stripMarkdownLinks('[Acme](https://acme.com/jobs/1) is hiring');
    expect(text).toBe('Acme is hiring');
    expect(links).toEqual([{ label: 'Acme', url: 'https://acme.com/jobs/1' }]);
  });

  test('leaves plain text and bare URLs alone', () => {
    const raw = 'Analyst at Acme. See https://acme.com/careers';
    expect(stripMarkdownLinks(raw).text).toBe(raw);
  });

  test('drops empty labels rather than recording them', () => {
    expect(stripMarkdownLinks('[](https://x.com)').links).toEqual([]);
  });
});

describe('guessEmploymentType', () => {
  test('defaults to full-time, which is what most postings are', () => {
    expect(guessEmploymentType('A great analyst role at Acme.', 'Entry-level')).toBe('Full-time');
  });

  test('reads an explicit type off the posting', () => {
    expect(guessEmploymentType('Full-time · On-site', 'Entry-level')).toBe('Full-time');
    expect(guessEmploymentType('This is a part-time position', 'Entry-level')).toBe('Part-time');
    expect(guessEmploymentType('6-month contract role', 'Entry-level')).toBe('Contract');
    expect(guessEmploymentType('Seasonal warehouse work', 'Entry-level')).toBe('Temporary');
  });

  test('an intern-level role is an internship even when unstated', () => {
    expect(guessEmploymentType('Data Science Intern', 'Intern')).toBe('Internship');
  });

  test('an explicit part-time beats the intern inference', () => {
    expect(guessEmploymentType('Part-time internship, 20 hrs/week', 'Intern')).toBe('Part-time');
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

  test('requires whole words, not prefixes', () => {
    // Regression: `\bintern` with no trailing boundary matched all of these.
    expect(guessLevel('work with internal stakeholders')).toBe('Entry-level');
    expect(guessLevel('internally facing tooling')).toBe('Entry-level');
    expect(guessLevel('international sales support')).toBe('Entry-level');
    expect(guessLevel('demonstrated seniority in the field')).toBe('Entry-level');
  });

  test('new grad wins over intern when both appear', () => {
    expect(guessLevel('New Grad role, formerly an internship pipeline')).toBe('New Grad');
  });
});

describe('guessIndustry', () => {
  test('maps domain vocabulary to an industry', () => {
    expect(guessIndustry('we serve hospital and patient data')).toBe('Bio / Healthcare');
    expect(guessIndustry('payment processing and lending')).toBe('Fintech');
    expect(guessIndustry('semiconductor design')).toBe('Hardware / Semiconductors');
    expect(guessIndustry('a game studio')).toBe('Media / Gaming');
  });

  test('defaults to Technology / SaaS when nothing matches', () => {
    expect(guessIndustry('we make software for people')).toBe('Technology / SaaS');
  });
});

describe('draftFromApplication', () => {
  const app: Application = {
    id: 'abc',
    company: 'Stripe',
    position: 'Data Analyst',
    industry: 'Fintech',
    level: 'Entry-level',
    employmentType: 'Full-time',
    salary: '$120k',
    skills: ['SQL', 'Python'],
    status: 'Interview',
    reached: 2,
    location: 'San Francisco, CA',
    loc: normalizeLoc('San Francisco, CA'),
    applied: '2026-07-10',
    appliedTs: Date.parse('2026-07-10T00:00'),
    createdAt: Date.parse('2026-07-10T09:30'),
    resume: 'Analytics v3',
    notes: 'referral',
    sourceUrl: 'https://stripe.com/jobs/1',
  };

  test('round-trips the editable fields', () => {
    const d = draftFromApplication(app);
    expect(d).toMatchObject({
      company: 'Stripe',
      position: 'Data Analyst',
      location: 'San Francisco, CA',
      industry: 'Fintech',
      level: 'Entry-level',
      employmentType: 'Full-time',
      salary: '$120k',
      status: 'Interview',
      appliedDate: '2026-07-10',
      resume: 'Analytics v3',
      sourceUrl: 'https://stripe.com/jobs/1',
    });
    expect(d.skills).toEqual(['SQL', 'Python']);
    expect(d.draft).toBe('');
  });

  test('copies the skills array rather than sharing it', () => {
    const d = draftFromApplication(app);
    d.skills.push('Tableau');
    expect(app.skills).toEqual(['SQL', 'Python']);
  });

  test('carries neither notes nor derived fields, which the modal does not edit', () => {
    const d = draftFromApplication(app);
    expect(d).not.toHaveProperty('notes');
    expect(d).not.toHaveProperty('appliedTs');
    expect(d).not.toHaveProperty('id');
  });
});

describe('stripLogoNoise', () => {
  test('pulls the name out of the logo alt text', () => {
    expect(stripLogoNoise('Company logo for, AmeriPharma')).toBe('AmeriPharma');
    expect(stripLogoNoise('Logo for: Acme Health')).toBe('Acme Health');
    expect(stripLogoNoise('AmeriPharma logo')).toBe('AmeriPharma');
  });

  test('empties a line that is only alt text, so the real name is used instead', () => {
    expect(stripLogoNoise('Company logo')).toBe('');
    expect(stripLogoNoise('logo')).toBe('');
  });

  test('leaves ordinary company names alone', () => {
    expect(stripLogoNoise('Stripe')).toBe('Stripe');
    // "logo" only counts at the very start or the very end.
    expect(stripLogoNoise('Logo Design Inc')).toBe('Logo Design Inc');
  });
});

describe('LinkedIn logo alt text before the company name', () => {
  const body =
    '\nMarketing Analytics Specialist\nLaguna Hills, CA\nWe need SQL and Python for this healthcare analytics role with good benefits.';

  test('strips a name glued onto the alt text', () => {
    expect(parse('Company logo for, AmeriPharma' + body).company).toBe('AmeriPharma');
  });

  test('strips a trailing "logo"', () => {
    expect(parse('AmeriPharma logo' + body).company).toBe('AmeriPharma');
  });

  test('skips a bare alt-text line and takes the name below it', () => {
    expect(parse('Company logo\nAmeriPharma' + body).company).toBe('AmeriPharma');
  });

  test('still finds a known company sitting under the alt text', () => {
    expect(parse('Company logo\nStripe' + body).company).toBe('Stripe');
  });

  test('does not disturb the position or the rest of the parse', () => {
    const d = parse('Company logo for, AmeriPharma' + body);
    expect(d.position).toBe('Marketing Analytics Specialist');
    expect(d.location).toBe('Laguna Hills, CA');
  });
});
