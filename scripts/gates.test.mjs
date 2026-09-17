import { describe, expect, it } from 'vitest';
import {
  authorizationFilter,
  gateFacts,
  gateFor,
  locationFilter,
  salaryBand,
  softFloor,
  unusedSystems,
  yearsFloor,
} from './gates.mjs';

describe('yearsFloor', () => {
  it('takes the governing requirement, not the smallest number in it', () => {
    // The bug that cost a scoring run: "including 2+" is a subset of the 5+,
    // and reading the lowest figure turned a hard block into a shortlist entry.
    expect(
      yearsFloor('5+ years of strategy experience, including 2+ years of management consulting'),
    ).toBe(5);
  });

  it('reads a range from its low end', () => {
    expect(yearsFloor('2–5 years of experience in business, commercial or related analytics')).toBe(
      2,
    );
    expect(
      yearsFloor('2–3+ years in a highly analytical role, strategy consulting or finance'),
    ).toBe(2);
  });

  it('takes the highest floor when several requirements stack', () => {
    expect(
      yearsFloor(
        '1-3 years prior experience as an analyst. And 1-3 years experience in reporting.',
      ),
    ).toBe(1);
    expect(yearsFloor('2+ years of experience required. 4+ years of experience with SQL.')).toBe(4);
  });

  it('ignores figures that are only preferred', () => {
    expect(yearsFloor('1+ years of experience required. 5+ years of experience preferred.')).toBe(
      1,
    );
    expect(yearsFloor('Bonus: 6+ years of experience in freight.')).toBe(null);
  });

  it('returns null when the posting states no floor', () => {
    expect(
      yearsFloor('Strong technical expertise in data modeling, visualization and analytics.'),
    ).toBe(null);
  });
});

describe('softFloor', () => {
  it('counts a degree ladder, because the MSBA is worth roughly two years', () => {
    const f = softFloor(
      "Bachelor's degree and 3 years, or Master's degree and 1 year of experience",
    );
    expect(f?.type).toBe('degree-ladder');
    expect(f?.helps).toBe(true);
  });

  it('counts an education-and-experience combination', () => {
    const f = softFloor(
      'or any combination of education and experience which would provide an equivalent background',
    );
    expect(f?.type).toBe('equivalency');
    expect(f?.helps).toBe(true);
  });

  it('counts an explicit new-grad door', () => {
    expect(softFloor('2+ years of experience, or a recent graduate')?.helps).toBe(true);
  });

  it('does NOT count a degree-only equivalency, which helps nobody who has a degree', () => {
    // Both of these were misread as lowering the years bar. They substitute for
    // the diploma, and Frank already holds one.
    const a = softFloor(
      "Bachelor's degree in Analytics, Data Science or a related field; or equivalent professional experience.",
    );
    expect(a?.type).toBe('degree-only');
    expect(a?.helps).toBe(false);

    const b = softFloor('Degree or equivalent relevant experience required.');
    expect(b?.helps).toBe(false);
  });

  it('returns null when the posting offers no relief at all', () => {
    expect(
      softFloor('5+ years of strategy experience, including 2+ in management consulting'),
    ).toBe(null);
  });
});

describe('salaryBand', () => {
  it('reads the common band formats verbatim from postings', () => {
    expect(salaryBand('Base pay range:\n$85,000—$95,000 USD')).toEqual({ min: 85000, max: 95000 });
    expect(
      salaryBand('the estimated base salary range for this role is $150,000 - $175,000 per year'),
    ).toEqual({ min: 150000, max: 175000 });
    expect(salaryBand('Salary\n$71,300.00 - $107,000.00 / yr')).toEqual({
      min: 71300,
      max: 107000,
    });
    expect(salaryBand('the starting salary range for this position is 90-95K USD')).toEqual({
      min: 90000,
      max: 95000,
    });
  });

  it('returns null when no band is stated', () => {
    expect(salaryBand('Competitive salary and benefits package')).toBe(null);
  });
});

