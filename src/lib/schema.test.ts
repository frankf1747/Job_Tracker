import { describe, expect, test } from 'vitest';
import { reachedFor, reachedFrom } from './schema';

describe('reachedFrom', () => {
  test('progress statuses map to their stage from a fresh row', () => {
    expect(reachedFrom('Submitted', 0)).toBe(0);
    expect(reachedFrom('OA', 0)).toBe(1);
    expect(reachedFrom('Interview', 0)).toBe(2);
    expect(reachedFrom('Offer', 0)).toBe(3);
  });

  test('a terminal status does not fabricate progress', () => {
    // The reported bug: marking a just-submitted row Rejected credited it with
    // an OA, so the OA funnel bar jumped to 1.
    expect(reachedFrom('Rejected', 0)).toBe(0);
    expect(reachedFrom('Ghosted', 0)).toBe(0);
  });

  test('a terminal status preserves how far the row actually got', () => {
    // Rejected after an interview stays at Interview, so the funnel still shows
    // it reached OA and Interview.
    expect(reachedFrom('Rejected', 2)).toBe(2);
    expect(reachedFrom('Ghosted', 1)).toBe(1);
  });

  test('a progress status can walk reached back down', () => {
    // Setting a status is a correction, not only an advance — otherwise a
    // reached inflated by mistake could never be undone.
    expect(reachedFrom('OA', 2)).toBe(1);
    expect(reachedFrom('Submitted', 3)).toBe(0);
  });

  test('advancing raises reached to the new stage', () => {
    expect(reachedFrom('Interview', 1)).toBe(2);
    expect(reachedFrom('Offer', 2)).toBe(3);
  });

  test('a mistaken rejection can be undone via Submitted', () => {
    // The recovery path for a row wrongly left at reached 1 by the old bug.
    let reached = 1; // stale, saved before the fix
    reached = reachedFrom('Submitted', reached); // → 0
    reached = reachedFrom('Rejected', reached); // preserves 0
    expect(reached).toBe(0);
  });
});

describe('reachedFor', () => {
  test('is reachedFrom with no prior progress', () => {
    expect(reachedFor('OA')).toBe(1);
    expect(reachedFor('Rejected')).toBe(0);
    expect(reachedFor('Ghosted')).toBe(0);
  });
});
