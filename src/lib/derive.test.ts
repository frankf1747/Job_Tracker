import { describe, expect, test } from 'vitest';
import {
  EMPTY_FILTER,
  derive,
  filterRows,
  hasFilter,
  isoOf,
  parseMMDD,
  pieArcs,
  pipsToDraw,
  sortRows,
} from './derive';
import { normalizeLoc } from './locations';
import { PIE_TINTS } from './schema';
import type { Application, Status } from './schema';

function app(over: Partial<Application> = {}): Application {
  const location = over.location ?? 'Remote';
  const applied = over.applied ?? '2026-07-01';
  return {
    id: over.id ?? Math.random().toString(),
    company: 'Acme',
    position: 'Data Analyst Intern',
    industry: 'Fintech',
    level: 'Intern',
    salary: '',
    skills: [],
    status: 'Submitted',
    reached: 0,
    resume: '',
    notes: '',
    sourceUrl: '',
    ...over,
    location,
    loc: normalizeLoc(location),
    applied,
    appliedTs: Date.parse(applied + 'T00:00'),
  };
}

describe('filterRows', () => {
  const rows = [
    app({
      id: '1',
      company: 'Stripe',
      industry: 'Fintech',
      skills: ['SQL'],
      status: 'Offer',
      reached: 3,
      location: 'San Francisco, CA',
    }),
    app({
      id: '2',
      company: 'Notion',
      industry: 'Technology / SaaS',
      skills: ['Python'],
      status: 'Rejected',
      reached: 2,
      location: 'New York, NY',
    }),
    app({
      id: '3',
      company: 'Ramp',
      industry: 'Fintech',
      skills: ['SQL', 'Python'],
      status: 'Submitted',
      reached: 0,
      location: 'Remote',
    }),
  ];

  test('no filter returns everything', () => {
    expect(filterRows(rows, EMPTY_FILTER, '')).toHaveLength(3);
  });

  test('search matches company, position, and location', () => {
    expect(filterRows(rows, EMPTY_FILTER, 'stripe').map((r) => r.id)).toEqual(['1']);
    expect(filterRows(rows, EMPTY_FILTER, 'analyst')).toHaveLength(3);
    expect(filterRows(rows, EMPTY_FILTER, 'new york').map((r) => r.id)).toEqual(['2']);
  });

  test('search is trimmed and case-insensitive', () => {
    expect(filterRows(rows, EMPTY_FILTER, '  STRIPE  ').map((r) => r.id)).toEqual(['1']);
  });

  test('within a category, values are OR-ed', () => {
    const f = { ...EMPTY_FILTER, skills: ['SQL', 'Python'] };
    expect(filterRows(rows, f, '')).toHaveLength(3);
  });

  test('across categories, filters are AND-ed', () => {
    const f = {
      ...EMPTY_FILTER,
      skills: ['SQL'],
      industries: ['Fintech'],
      statuses: ['Offer'] as Status[],
    };
    expect(filterRows(rows, f, '').map((r) => r.id)).toEqual(['1']);
  });

  test('stage filter keeps rows that reached at least that far', () => {
    expect(filterRows(rows, { ...EMPTY_FILTER, stage: 2 }, '').map((r) => r.id)).toEqual([
      '1',
      '2',
    ]);
    expect(filterRows(rows, { ...EMPTY_FILTER, stage: 3 }, '').map((r) => r.id)).toEqual(['1']);
  });

  test('location filter excludes rows with no map key', () => {
    const f = { ...EMPTY_FILTER, locations: ['San Francisco, CA'] };
    expect(filterRows(rows, f, '').map((r) => r.id)).toEqual(['1']);
  });
});

describe('hasFilter', () => {
  test('is false only for a fully empty filter', () => {
    expect(hasFilter(EMPTY_FILTER)).toBe(false);
    expect(hasFilter({ ...EMPTY_FILTER, skills: ['SQL'] })).toBe(true);
    // stage 0 is a real filter, not an absent one.
    expect(hasFilter({ ...EMPTY_FILTER, stage: 0 })).toBe(true);
  });
});

