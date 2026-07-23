import { describe, expect, test } from 'vitest';
import { loggedAtOf } from './loggedAt';

/** Local-time epoch ms, so the assertions don't depend on the runner's zone. */
const at = (y: number, m: number, d: number, hh: number, mm: number) =>
  new Date(y, m - 1, d, hh, mm).getTime();

describe('loggedAtOf', () => {
  test('formats a 24-hour clock time, zero-padded', () => {
    expect(loggedAtOf(at(2026, 7, 22, 15, 28), '2026-07-22')?.time).toBe('15:28');
    expect(loggedAtOf(at(2026, 7, 22, 9, 5), '2026-07-22')?.time).toBe('09:05');
    expect(loggedAtOf(at(2026, 7, 22, 0, 0), '2026-07-22')?.time).toBe('00:00');
    expect(loggedAtOf(at(2026, 7, 22, 23, 59), '2026-07-22')?.time).toBe('23:59');
  });

  test('marks a row logged on the applied date', () => {
    expect(loggedAtOf(at(2026, 7, 22, 15, 28), '2026-07-22')?.sameDay).toBe(true);
  });

  test('still returns a time for a backdated row, flagged as another day', () => {
    // Previously this returned nothing, so the time vanished with no explanation.
    const l = loggedAtOf(at(2026, 7, 22, 15, 28), '2026-07-18');
    expect(l?.time).toBe('15:28');
    expect(l?.sameDay).toBe(false);
  });

  test('carries a date for the tooltip, so the real day is recoverable', () => {
    expect(loggedAtOf(at(2026, 7, 22, 15, 28), '2026-07-18')?.full).toBe('Jul 22, 15:28');
  });

  test('compares in local time, not UTC', () => {
    // 23:30 local on the 22nd is the 23rd in UTC; the applied date is local, so
    // comparing against a UTC date string would call this a different day.
    expect(loggedAtOf(at(2026, 7, 22, 23, 30), '2026-07-22')?.sameDay).toBe(true);
    expect(loggedAtOf(at(2026, 7, 22, 0, 30), '2026-07-22')?.sameDay).toBe(true);
  });

  test('pads single-digit months and days when comparing', () => {
    expect(loggedAtOf(at(2026, 3, 5, 12, 0), '2026-03-05')?.sameDay).toBe(true);
  });

  test('returns nothing when there is no timestamp to show', () => {
    expect(loggedAtOf(NaN, '2026-07-22')).toBeNull();
    expect(loggedAtOf(undefined as unknown as number, '2026-07-22')).toBeNull();
  });
});
