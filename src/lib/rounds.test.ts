import { describe, expect, it } from 'vitest';
import { outcomeOf, roundFlow, sanitizeRounds } from './rounds';
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

describe('roundFlow', () => {
  const rows = [
    app('Rejected', 'HR / Recruiter'),
    app('Offer', 'HR / Recruiter', 'Hiring Manager', 'Panel / Final'),
    app('Rejected', 'HR / Recruiter', 'Hiring Manager'),
    app('Interview', 'Hiring Manager'),
    app('Submitted'), // no rounds: not part of the map
  ];
  const flow = roundFlow(rows, 600, 300);

  it('counts only applications that have rounds', () => {
    expect(flow.total).toBe(4);
  });

  it('puts each ending in the column right after the last round', () => {
    // So "rejected after one round" and "rejected after two" are different
    // places on the map, which is what shows where you drop out.
    const ended = flow.nodes.filter((n) => n.kind === 'outcome');
    const where = ended.map((n) => `${n.col}:${n.name}:${n.value}`).sort();
    expect(where).toEqual(['1:In progress:1', '1:Rejected:1', '2:Rejected:1', '3:Offer:1']);
  });

  it('counts every round node by type within its column', () => {
    const r = (col: number, name: string) =>
      flow.nodes.find((n) => n.col === col && n.name === name)?.value;
    expect(r(0, 'HR / Recruiter')).toBe(3);
    expect(r(0, 'Hiring Manager')).toBe(1);
    expect(r(1, 'Hiring Manager')).toBe(2);
    expect(r(2, 'Panel / Final')).toBe(1);
  });

  it('conserves flow: what enters a round node leaves it', () => {
    for (const n of flow.nodes.filter((x) => x.kind === 'round' && x.col > 0)) {
      const into = flow.links.filter((l) => l.target === n.id).reduce((a, l) => a + l.value, 0);
      const out = flow.links.filter((l) => l.source === n.id).reduce((a, l) => a + l.value, 0);
      expect(into).toBe(n.value);
      expect(out).toBe(n.value);
    }
  });

  it('splits each link by how the application ended, for colouring', () => {
    const fromHr = flow.links.filter(
      (l) => l.source === '0:HR / Recruiter' && l.target === '1:Hiring Manager',
    );
    expect(fromHr.map((l) => `${l.outcome}:${l.value}`).sort()).toEqual(['Offer:1', 'Rejected:1']);
  });

  it('stacks round types in process order and endings after them', () => {
    const col1 = flow.nodes.filter((n) => n.col === 1).map((n) => n.name);
    expect(col1).toEqual(['Hiring Manager', 'In progress', 'Rejected']);
  });

  it('keeps every node inside the drawing area', () => {
    for (const n of flow.nodes) {
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h).toBeLessThanOrEqual(300 + 1e-6);
      expect(n.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('is empty, not broken, when nothing has rounds yet', () => {
    const none = roundFlow([app('Submitted')], 600, 300);
    expect(none).toMatchObject({ total: 0, nodes: [], links: [] });
  });
});
