import { describe, expect, test } from 'vitest';
import { cityAgg, normalizeLoc } from './locations';
import type { Application } from './schema';

describe('normalizeLoc', () => {
  test('empty input is unknown, shown as an em dash', () => {
    expect(normalizeLoc('')).toEqual({ type: 'unknown', display: '—' });
    expect(normalizeLoc(null)).toEqual({ type: 'unknown', display: '—' });
    expect(normalizeLoc('   ')).toEqual({ type: 'unknown', display: '—' });
  });

  test('remote in any casing or phrasing collapses to Remote', () => {
    expect(normalizeLoc('Remote')).toEqual({ type: 'remote', display: 'Remote' });
    expect(normalizeLoc('remote')).toEqual({ type: 'remote', display: 'Remote' });
    expect(normalizeLoc('Fully Remote (US)')).toEqual({ type: 'remote', display: 'Remote' });
  });

  test('known "City, ST" resolves with coordinates', () => {
    expect(normalizeLoc('San Francisco, CA')).toEqual({
      type: 'city',
      display: 'San Francisco, CA',
      key: 'San Francisco, CA',
      lat: 37.77,
      lng: -122.42,
      country: 'US',
    });
  });

  test('city casing is normalized so variants share one map pin', () => {
    expect(normalizeLoc('new york, ny').key).toBe('New York, NY');
    expect(normalizeLoc('NEW YORK, NY').key).toBe('New York, NY');
  });

  test('bare shorthand expands to the canonical key', () => {
    expect(normalizeLoc('sf').key).toBe('San Francisco, CA');
    expect(normalizeLoc('nyc').key).toBe('New York, NY');
    expect(normalizeLoc('toronto').country).toBe('CA');
  });

  test('Canadian provinces are detected even for cities not in the table', () => {
    const r = normalizeLoc('Halifax, NS');
    expect(r.country).toBe('CA');
    expect(r.lat).toBeUndefined();
  });

  test('unknown cities are displayable but not plottable', () => {
    const r = normalizeLoc('Reykjavik');
    expect(r).toEqual({ type: 'city', display: 'Reykjavik' });
    expect(r.key).toBeUndefined();
  });

  test('a known state code with an unknown city still yields a key', () => {
    const r = normalizeLoc('Fresno, CA');
    expect(r.key).toBe('Fresno, CA');
    expect(r.country).toBe('US');
    expect(r.lat).toBeUndefined();
  });
});

function app(location: string, status: Application['status'] = 'Submitted'): Application {
  return {
    id: Math.random().toString(),
    company: 'Acme',
    position: 'Analyst',
    industry: 'Fintech',
    level: 'Intern',
    salary: '',
    skills: [],
    status,
    reached: 0,
    location,
    loc: normalizeLoc(location),
    applied: '2026-07-01',
    appliedTs: Date.parse('2026-07-01T00:00'),
    resume: '',
    notes: '',
    sourceUrl: '',
  };
}

describe('cityAgg', () => {
  test('groups plottable cities and counts responses separately', () => {
    const rows = [
      app('San Francisco, CA'),
      app('San Francisco, CA', 'Interview'),
      app('sf', 'Offer'),
      app('New York, NY'),
    ];
    const agg = cityAgg(rows).sort((a, b) => b.count - a.count);

    expect(agg).toHaveLength(2);
    expect(agg[0]).toMatchObject({ key: 'San Francisco, CA', count: 3, resp: 2 });
    expect(agg[1]).toMatchObject({ key: 'New York, NY', count: 1, resp: 0 });
  });

  test('remote, unknown, and uncoordinated cities are excluded from the map', () => {
    expect(cityAgg([app('Remote'), app(''), app('Reykjavik'), app('Fresno, CA')])).toEqual([]);
  });
});
