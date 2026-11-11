import { describe, expect, test } from 'vitest';
import { blankDraft } from './parsePosting';
import { companyKey, learnedIndustry, withLearned } from './learned';

const past = [
  { company: 'Applied Materials, Inc.', industry: 'Hardware / Semiconductors' },
  { company: 'KLA', industry: 'Hardware / Semiconductors' },
  { company: 'KLA', industry: 'Technology / SaaS' },
  { company: 'Amazon', industry: 'E-commerce / Retail' },
];

describe('companyKey', () => {
  test('ignores case, punctuation and the legal suffix', () => {
    expect(companyKey('Applied Materials, Inc.')).toBe(companyKey('applied materials'));
    expect(companyKey('A.P. Moller - Maersk')).toBe('a p moller maersk');
  });

  test('keeps distinct companies distinct', () => {
    expect(companyKey('Amazon Web Services (AWS)')).not.toBe(companyKey('Amazon'));
  });
});

describe('learnedIndustry', () => {
  test('uses what was saved for the same company', () => {
    expect(learnedIndustry('Applied Materials', past)).toBe('Hardware / Semiconductors');
  });

  test('ties go to the most recent, which is listed first', () => {
    expect(learnedIndustry('KLA', past)).toBe('Hardware / Semiconductors');
  });

  test('knows nothing about a new company', () => {
    expect(learnedIndustry('Datadog', past)).toBe(null);
    expect(learnedIndustry('', past)).toBe(null);
  });
});

describe('withLearned', () => {
  const draft = { ...blankDraft(new Date()), company: 'Amazon', industry: 'Fintech' };

  test("replaces the parser's guess with the company's history", () => {
    expect(withLearned(draft, past).industry).toBe('E-commerce / Retail');
  });

  test("leaves the parser's guess for a new company", () => {
    expect(withLearned({ ...draft, company: 'Datadog' }, past).industry).toBe('Fintech');
  });
});
