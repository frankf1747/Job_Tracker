/**
 * Interview rounds, and the summary drawn from them.
 *
 * Each application records its rounds in order: round 1 HR, round 2 hiring
 * manager, round 3 panel. The summary counts what happened at each round
 * number and how the applications ended.
 *
 * Pure: the component only draws what this returns.
 */

import { ROUND_TYPES, type Round, type RoundType, type Status } from './schema';

export const OUTCOMES = ['In progress', 'Offer', 'Rejected', 'Ghosted'] as const;
export type Outcome = (typeof OUTCOMES)[number];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rounds as stored, read defensively. The column is JSON, so a malformed entry
 * is dropped rather than allowed to break the row or the chart.
 */
export function sanitizeRounds(raw: unknown): Round[] {
  if (!Array.isArray(raw)) return [];
  const out: Round[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const { type, label, date } = r as Record<string, unknown>;
    if (!ROUND_TYPES.includes(type as RoundType)) continue;
    const round: Round = { type: type as RoundType };
    if (typeof label === 'string' && label.trim()) round.label = label.trim();
    if (typeof date === 'string' && ISO.test(date)) round.date = date;
    out.push(round);
  }
  return out;
}

/** How an application ended, or that it has not yet. */
export function outcomeOf(status: Status): Outcome {
  if (status === 'Offer' || status === 'Rejected' || status === 'Ghosted') return status;
  return 'In progress';
}

export type SummaryRow = {
  /** "Round 1", "Round 2", … then "Ended". */
  label: string;
  kind: 'round' | 'outcome';
  /** How many applications got this far. */
  reached: number;
  /** Counts within the row, in process order, zeros omitted. */
  segments: { name: string; count: number }[];
};

export type RoundSummary = {
  /** Applications with at least one round; every bar is scaled to this. */
  total: number;
  rows: SummaryRow[];
};

/**
 * What happened at each round, and how it all ended.
 *
 * One row per round number, counting the types seen there, then a row of
 * outcomes. Every bar shares one scale, the number of applications with any
 * rounds, so a shorter bar for round 3 than round 1 is the drop-off itself.
 */
export function roundSummary(apps: { status: Status; rounds: Round[] }[]): RoundSummary {
  const withRounds = apps.filter((a) => a.rounds.length > 0);
  if (withRounds.length === 0) return { total: 0, rows: [] };

  const depth = Math.max(...withRounds.map((a) => a.rounds.length));
  const rows: SummaryRow[] = [];
  for (let i = 0; i < depth; i++) {
    const counts = new Map<string, number>();
    for (const a of withRounds) {
      const t = a.rounds[i]?.type;
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const segments = ROUND_TYPES.filter((t) => counts.has(t)).map((t) => ({
      name: t,
      count: counts.get(t)!,
    }));
    rows.push({
      label: `Round ${i + 1}`,
      kind: 'round',
      reached: segments.reduce((n, s) => n + s.count, 0),
      segments,
    });
  }

  const ends = new Map<Outcome, number>();
  for (const a of withRounds) {
    const o = outcomeOf(a.status);
    ends.set(o, (ends.get(o) ?? 0) + 1);
  }
  rows.push({
    label: 'Ended',
    kind: 'outcome',
    reached: withRounds.length,
    segments: OUTCOMES.filter((o) => ends.has(o)).map((o) => ({ name: o, count: ends.get(o)! })),
  });

  return { total: withRounds.length, rows };
}
