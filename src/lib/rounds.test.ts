import { describe, expect, it } from 'vitest';
import { outcomeOf, roundSummary, sanitizeRounds } from './rounds';
import type { Round, Status } from './schema';

const app = (status: Status, ...types: Round['type'][]) => ({
  status,
  rounds: types.map((type) => ({ type })),
});

describe('sanitizeRounds', () => {
  it('keeps well-formed rounds and drops anything unreadable', () => {
    // Stored as JSON the app does not control end to end, so it is read
    // defensively rather than trusted.
    expect(
      sanitizeRounds([
        { type: 'HR / Recruiter', date: '2026-10-01' },
        { type: 'Not a type' },
        null,
        { type: 'Other', label: 'Take-home' },
        { type: 'Technical', date: 'tomorrow' },
      ]),
    ).toEqual([
      { type: 'HR / Recruiter', date: '2026-10-01' },
      { type: 'Other', label: 'Take-home' },
      { type: 'Technical' },
    ]);
  });

  it('reads a missing value as no rounds', () => {
    expect(sanitizeRounds(undefined)).toEqual([]);
    expect(sanitizeRounds('nope')).toEqual([]);
  });
});

describe('outcomeOf', () => {
  it('names how the application ended, or that it has not', () => {
    expect(outcomeOf('Offer')).toBe('Offer');
    expect(outcomeOf('Rejected')).toBe('Rejected');
    expect(outcomeOf('Ghosted')).toBe('Ghosted');
    expect(outcomeOf('Interview')).toBe('In progress');
    expect(outcomeOf('Submitted')).toBe('In progress');
  });
});

describe('roundSummary', () => {
  const rows = [
    app('Rejected', 'HR / Recruiter'),
    app('Offer', 'HR / Recruiter', 'Hiring Manager', 'Panel / Final'),
    app('Rejected', 'HR / Recruiter', 'Hiring Manager'),
    app('Interview', 'Hiring Manager'),
    app('Submitted'), // no rounds: not counted
  ];
  const sum = roundSummary(rows);

  it('counts only applications that have rounds', () => {
    expect(sum.total).toBe(4);
  });

  it('gives one row per round, counting types in process order', () => {
    const line = (i: number) => sum.rows[i].segments.map((s) => `${s.name}:${s.count}`);
    expect(sum.rows.map((r) => r.label)).toEqual(['Round 1', 'Round 2', 'Round 3', 'Ended']);
    expect(line(0)).toEqual(['HR / Recruiter:3', 'Hiring Manager:1']);
    expect(line(1)).toEqual(['Hiring Manager:2']);
    expect(line(2)).toEqual(['Panel / Final:1']);
  });

  it('reaches fewer applications each round, which is the drop-off', () => {
    expect(sum.rows.slice(0, 3).map((r) => r.reached)).toEqual([4, 2, 1]);
  });

  it('ends with how every application with rounds turned out', () => {
    const ended = sum.rows[3];
    expect(ended.kind).toBe('outcome');
    expect(ended.segments.map((s) => `${s.name}:${s.count}`)).toEqual([
      'In progress:1',
      'Offer:1',
      'Rejected:2',
    ]);
    expect(ended.reached).toBe(4);
  });

  it('is empty, not broken, when nothing has rounds yet', () => {
    expect(roundSummary([app('Submitted')])).toEqual({ total: 0, rows: [] });
  });
});
