import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPONSORSHIP_FIXTURES } from './sponsorship-fixtures.mjs';

/**
 * extension/detect.js is a classic content script with no exports — a manifest
 * content script cannot be an ES module — so it is evaluated here. It has no
 * top-level side effects, which is what makes that safe.
 */
const source = readFileSync(new URL('../extension/detect.js', import.meta.url), 'utf8');
const { detectSponsorship } = new Function(`${source}\nreturn { detectSponsorship };`)();

describe('detectSponsorship', () => {
  for (const f of SPONSORSHIP_FIXTURES) {
    it(`reads ${f.name} as ${JSON.stringify(f.sponsors)}`, () => {
      expect(detectSponsorship(f.text)).toBe(f.sponsors);
    });
  }

  it('never reads the candidate needing sponsorship as the employer offering it', () => {
    // "...who **will** require in the future, **sponsor**ship" matched the
    // offer pattern, so a refusal was reported as a yes.
    expect(detectSponsorship('candidates who will require sponsorship need not apply')).not.toBe(
      'yes',
    );
  });
});
