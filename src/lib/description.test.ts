import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The extension's description logic, tested against the text it actually
 * captured.
 *
 * `extension/description.js` is a classic content script — a manifest content
 * script cannot be an ES module, so it has no exports to import. It is written
 * without top-level side effects precisely so it can be evaluated here and its
 * pure functions exercised against real fixtures.
 */
const source = readFileSync(new URL('../../extension/description.js', import.meta.url), 'utf8');
const { isBoilerplate } = new Function(`${source}\nreturn { isBoilerplate };`)() as {
  isBoilerplate: (text: string) => boolean;
};

/** Verbatim openings of the ten captures that stored the wrong block. */
const WRONG = {
  'J&J employer panel':
    'Career growth and learning\nWe’re a learning company. By channeling our curiosity into continuous learning, we become more innovative and that changes patients’ lives.',
  'Amazon employer panel':
    'Career growth and learning\nWe offer a variety of career mobility and development opportunities that are designed to help employees move into higher-paying roles at Amazon or elsewhere.',
  'MSI premium insights':
    "Hiring & headcount\nSignificant growth in operations: The 'Operations' department has seen an 11% increase in employee count, indicating a major focus on expanding operational capabilities.",
  'Infor video chrome':
    'Video Player is loading.Play VideoPlaySkip BackwardSkip ForwardUnmuteCurrent Time 0:00/Duration 1:00Loaded: 6.61%0:00Stream Type LIVESeek to live, currently behind live',
  'Accenture company card':
    'Accenture\n15,086,912 followers\nFollow\nBusiness Consulting and Services\n • \n10001+ employees\n • \n599,818 on LinkedIn\nAccenture helps the world’s leading enterprises reinvent.',
  'Jacobs DEI panel':
    'Diversity, equity, and inclusion\nWe live inclusion. We put people at the heart of our business. We embrace all perspectives, collaborating to make a positive impact.',
};

/** Verbatim openings of captures that were correct, including the short ones. */
const RIGHT = {
  'fairlife, a long posting':
    'About the job\nfairlife, LLC is a Chicago-based nutrition company that creates great-tasting, nutrition-rich and dairy products to nourish consumers.',
  'DHL, a genuinely short posting':
    'About the job\nThe Operations Systems Analyst II (WMS Analyst II) role has a national salary range of $55,000 - $90,000.',
  'Sutter Health, also short':
    'About the job\nWe are so glad you are interested in joining Sutter Health!\nOrganization\nSHSO-Sutter Health System Office-Valley\nPosition Overview',
  'a posting that happens to discuss growth':
    'About the job\nYou will drive career growth and learning across the analytics org, and report on headcount.',
};

describe('isBoilerplate', () => {
  for (const [name, text] of Object.entries(WRONG)) {
    it(`rejects the ${name}`, () => {
      expect(isBoilerplate(text)).toBe(true);
    });
  }

  for (const [name, text] of Object.entries(RIGHT)) {
    it(`keeps ${name}`, () => {
      expect(isBoilerplate(text)).toBe(false);
    });
  }

  it('matches only at the start, so a posting may discuss these topics freely', () => {
    // The last RIGHT fixture is the case that matters: the words appear, but
    // not as the panel heading that opens the block.
    expect(isBoilerplate('About the job\nCareer growth and learning is a pillar here.')).toBe(
      false,
    );
  });

  it('treats empty text as nothing to reject', () => {
    expect(isBoilerplate('')).toBe(false);
  });
});
