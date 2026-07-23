/**
 * Filtering, sorting, and aggregation over the in-memory application list.
 *
 * The app loads every row once and does all of this client-side; at a few
 * hundred rows that is far cheaper than round-tripping each filter change.
 */

import type { Application, Status } from './schema';
import { DAY, STATUSES, isResponse } from './schema';

export type Filter = {
  skills: string[];
  industries: string[];
  statuses: Status[];
  locations: string[];
  /** Minimum `reached` value, or null for no stage filter. */
  stage: number | null;
};

export const EMPTY_FILTER: Filter = {
  skills: [],
  industries: [],
  statuses: [],
  locations: [],
  stage: null,
};

export function hasFilter(f: Filter): boolean {
  return !!(
    f.skills.length ||
    f.industries.length ||
    f.statuses.length ||
    f.locations.length ||
    f.stage != null
  );
}

export function filterRows(rows: Application[], filter: Filter, search: string): Application[] {
  const q = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (q) {
      const hay = (r.company + ' ' + r.position + ' ' + r.loc.display).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    // Within a category the filter is OR; across categories it is AND.
    if (filter.skills.length && !filter.skills.some((s) => r.skills.indexOf(s) >= 0)) return false;
    if (filter.industries.length && filter.industries.indexOf(r.industry) < 0) return false;
    if (filter.statuses.length && filter.statuses.indexOf(r.status) < 0) return false;
    if (filter.locations.length && !(r.loc.key && filter.locations.indexOf(r.loc.key) >= 0)) {
      return false;
    }
    if (filter.stage != null && r.reached < filter.stage) return false;
    return true;
  });
}

export type SortKey = 'company' | 'position' | 'location' | 'applied' | 'status';
export type SortDir = 'asc' | 'desc';

export function sortRows(rows: Application[], sortKey: SortKey, sortDir: SortDir): Application[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  const val = (r: Application): string | number =>
    ({
      company: r.company.toLowerCase(),
      position: r.position.toLowerCase(),
      location: r.loc.display.toLowerCase(),
      applied: r.appliedTs,
      status: STATUSES.indexOf(r.status),
    })[sortKey];

  return rows.slice().sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;

    // Ties fall back to when the row was logged, which is what makes the sort
    // arrow do anything at all on a day's worth of applications: `applied` is a
    // date at midnight, so every row added the same day compares equal and the
    // list would never reorder. Same direction as the primary key, so a descending
    // sort puts the most recently logged first.
    if (a.createdAt !== b.createdAt) return (a.createdAt - b.createdAt) * dir;
    return 0;
  });
}

export type Derived = {
  total: number;
  byStatus: Record<Status, number>;
  /** How many applications reached at least stage `k`. */
  ge: (k: number) => number;
  responded: number;
  interviews: number;
  offers: number;
  thisWeek: number;
};

export function derive(rows: Application[], now: Date): Derived {
  const byStatus = {} as Record<Status, number>;
  for (const s of STATUSES) byStatus[s] = 0;
  for (const r of rows) byStatus[r.status]++;

  const ge = (k: number) => rows.filter((r) => r.reached >= k).length;

  return {
    total: rows.length,
    byStatus,
    ge,
    responded: rows.filter(isResponse).length,
    interviews: ge(2),
    offers: ge(3),
    thisWeek: rows.filter((r) => now.getTime() - r.appliedTs < 7 * DAY).length,
  };
}

export type PieItem = { label: string; value: number };
export type PieArc = PieItem & { d: string; pct: number; color: string };

/** Build SVG path data for a pie/donut, starting at 12 o'clock and going clockwise. */
export function pieArcs(
  items: PieItem[],
  total: number,
  cx: number,
  cy: number,
  r: number,
  tints: string[],
): PieArc[] {
  if (!total) return [];
  let a0 = -Math.PI / 2;
  const out: PieArc[] = [];

  items.forEach((it, i) => {
    const frac = it.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rr: number, a: number): [number, number] => [
      cx + rr * Math.cos(a),
      cy + rr * Math.sin(a),
    ];

    let d: string;
    if (frac >= 0.9999) {
      // A single arc can't express a full circle; nudge the endpoint so it closes.
      d = `M${cx} ${(cy - r).toFixed(2)} A${r} ${r} 0 1 1 ${(cx - 0.01).toFixed(2)} ${(cy - r).toFixed(2)} Z`;
    } else {
      const [x0, y0] = p(r, a0);
      const [x1, y1] = p(r, a1);
      d = `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    }

    out.push({ ...it, d, pct: Math.round(frac * 100), color: tints[i % tints.length] });
    a0 = a1;
  });

  return out;
}

/**
 * How many countdown ticks to draw so the strip never grows past `rows` rows.
 *
 * Derived from the measured width rather than a fixed cap, so a narrow column
 * clips sooner instead of pushing the panel taller than the one beside it.
 * Returns 0 before the width is known, so nothing flashes at the wrong size.
 */
export function pipsToDraw(
  days: number,
  width: number,
  size: number,
  gap: number,
  rows: number,
): number {
  if (width <= 0) return 0;
  const perRow = Math.max(1, Math.floor((width + gap) / (size + gap)));
  return Math.max(0, Math.min(days, perRow * rows));
}

export function isoOf(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

const MONTH_NUM: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/**
 * Parse the inline date editor's shorthand: "Jul 4", "0704", "704".
 * Returns an ISO date, or null when the text isn't a usable date.
 * The year comes from `oldIso` so editing a date never silently changes its year.
 */
export function parseMMDD(text: string, oldIso?: string): string | null {
  const t = (text || '').trim();
  if (!t) return null;

  let mo: number;
  let day: number;

  const m = t.toLowerCase().match(/([a-z]{3})[a-z]*\.?\s*(\d{1,2})/);
  if (m && MONTH_NUM[m[1]]) {
    mo = MONTH_NUM[m[1]];
    day = parseInt(m[2], 10);
  } else {
    const dg = t.replace(/[^0-9]/g, '');
    if (dg.length === 4) {
      mo = +dg.slice(0, 2);
      day = +dg.slice(2);
    } else if (dg.length === 3) {
      mo = +dg.slice(0, 1);
      day = +dg.slice(1);
    } else {
      return null;
    }
  }

  if (!(mo >= 1 && mo <= 12) || !(day >= 1 && day <= 31)) return null;

  const yr = oldIso ? oldIso.slice(0, 4) : String(new Date().getFullYear());
  return yr + '-' + String(mo).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