describe('sortRows', () => {
  const rows = [
    app({ id: 'b', company: 'Notion', applied: '2026-07-05', status: 'Offer' }),
    app({ id: 'a', company: 'Acme', applied: '2026-07-10', status: 'Submitted' }),
    app({ id: 'c', company: 'Zoox', applied: '2026-07-01', status: 'Interview' }),
  ];

  test('sorts by company in both directions', () => {
    expect(sortRows(rows, 'company', 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, 'company', 'desc').map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  test('sorts by date newest-first when descending', () => {
    expect(sortRows(rows, 'applied', 'desc').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  test('sorts status by funnel order, not alphabetically', () => {
    expect(sortRows(rows, 'status', 'asc').map((r) => r.status)).toEqual([
      'Submitted',
      'Interview',
      'Offer',
    ]);
  });

  test('does not mutate the input array', () => {
    const before = rows.map((r) => r.id);
    sortRows(rows, 'company', 'asc');
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe('derive', () => {
  const now = new Date(2026, 6, 21);

  test('counts statuses, responses, and the funnel', () => {
    const rows = [
      app({ status: 'Submitted', reached: 0 }),
      app({ status: 'Interview', reached: 2 }),
      app({ status: 'Offer', reached: 3 }),
      app({ status: 'Rejected', reached: 2 }),
      app({ status: 'Ghosted', reached: 0 }),
    ];
    const d = derive(rows, now);

    expect(d.total).toBe(5);
    expect(d.byStatus.Offer).toBe(1);
    expect(d.byStatus.OA).toBe(0);
    // Submitted and Ghosted mean the employer never replied.
    expect(d.responded).toBe(3);
    expect(d.interviews).toBe(3);
    expect(d.offers).toBe(1);
  });

  test('thisWeek counts only the last seven days', () => {
    const rows = [
      app({ applied: '2026-07-20' }),
      app({ applied: '2026-07-15' }),
      app({ applied: '2026-07-01' }),
    ];
    expect(derive(rows, now).thisWeek).toBe(2);
  });

  test('an empty list produces zeroes rather than NaN', () => {
    const d = derive([], now);
    expect(d.total).toBe(0);
    expect(d.responded).toBe(0);
    expect(d.byStatus.Submitted).toBe(0);
  });
});

describe('pieArcs', () => {
  test('a zero total yields no arcs', () => {
    expect(pieArcs([{ label: 'x', value: 0 }], 0, 50, 50, 40, PIE_TINTS)).toEqual([]);
  });

  test('a single full slice closes the circle', () => {
    const arcs = pieArcs([{ label: 'all', value: 7 }], 7, 50, 50, 40, PIE_TINTS);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].pct).toBe(100);
    // A full circle needs the arc form, not the wedge form with a centre point.
    expect(arcs[0].d).not.toContain('L');
    expect(arcs[0].d.endsWith('Z')).toBe(true);
  });

  test('percentages track the slice values', () => {
    const arcs = pieArcs(
      [
        { label: 'a', value: 50 },
        { label: 'b', value: 25 },
        { label: 'c', value: 25 },
      ],
      100,
      50,
      50,
      40,
      PIE_TINTS,
    );
    expect(arcs.map((a) => a.pct)).toEqual([50, 25, 25]);
    expect(arcs.map((a) => a.color)).toEqual(PIE_TINTS.slice(0, 3));
  });

  test('colors cycle when there are more slices than tints', () => {
    const items = Array.from({ length: PIE_TINTS.length + 2 }, (_, i) => ({
      label: String(i),
      value: 1,
    }));
    const arcs = pieArcs(items, items.length, 50, 50, 40, PIE_TINTS);
    expect(arcs[PIE_TINTS.length].color).toBe(PIE_TINTS[0]);
  });
});

describe('parseMMDD', () => {
  test('parses month-name shorthand', () => {
    expect(parseMMDD('Jul 4', '2026-01-01')).toBe('2026-07-04');
    expect(parseMMDD('jul4', '2026-01-01')).toBe('2026-07-04');
    expect(parseMMDD('July 14', '2026-01-01')).toBe('2026-07-14');
    expect(parseMMDD('Dec. 25', '2026-01-01')).toBe('2026-12-25');
  });

  test('parses bare digit shorthand', () => {
    expect(parseMMDD('0704', '2026-01-01')).toBe('2026-07-04');
    expect(parseMMDD('704', '2026-01-01')).toBe('2026-07-04');
    expect(parseMMDD('12/25', '2026-01-01')).toBe('2026-12-25');
  });

  test('keeps the year of the date being edited', () => {
    expect(parseMMDD('Jul 4', '2024-03-02')).toBe('2024-07-04');
  });

  test('rejects unusable input rather than guessing', () => {
    expect(parseMMDD('', '2026-01-01')).toBeNull();
    expect(parseMMDD('   ', '2026-01-01')).toBeNull();
    expect(parseMMDD('hello', '2026-01-01')).toBeNull();
    expect(parseMMDD('7', '2026-01-01')).toBeNull();
    expect(parseMMDD('99999', '2026-01-01')).toBeNull();
  });

  test('rejects out-of-range months and days', () => {
    expect(parseMMDD('1345', '2026-01-01')).toBeNull();
    expect(parseMMDD('0299', '2026-01-01')).toBeNull();
    expect(parseMMDD('0700', '2026-01-01')).toBeNull();
  });
});

describe('pipsToDraw', () => {
  // The real strip: 8px ticks, 3px gaps, three rows.
  const draw = (days: number, width: number) => pipsToDraw(days, width, 8, 3, 3);

  test('draws one tick per day while they fit', () => {
    expect(draw(1, 479)).toBe(1);
    expect(draw(30, 479)).toBe(30);
  });

  test('caps at three rows rather than growing the panel', () => {
    // 479px fits 43 per row, so 129 across three rows.
    expect(draw(500, 479)).toBe(129);
    expect(draw(129, 479)).toBe(129);
    expect(draw(130, 479)).toBe(129);
  });

  test('a narrower column caps sooner', () => {
    expect(draw(500, 240)).toBeLessThan(draw(500, 479));
  });

  test('draws nothing until the width is measured', () => {
    expect(draw(50, 0)).toBe(0);
    expect(draw(50, -1)).toBe(0);
  });

  test('always allows at least one per row, however narrow', () => {
    expect(draw(50, 4)).toBe(3);
  });

  test('never returns a negative count', () => {
    expect(draw(0, 479)).toBe(0);
    expect(draw(-5, 479)).toBe(0);
  });
});

describe('isoOf', () => {
  test('pads month and day, and uses local time rather than UTC', () => {
    expect(isoOf(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoOf(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
