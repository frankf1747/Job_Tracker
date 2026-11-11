import { describe, expect, test } from 'vitest';
import { blankDraft, type Draft } from './parsePosting';
import { PARSER_VERSION, buildLogEntry, extracted, fieldChanged, siteOf } from './extractionLog';

const draft = (over: Partial<Draft> = {}): Draft => ({
  ...blankDraft(new Date(2026, 10, 11)),
  company: 'Applied Materials',
  position: 'Business Intelligence Analyst I',
  location: 'Santa Clara, CA',
  skills: ['SQL', 'Tableau', 'Python'],
  industry: 'Hardware / Semiconductors',
  level: 'New Grad',
  employmentType: 'Full-time',
  salary: '',
  sourceUrl: 'https://www.boards.greenhouse.io/amat/jobs/1',
  ...over,
});

describe('fieldChanged', () => {
  test('ignores whitespace', () => {
    expect(
      fieldChanged(
        'company',
        extracted(draft()),
        extracted(draft({ company: ' Applied  Materials ' })),
      ),
    ).toBe(false);
  });

  test('ignores the order and case of skills, but not a removed one', () => {
    const a = extracted(draft());
    expect(
      fieldChanged('skills', a, extracted(draft({ skills: ['python', 'SQL', 'Tableau'] }))),
    ).toBe(false);
    expect(fieldChanged('skills', a, extracted(draft({ skills: ['SQL', 'Python'] })))).toBe(true);
  });
});

describe('buildLogEntry', () => {
  test('logs a posting review with no corrections, since that is a hit', () => {
    const d = draft();
    const e = buildLogEntry({ origin: 'paste', proposed: extracted(d) }, d)!;
    expect(e.changed).toEqual([]);
    expect(e.parserVersion).toBe(PARSER_VERSION);
  });

  test('records exactly the fields that were corrected', () => {
    const proposed = extracted(draft({ company: 'Company (edit me)', skills: ['SQL', 'R'] }));
    const e = buildLogEntry({ origin: 'queue', proposed }, draft())!;
    expect(e.changed).toEqual(['company', 'skills']);
    expect(e.proposed.company).toBe('Company (edit me)');
    expect(e.saved.company).toBe('Applied Materials');
  });

  test('skips an edit that touched no extracted field', () => {
    const d = draft();
    expect(buildLogEntry({ origin: 'edit', proposed: extracted(d) }, { ...d, resume: 'v3' })).toBe(
      null,
    );
  });

  test('logs an edit that fixed a field later', () => {
    const e = buildLogEntry(
      { origin: 'edit', proposed: extracted(draft({ location: 'Santa Clara, CA (Hybrid)' })) },
      draft(),
    )!;
    expect(e.changed).toEqual(['location']);
  });

  test('carries the capture sources and the site the posting came from', () => {
    const e = buildLogEntry(
      { origin: 'queue', proposed: extracted(draft()), sources: { company: 'capture' } },
      draft(),
    )!;
    expect(e.sources).toEqual({ company: 'capture' });
    expect(e.site).toBe('boards.greenhouse.io');
  });

  test('a snapshot is not changed by later edits to the form', () => {
    const d = draft();
    const snap = extracted(d);
    d.skills.push('Excel');
    expect(snap.skills).toEqual(['SQL', 'Tableau', 'Python']);
  });
});

describe('siteOf', () => {
  test('is empty for something that is not a URL', () => {
    expect(siteOf('')).toBe('');
    expect(siteOf('not a url')).toBe('');
  });
});
