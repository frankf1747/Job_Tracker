/** Calendar weeks run Monday to Sunday, in local time. */

import { DAY } from './schema';

/** Local midnight on the Monday that starts the Monday–Sunday week holding `d`. */
export function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

/**
 * Calendar weeks between the week holding `ts` and the week holding `now`:
 * 0 for this Monday–Sunday, 1 for last week. Counted in days and rounded, so a
 * 23- or 25-hour day across a clock change does not shift a row.
 */
export function weeksBack(ts: number, now: Date): number {
  const days = Math.round((mondayOf(now).getTime() - mondayOf(new Date(ts)).getTime()) / DAY);
  return days / 7;
}
