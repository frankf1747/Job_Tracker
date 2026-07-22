/**
 * View-models for the funnel, momentum, and breakdown charts.
 *
 * These take rows plus the current filter and return plain data — shapes,
 * percentages, colours — with no React and no DOM, so each is unit-testable.
 */

import type { Application, Status } from './schema';
import { DAY, PIE_TINTS } from './schema';
import { pieArcs, type PieArc } from './derive';
import type { Derived, Filter } from './derive';

/** The four progressive funnel stages, paired with the `reached` value each implies. */
export const STAGE_DEFS: [Status, number][] = [
  ['Submitted', 0],
  ['OA', 1],
  ['Interview', 2],
  ['Offer', 3],
];

const STAGE_FILLS = ['#41678a', '#7195b2', '#a5bfd2', '#c19243'];

export type FunnelStage = {
  key: Status;
  stage: number;
  count: number;
  /** Bar width as a percentage of the widest stage. */
  width: number;
  /** Conversion from the previous stage. */
  conv: string;
  fill: string;
  labelColor: string;
  active: boolean;
};

export function funnelStages(d: Derived, filter: Filter): FunnelStage[] {
  const base = Math.max(1, d.ge(0));
  let prev: number | null = null;

  return STAGE_DEFS.map(([key, idx], i) => {
    const count = d.ge(idx);
    const width = Math.round((count / base) * 100);
    const conv = prev == null ? '100%' : (prev ? Math.round((count / prev) * 100) : 0) + '%';
    prev = count;
    const active = filter.stage === idx;

    return {
      key,
      stage: idx,
      count,
      // Keep a sliver visible for non-zero stages that would otherwise round to 0.
      width: Math.max(count > 0 ? 4 : 0, width),
      conv,
      fill: active ? '#2c4a66' : STAGE_FILLS[i],
      labelColor: active ? '#2c4a66' : '#37414c',
      active,
    };
  });
}

const EXIT_DEFS: [Status, string][] = [
  ['Rejected', '#a35242'],
  ['Ghosted', '#948e82'],
];

export type ExitStat = {
  key: Status;
  count: number;
  pct: string;
  fg: string;
  deco: string;
};

/** The two terminal outcomes, shown below the funnel rather than in it. */
export function exitStats(d: Derived, filter: Filter): ExitStat[] {
  return EXIT_DEFS.map(([key, fg]) => {
    const count = d.byStatus[key];
    const active = filter.statuses.indexOf(key) >= 0;
    return {
      key,
      count,
      pct: (d.total ? Math.round((count / d.total) * 100) : 0) + '%',
      fg: active ? '#2c3640' : fg,
      deco: active ? 'underline' : 'none',
    };
  });
}

export type MomentumBar = { h: number; fill: string; label: string };

export type Momentum = {
  bars: MomentumBar[];
  thisWeek: number;
  deltaLabel: string;
  deltaColor: string;
};

/**
 * Applications per week for the last eight weeks, oldest first.
 *
 * Deliberately computed over *all* rows rather than the filtered set: momentum
 * is about your overall pace, and it should not move when you filter the table.
 */
export function momentum(allRows: Application[], now: Date): Momentum {
  const weeks = new Array(8).fill(0);
  for (const r of allRows) {
    const wk = Math.floor((now.getTime() - r.appliedTs) / (7 * DAY));
    if (wk >= 0 && wk < 8) weeks[wk]++;
  }

  const maxWk = Math.max(1, ...weeks);
  const bars = weeks
    .map((c, i) => ({
      h: Math.round((c / maxWk) * 100),
      fill: i === 0 ? '#41678a' : '#b9cbd9',
      label: i === 0 ? 'now' : '-' + i,
    }))
    .reverse();

  const thisWeek = weeks[0];
  const wd = thisWeek - weeks[1];
  const deltaLabel =
    wd > 0
      ? '▲ ' + wd + ' more than last week'
      : wd < 0
        ? '▼ ' + Math.abs(wd) + ' fewer than last week'
        : '= same as last week';

  return {
    bars,
    thisWeek,
    deltaLabel,
    deltaColor: wd > 0 ? '#3f7292' : wd < 0 ? '#b3653f' : '#9aa4ad',
  };
}

export type BreakdownArc = PieArc & {
  name: string;
  count: number;
  /** True for the aggregated remainder slice, which isn't clickable. */
  other: boolean;
  nameColor: string;
  opacity: number;
};

/** Tally a field across rows, biggest first, with a rolled-up "Other" beyond `topN`. */
function tally(
  counts: Map<string, number>,
  topN: number,
): {
  items: { label: string; value: number; name: string; count: number; other: boolean }[];
  total: number;
} {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((t, [, c]) => t + c, 0);
  const top = sorted.slice(0, topN);
  const other = total - top.reduce((t, [, c]) => t + c, 0);

  const items = top.map(([name, count]) => ({
    label: name,
    value: count,
    name,
    count,
    other: false,
  }));
  if (other > 0)
    items.push({ label: 'Other', value: other, name: 'Other', count: other, other: true });

  return { items, total };
}

function toArcs(
  items: { label: string; value: number; name: string; count: number; other: boolean }[],
  total: number,
  selected: string[],
): BreakdownArc[] {
  return pieArcs(items, total, 82, 82, 80, PIE_TINTS).map((a, i) => {
    const meta = items[i];
    const sel = selected.indexOf(meta.name) >= 0;
    return {
      ...a,
      name: meta.name,
      count: meta.count,
      other: meta.other,
      color: meta.other ? '#d9d3c6' : sel ? '#2c4a66' : a.color,
      nameColor: sel ? '#2c4a66' : '#37414c',
      // Dim the unselected slices once any selection exists, so the choice reads.
      opacity: selected.length && !sel && !meta.other ? 0.4 : 1,
    };
  });
}

/** Share of skill *mentions* — a row with four skills contributes four. */
export function skillArcs(rows: Application[], selected: string[]): BreakdownArc[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const s of r.skills) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const { items, total } = tally(counts, 8);
  return toArcs(items, total, selected);
}

/** Share of applications — each row contributes exactly one. */
export function industryArcs(rows: Application[], selected: string[]): BreakdownArc[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.industry, (counts.get(r.industry) ?? 0) + 1);
  const { items, total } = tally(counts, 7);
  return toArcs(items, total, selected);
}

/** Summary of how well the rows could be placed on the map. */
export function mapCaption(rows: Application[]): string {
  const mapped = rows.filter((r) => r.loc.type === 'city' && r.loc.lat != null).length;
  const remote = rows.filter((r) => r.loc.type === 'remote').length;
  const unk = rows.filter(
    (r) => r.loc.type === 'unknown' || (r.loc.type === 'city' && r.loc.lat == null),
  ).length;
  const ca = rows.filter((r) => r.loc.country === 'CA').length;
  return `${mapped} mapped · ${remote} remote · ${unk} unspec · ${ca} in Canada`;
}