describe('filters', () => {
  it('catches a residency requirement', () => {
    expect(locationFilter('Supply Chain Analyst (Must Live in Colorado)')).toMatch(/Colorado/i);
    expect(locationFilter('This role is based in San Francisco, CA.')).toMatch(/San Francisco/i);
    expect(locationFilter('Remote, anywhere in the US')).toBe(null);
  });

  it('separates sponsorship, citizenship and clearance', () => {
    expect(authorizationFilter('Authorization to work in the US without sponsorship')).toBe(
      'sponsorship',
    );
    expect(authorizationFilter('Must be a US citizen')).toBe('citizenship');
    expect(authorizationFilter('Active TS/SCI security clearance required')).toBe('clearance');
    expect(authorizationFilter('We welcome applicants from all backgrounds')).toBe(null);
  });

  it('flags required systems never used, and ignores them when merely preferred', () => {
    expect(
      unusedSystems(
        'Prior work experience that included tools such as Kanban boards, Gemba walks, and A3 Problem Solving is required',
      ),
    ).toContain('Lean (Gemba/A3/Kanban)');
    expect(
      unusedSystems('Experience facilitating sprint planning and retrospectives required'),
    ).toContain('Agile ceremony facilitation');
    expect(unusedSystems('Familiarity with Jira is a plus')).toEqual([]);
  });
});

describe('gateFor', () => {
  const facts = (over) => ({
    yearsFloor: null,
    softFloor: null,
    salary: null,
    location: null,
    authorization: null,
    systems: [],
    ...over,
  });

  it('fires years only above what Frank can credibly claim', () => {
    expect(gateFor(facts({ yearsFloor: 5 }))).toBe('years');
    expect(gateFor(facts({ yearsFloor: 2 }))).toBe(null);
    expect(gateFor(facts({ yearsFloor: 1 }))).toBe(null);
  });

  it('lets a real soft floor suppress the years gate', () => {
    expect(gateFor(facts({ yearsFloor: 5, softFloor: { type: 'equivalency', helps: true } }))).toBe(
      null,
    );
  });

  it('does not let a degree-only clause suppress it', () => {
    expect(
      gateFor(facts({ yearsFloor: 5, softFloor: { type: 'degree-only', helps: false } })),
    ).toBe('years');
  });

  it('fires salary when the band opens above the range', () => {
    expect(gateFor(facts({ salary: { min: 150000, max: 175000 } }))).toBe('salary');
    expect(gateFor(facts({ salary: { min: 80900, max: 150300 } }))).toBe(null);
  });

  it('reports salary ahead of years when both hold', () => {
    // A band this far above says the posting is two levels up, which explains
    // the tenure bar rather than merely coinciding with it.
    expect(gateFor(facts({ yearsFloor: 5, salary: { min: 150000, max: 175000 } }))).toBe('salary');
  });

  it('puts work authorization above everything', () => {
    expect(
      gateFor(facts({ authorization: 'sponsorship', salary: { min: 150000, max: 175000 } })),
    ).toBe('authorization');
    expect(gateFor(facts({ authorization: 'clearance' }))).toBe('clearance');
  });

  it('returns null when nothing disqualifies', () => {
    expect(gateFor(facts())).toBe(null);
  });
});

describe('gateFacts', () => {
  it('reads every fact out of one posting in a single pass', () => {
    const f = gateFacts(
      'Salary\n$71,300.00 - $107,000.00 / yr\nMust Live in Colorado\n1-3 years prior experience required.',
    );
    expect(f.salary).toEqual({ min: 71300, max: 107000 });
    expect(f.location).toMatch(/Colorado/i);
    expect(f.yearsFloor).toBe(1);
    expect(gateFor(f)).toBe(null);
  });
});

describe('yearsFloor section handling', () => {
  it('lets a heading govern the bullets beneath it', () => {
    const posting = [
      'Required',
      '2+ years of experience in analytics',
      'Nice to Haves',
      '6+ years of experience in B2B SaaS',
    ].join('\n');
    expect(yearsFloor(posting)).toBe(2);
  });

  it('stops applying a heading once the next one replaces it', () => {
    const posting = [
      'Preferred Qualifications',
      '8+ years of experience leading teams',
      'Minimum Qualifications',
      '3+ years of experience with SQL',
    ].join('\n');
    expect(yearsFloor(posting)).toBe(3);
  });
});
