/**
 * Interview rounds, and the flow map drawn from them.
 *
 * Each application records its rounds in order: round 1 HR, round 2 hiring
 * manager, round 3 panel. The map follows every application from its first
 * round to how it ended. An ending sits in the column right after that
 * application's last round, so "rejected after one round" and "rejected after
 * three" are different places on the map, which is what shows where in the
 * process you tend to drop out.
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

export type FlowNode = {
  id: string;
  col: number;
  name: string;
  kind: 'round' | 'outcome';
  value: number;
  x: number;
  y: number;
  h: number;
};

export type FlowLink = {
  source: string;
  target: string;
  /** How the applications in this band ended; colours it. */
  outcome: Outcome;
  value: number;
  /** A closed band, ready for an SVG path's d attribute. */
  path: string;
  thickness: number;
};

export type RoundFlow = {
  /** Applications with at least one round. */
  total: number;
  /** Rounds plus the ending column. */
  cols: number;
  nodes: FlowNode[];
  links: FlowLink[];
};

export const NODE_WIDTH = 12;
const NODE_GAP = 10;

const order = (n: { kind: string; name: string }) =>
  n.kind === 'round'
    ? ROUND_TYPES.indexOf(n.name as RoundType)
    : ROUND_TYPES.length + OUTCOMES.indexOf(n.name as Outcome);

export function roundFlow(
  apps: { status: Status; rounds: Round[] }[],
  width: number,
  height: number,
): RoundFlow {
  const withRounds = apps.filter((a) => a.rounds.length > 0);
  if (withRounds.length === 0) return { total: 0, cols: 0, nodes: [], links: [] };

  const cols = Math.max(...withRounds.map((a) => a.rounds.length)) + 1;
  const nodeMap = new Map<string, FlowNode>();
  const linkMap = new Map<string, Omit<FlowLink, 'path' | 'thickness'>>();

  const node = (col: number, name: string, kind: FlowNode['kind']) => {
    const id = `${col}:${name}`;
    let n = nodeMap.get(id);
    if (!n) {
      n = { id, col, name, kind, value: 0, x: 0, y: 0, h: 0 };
      nodeMap.set(id, n);
    }
    n.value++;
    return n;
  };

  for (const a of withRounds) {
    const end = outcomeOf(a.status);
    const path = [
      ...a.rounds.map((r, i) => node(i, r.type, 'round')),
      node(a.rounds.length, end, 'outcome'),
    ];
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i].id}->${path[i + 1].id}|${end}`;
      const l = linkMap.get(key);
      if (l) l.value++;
      else linkMap.set(key, { source: path[i].id, target: path[i + 1].id, outcome: end, value: 1 });
    }
  }

  // Columns, each stacked in process order with endings beneath.
  const columns: FlowNode[][] = Array.from({ length: cols }, () => []);
  for (const n of nodeMap.values()) columns[n.col].push(n);
  for (const c of columns) c.sort((a, b) => order(a) - order(b));

  // One scale for every column, so a band's thickness means the same count
  // anywhere on the map: the tightest column decides it.
  const k = Math.min(
    ...columns
      .filter((c) => c.length)
      .map((c) => (height - NODE_GAP * (c.length - 1)) / c.reduce((sum, n) => sum + n.value, 0)),
  );

  const step = cols > 1 ? (width - NODE_WIDTH) / (cols - 1) : 0;
  for (const c of columns) {
    let y = 0;
    for (const n of c) {
      n.x = n.col * step;
      n.y = y;
      n.h = n.value * k;
      y += n.h + NODE_GAP;
    }
  }

  // Bands leave and arrive in an order that keeps them from crossing more than
  // they must: by the far end's position, then by outcome.
  const raw = [...linkMap.values()];
  const outRank = (o: Outcome) => OUTCOMES.indexOf(o);
  const nodeOf = (id: string) => nodeMap.get(id)!;
  const sy = new Map<FlowLink, number>();
  const ty = new Map<FlowLink, number>();
  const links: FlowLink[] = raw.map((l) => ({ ...l, path: '', thickness: l.value * k }));

  const stack = (
    group: (l: FlowLink) => string,
    far: (l: FlowLink) => FlowNode,
    into: Map<FlowLink, number>,
    start: (id: string) => number,
  ) => {
    const by = new Map<string, FlowLink[]>();
    for (const l of links) {
      const g = group(l);
      by.set(g, [...(by.get(g) ?? []), l]);
    }
    for (const [id, ls] of by) {
      ls.sort((a, b) => far(a).y - far(b).y || outRank(a.outcome) - outRank(b.outcome));
      let y = start(id);
      for (const l of ls) {
        into.set(l, y);
        y += l.thickness;
      }
    }
  };
  stack(
    (l) => l.source,
    (l) => nodeOf(l.target),
    sy,
    (id) => nodeOf(id).y,
  );
  stack(
    (l) => l.target,
    (l) => nodeOf(l.source),
    ty,
    (id) => nodeOf(id).y,
  );

  for (const l of links) {
    const x0 = nodeOf(l.source).x + NODE_WIDTH;
    const x1 = nodeOf(l.target).x;
    const xm = (x0 + x1) / 2;
    const a = sy.get(l)!;
    const b = ty.get(l)!;
    const t = l.thickness;
    l.path =
      `M${x0},${a}C${xm},${a} ${xm},${b} ${x1},${b}` +
      `L${x1},${b + t}C${xm},${b + t} ${xm},${a + t} ${x0},${a + t}Z`;
  }

  return { total: withRounds.length, cols, nodes: columns.flat(), links };
}
