import { describe, expect, test } from 'vitest';
import { normalizeLoc } from '../src/lib/locations';
import {
  fieldMatches,
  hasHeader,
  salaryKey,
  score,
  skillDiff,
  skillTrouble,
  textKey,
} from './extraction-score.mjs';

describe('matching a proposed value to the saved one', () => {
  test('company ignores case, punctuation and a legal suffix', () => {
    expect(textKey('Applied Materials, Inc.')).toBe(textKey('applied materials'));
    expect(textKey('Cosette Pharmaceuticals, Inc.')).toBe('cosette pharmaceuticals');
    expect(fieldMatches('company', 'BCG', 'BCGx', normalizeLoc)).toBe(false);
  });

  test('location compares places, not spellings', () => {
    expect(
      fieldMatches('location', 'Santa Clara, California', 'Santa Clara, CA', normalizeLoc),
    ).toBe(true);
    expect(fieldMatches('location', 'Remote - US', 'Remote', normalizeLoc)).toBe(true);
    expect(fieldMatches('location', 'Austin, TX', 'Seattle, WA', normalizeLoc)).toBe(false);
    expect(fieldMatches('location', '', 'Seattle, WA', normalizeLoc)).toBe(false);
  });

  test('salary compares the numbers', () => {
    expect(salaryKey('$90K – $110K')).toBe(salaryKey('$90k - $110k'));
    expect(fieldMatches('salary', '', '', normalizeLoc)).toBe(true);
  });

  test('skills must agree as sets', () => {
    expect(fieldMatches('skills', ['SQL', 'Python'], ['python', 'SQL'], normalizeLoc)).toBe(true);
    expect(skillDiff(['SQL', 'R'], ['SQL', 'Tableau'])).toEqual({
      extra: ['R'],
      missing: ['Tableau'],
      kept: ['SQL'],
    });
  });
});

describe('score', () => {
  const pairs = [
    {
      id: 'a',
      proposed: { level: 'Intern', skills: ['SQL', 'Excel'] },
      saved: { level: 'Intern', skills: ['SQL'] },
    },
    {
      id: 'b',
      proposed: { level: 'Senior', skills: ['SQL', 'Excel'] },
      saved: { level: 'New Grad', skills: ['SQL', 'Power BI'] },
    },
    {
      id: 'c',
      proposed: { level: 'Intern', skills: ['Excel'] },
      saved: { level: 'Intern', skills: ['Power BI'] },
    },
  ];

  test('counts hits per field and keeps the misses', () => {
    const { byField } = score(pairs, normalizeLoc, ['level', 'skills']);
    expect(byField.level).toMatchObject({ n: 3, hit: 2 });
    expect(byField.level.misses).toEqual([
      { id: 'b', site: '', proposed: 'Senior', saved: 'New Grad' },
    ]);
    expect(byField.skills.hit).toBe(0);
  });

  test('skips fields a pair does not have', () => {
    expect(score(pairs, normalizeLoc, ['company']).byField.company.n).toBe(0);
  });

  test('finds skills that are often wrongly proposed or missed', () => {
    const { skills } = score(pairs, normalizeLoc, ['skills']);
    const t = skillTrouble(skills);
    expect(t.noisy.map((s) => s.name)).toEqual(['Excel']);
    expect(t.missed.map((s) => s.name)).toEqual(['Power BI']);
  });
});

describe('hasHeader', () => {
  test('finds the title or company near the top of a pasted page', () => {
    expect(
      hasHeader('Stripe\nData Analyst, Payments\nSeattle, WA', 'Stripe', 'Data Analyst, Payments'),
    ).toBe(true);
  });

  test("LinkedIn's captured body has no header, even when it names the company", () => {
    expect(
      hasHeader(
        'About the job\nAt Thermo Fisher Scientific, you will',
        'Thermo Fisher Scientific',
        'Analyst',
      ),
    ).toBe(false);
  });

  test('a body captured on its own has neither', () => {
    expect(
      hasHeader('Position Summary\nYou will build dashboards.', 'Walmart', 'Project Manager II'),
    ).toBe(false);
  });
});
