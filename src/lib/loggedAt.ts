import { MONTHS } from './schema';

const pad2 = (n: number) => String(n).padStart(2, '0');

export type LoggedAt = {
  /** 24-hour clock, e.g. "15:28". */
  time: string;
  /** Whether it was logged on the applied date itself. */
  sameDay: boolean;
  /** Date and time together, for the tooltip: "Jul 22, 15:28". */
  full: string;
};

/**
 * When a row was logged, for display beside the applied date.
 *
 * Always returned, even when the applied date was later changed to a different
 * day — a silently missing time reads as a bug. The `sameDay` flag lets the
 * caller mark the mismatch instead, so the number on screen is never a claim
 * about a day the application wasn't sent.
 *
 * Compared in local time throughout: `createdAt` is stored UTC but the applied
 * date is the user's own calendar day, and "which hour of my day" is the whole
 * point of recording it.
 */
export function loggedAtOf(createdAt: number, appliedIso: string): LoggedAt | null {
  if (!Number.isFinite(createdAt)) return null;
  const d = new Date(createdAt);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return {
    time,
    sameDay: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` === appliedIso,
    full: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`,
  };
}
