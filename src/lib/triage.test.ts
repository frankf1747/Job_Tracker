import { describe, expect, it } from 'vitest';
import { bandOf, gateLabel, groupQueue, sortQueue, targetLabel, type Triaged } from './triage';

/** A scored row; overrides say what the case under test is actually about. */
function job(over: Partial<Triaged> = {}): Triaged {
  return {
    fitScore: 60,
    decision: 'general',
    gate: null,
    scoredAt: 1_700_000_000_000,
    capturedAt: 1_700_000_000_000,
    ...over,
  };
}

describe('bandOf', () => {
  it('puts an unscored row in its own band rather than treating it as a zero', () => {
    expect(bandOf(job({ scoredAt: null, decision: null, fitScore: null }))).toBe('unscored');
  });

  it('reads the decision for a scored row', () => {
    expect(bandOf(job({ decision: 'tailor', fitScore: 88 }))).toBe('tailor');
    expect(bandOf(job({ decision: 'skip', fitScore: 30 }))).toBe('skip');
  });

  it('lets a gate beat a high score', () => {
    // The case worth pinning: a job can be an excellent fit and still be
    // unreachable, and the band has to say so rather than the score.
    expect(bandOf(job({ decision: 'tailor', fitScore: 88, gate: 'years' }))).toBe('blocked');
  });

  it('treats a scored row with no decision as unscored, not as a skip', () => {
    expect(bandOf(job({ decision: null, fitScore: 60 }))).toBe('unscored');
  });
});

describe('sortQueue', () => {
  it('orders bands first, then score, then most recently captured', () => {
    const rows = [
      job({ decision: 'skip', fitScore: 20 }),
      job({ decision: 'tailor', fitScore: 74 }),
      job({ decision: 'general', fitScore: 66 }),
      job({ decision: 'tailor', fitScore: 91 }),
      job({ scoredAt: null, decision: null, fitScore: null }),
      job({ decision: 'tailor', fitScore: 88, gate: 'salary' }),
    ];

    expect(sortQueue(rows).map((r) => [bandOf(r), r.fitScore])).toEqual([
      ['tailor', 91],
      ['tailor', 74],
      ['general', 66],
      ['unscored', null],
      ['skip', 20],
      ['blocked', 88],
    ]);
  });

  it('breaks a score tie with the newer capture', () => {
    const older = job({ decision: 'tailor', fitScore: 80, capturedAt: 1 });
    const newer = job({ decision: 'tailor', fitScore: 80, capturedAt: 2 });
    expect(sortQueue([older, newer])).toEqual([newer, older]);
  });

  it('does not mutate the array it is given', () => {
    const rows = [
      job({ decision: 'skip', fitScore: 10 }),
      job({ decision: 'tailor', fitScore: 90 }),
    ];
    const before = [...rows];
    sortQueue(rows);
    expect(rows).toEqual(before);
  });
});

describe('groupQueue', () => {
  it('returns every band, empty ones included, so counts can render unconditionally', () => {
    const grouped = groupQueue([job({ decision: 'tailor', fitScore: 90 })]);
    expect(Object.keys(grouped)).toEqual(['tailor', 'general', 'unscored', 'skip', 'blocked']);
    expect(grouped.tailor).toHaveLength(1);
    expect(grouped.skip).toEqual([]);
  });
});

describe('labels', () => {
  it('says why a gate fired in words a person can argue with', () => {
    expect(gateLabel('years')).toMatch(/years/i);
    expect(gateLabel('authorization')).toMatch(/sponsor/i);
  });

  it('names the resume rather than its slug', () => {
    expect(targetLabel('data')).toBe('Data');
    expect(targetLabel('insights')).toMatch(/Insights/);
  });
});
