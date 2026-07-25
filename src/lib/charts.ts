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
];

const STAGE_FILLS = ['#41678a', '#7195b2', '#a5bfd2'];
/** The combined rejected + ghosted row — a negative outcome, so a muted clay. */
const CLOSED_FILL = '#c08575';
const CLOSED_ACTIVE = '#8f4636';

export type FunnelStage = {
  /** Display label — a status name, or "Rejected + Ghosted" for the closed row. */
  key: string;
  /** `reached` index for a progression row; -1 for the combined closed row. */
  stage: number;
  count: number;
  /** Bar width as a percentage of the widest stage. */
  width: number;
  /** Conversion from the previous stage, or share of all for the closed row. */
  conv: string;
  fill: string;
  labelColor: string;
  active: boolean;
};

export function funnelStages(d: Derived, filter: Filter): FunnelStage[] {
  const base = Math.max(1, d.ge(0));
  const barWidth = (count: number) => Math.max(count > 0 ? 4 : 0, Math.round((count / base) * 100));
  let prev: number | null = null;

  const stages: FunnelStage[] = STAGE_DEFS.map(([key, idx], i) => {
    const count = d.ge(idx);
    const conv = prev == null ? '100%' : (prev ? Math.round((count / prev) * 100) : 0) + '%';
    prev = count;
    const active = filter.stage === idx;

    return {
      key,
      stage: idx,
      count,
      // Keep a sliver visible for non-zero stages that would otherwise round to 0.
      width: barWidth(count),
      conv,
      fill: active ? '#2c4a66' : STAGE_FILLS[i],
      labelColor: active ? '#2c4a66' : '#37414c',
      active,
    };
  });

  // In place of the Offer stage: how many applications are done — rejected or
  // ghosted — as a share of everything submitted. A stage of -1 marks it as an
  // outcome total rather than a point on the progression.
  const closed = d.byStatus.Rejected + d.byStatus.Ghosted;
  const closedActive = filter.statuses.includes('Rejected') && filter.statuses.includes('Ghosted');
  stages.push({
    key: 'Rejected + Ghosted',
    stage: -1,
    count: closed,
    width: barWidth(closed),
    conv: Math.round((closed / base) * 100) + '% of all',
    fill: closedActive ? CLOSED_ACTIVE : CLOSED_FILL,
    labelColor: closedActive ? CLOSED_ACTIVE : '#37414c',
    active: closedActive,
  });

  return stages;
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

export type MomentumBar = { h: number; count: number; fill: string; label: string };

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
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Applications per day over the last seven days, including today.
 *
 * Buckets on the applied date rather than when the row was logged, matching the
 * weekly view: backfilling yesterday's application should land on yesterday.
 */
export function dailyMomentum(allRows: Application[], now: Date): Momentum {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = new Array(7).fill(0);

  for (const r of allRows) {
    // Rounded, not floored: clocks change, and a 23- or 25-hour day would
    // otherwise push a row into the neighbouring bucket.
    const d = Math.round((midnight - r.appliedTs) / DAY);
    if (d >= 0 && d < 7) days[d]++;
  }

  const max = Math.max(1, ...days);
  const bars = days
    .map((c, i) => {
      const date = new Date(midnight - i * DAY);
      return {
        h: Math.round((c / max) * 100),
        count: c,
        fill: i === 0 ? '#41678a' : '#b9cbd9',
        label: i === 0 ? 'today' : WEEKDAYS[date.getDay()],
      };
    })
    .reverse();

  const today = days[0];
  const d = today - days[1];
  return {
    bars,
    thisWeek: today,
    deltaLabel:
      d > 0
        ? '\u25b2 ' + d + ' more than yesterday'
        : d < 0
          ? '\u25bc ' + Math.abs(d) + ' fewer than yesterday'
          : '= same as yesterday',
    deltaColor: d > 0 ? '#3f7292' : d < 0 ? '#b3653f' : '#9aa4ad',
  };
}

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
      count: c,
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

export type HourBar = {
  /** 0–23, local time. */
  hour: number;
  count: number;
  /** Height as a percentage of the busiest hour, for the bar chart. */
  h: number;
  /** Only under the axis ticks, so 24 bars don't turn into a wall of text. */
  label: string;
  peak: boolean;
};

export type HourStats = {
  bars: HourBar[];
  /** Null until there is anything to summarise. */
  peakHour: number | null;
  peakCount: number;
  total: number;
  /** "Most often around 9pm", or an invitation to keep going. */
  caption: string;
};

/** 12-hour clock, the way the caption reads it aloud: 0 -> 12am, 13 -> 1pm. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

/**
 * When applications actually get added, by hour of the local day.
 *
 * Reads `createdAt` rather than `applied`: the applied date is user-editable
 * and carries no time, while createdAt is stamped by the database when the row
 * is saved. That makes this a record of when the work happened, not of when the
 * user says it happened.
 */
export function hourHistogram(rows: Application[]): HourStats {
  const counts = new Array(24).fill(0) as number[];
  let total = 0;

  for (const r of rows) {
    if (!Number.isFinite(r.createdAt)) continue;
    const h = new Date(r.createdAt).getHours();
    if (h >= 0 && h < 24) {
      counts[h]++;
      total++;
    }
  }

  const peakCount = Math.max(0, ...counts);
  // A tie resolves to the earlier hour, and no data leaves no peak at all
  // rather than falsely crowning midnight.
  const peakHour = peakCount > 0 ? counts.indexOf(peakCount) : null;

  const bars = counts.map((count, hour) => ({
    hour,
    count,
    h: peakCount > 0 ? Math.round((count / peakCount) * 100) : 0,
    label: hour % 6 === 0 ? hourLabel(hour) : '',
    peak: peakCount > 0 && count === peakCount,
  }));

  const caption =
    peakHour == null
      ? 'No applications logged yet.'
      : `Most often around ${hourLabel(peakHour)} — ${peakCount} of ${total}`;

  return { bars, peakHour, peakCount, total, caption };
}
