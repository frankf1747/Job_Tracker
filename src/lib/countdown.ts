/**
 * The Overview countdown: what date it counts to, and how far away that is.
 *
 * The target is set by the user and stored with their account. When nothing is
 * set it falls back to Dec 11, rolling to next year once that passes, which is
 * what the countdown did before it was configurable.
 */

import { DAY } from './schema';

/** Month (0-based) and day of the fallback target. */
const DEFAULT_MONTH = 11;
const DEFAULT_DAY = 11;

/**
 * "2026-12-11" as local midnight, or null if it is not a real calendar date.
 *
 * Built from parts rather than `new Date(iso)`, which reads a bare date as UTC
 * midnight — the evening before, anywhere west of Greenwich — and would put the
 * countdown a day short.
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  // Date rolls an impossible day forward (Feb 30 -> Mar 2); that is not what
  // was asked for, so it is not a date.
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * The date to count down to.
 *
 * A date the user set is used as-is, even once it has passed: rolling it on to
 * next year would quietly invent a deadline they never chose. Only the fallback
 * rolls.
 */
export function resolveDeadline(today: Date, configured: string | null): Date {
  const set = parseIsoDate(configured);
  if (set) return set;
  const midnight = startOfDay(today);
  const thisYear = new Date(midnight.getFullYear(), DEFAULT_MONTH, DEFAULT_DAY);
  return thisYear < midnight
    ? new Date(midnight.getFullYear() + 1, DEFAULT_MONTH, DEFAULT_DAY)
    : thisYear;
}

/**
 * Whole days from the start of today to the target, split for display.
 *
 * Rounded rather than floored because a day across a clock change is 23 or 25
 * hours long. Never negative: a passed deadline reads as zero.
 */
export function countdown(
  today: Date,
  target: Date,
): { days: number; weeks: number; extra: number } {
  const days = Math.max(
    0,
    Math.round((startOfDay(target).getTime() - startOfDay(today).getTime()) / DAY),
  );
  return { days, weeks: Math.floor(days / 7), extra: days % 7 };
}
