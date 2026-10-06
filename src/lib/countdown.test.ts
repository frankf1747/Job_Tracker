import { describe, expect, it } from 'vitest';
import { countdown, parseIsoDate, resolveDeadline } from './countdown';

describe('parseIsoDate', () => {
  it('reads a date as local midnight, not UTC', () => {
    // new Date('2026-12-11') is UTC midnight — Dec 10 in California — which
    // would put the countdown a day short.
    const d = parseIsoDate('2026-12-11');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(11);
    expect(d?.getHours()).toBe(0);
  });

  it('rejects anything that is not a real calendar date', () => {
    expect(parseIsoDate('2026-02-30')).toBe(null);
    expect(parseIsoDate('12/11/2026')).toBe(null);
    expect(parseIsoDate('')).toBe(null);
    expect(parseIsoDate(null)).toBe(null);
  });
});

describe('resolveDeadline', () => {
  const today = new Date(2026, 9, 6); // Oct 6, 2026

  it('uses the date you set', () => {
    const d = resolveDeadline(today, '2027-03-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 2, 1]);
  });

  it('falls back to Dec 11 when nothing is set', () => {
    const d = resolveDeadline(today, null);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 11]);
  });

  it('rolls the default to next year once Dec 11 has passed', () => {
    const d = resolveDeadline(new Date(2026, 11, 20), null);
    expect(d.getFullYear()).toBe(2027);
  });

  it('does not roll a date you set — a passed deadline stays passed', () => {
    const d = resolveDeadline(new Date(2026, 11, 20), '2026-12-11');
    expect(d.getFullYear()).toBe(2026);
  });

  it('ignores a malformed stored value rather than counting to nothing', () => {
    const d = resolveDeadline(today, 'garbage');
    expect([d.getMonth(), d.getDate()]).toEqual([11, 11]);
  });
});

describe('countdown', () => {
  it('splits the remaining days into weeks and days', () => {
    expect(countdown(new Date(2026, 9, 6), new Date(2026, 11, 11))).toEqual({
      days: 66,
      weeks: 9,
      extra: 3,
    });
  });

  it('counts from the start of today, whatever the time', () => {
    const late = new Date(2026, 9, 6, 23, 59);
    expect(countdown(late, new Date(2026, 9, 7)).days).toBe(1);
  });

  it('survives the clocks changing', () => {
    // Nov 1 2026 is the US fall-back; a day there is 25 hours long.
    expect(countdown(new Date(2026, 9, 31), new Date(2026, 10, 2)).days).toBe(2);
  });

  it('stops at zero once the date has passed', () => {
    expect(countdown(new Date(2026, 11, 20), new Date(2026, 11, 11))).toEqual({
      days: 0,
      weeks: 0,
      extra: 0,
    });
  });
});
