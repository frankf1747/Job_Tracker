import { describe, expect, test } from 'vitest';
import type { QueuedJob } from '../data/queue';
import { captureSources, draftFromQueued } from './queueDraft';

const job = (over: Partial<QueuedJob> = {}): QueuedJob =>
  ({
    id: 'q1',
    company: 'Patagonia',
    position: 'Supply Chain Data Analyst',
    location: 'Ventura, CA',
    jobUrl: 'https://www.linkedin.com/jobs/view/1',
    applyUrl: 'https://careers.patagonia.com/1',
    description: 'About the job\nDesign Tableau dashboards over Snowflake.',
    salary: '',
    reason: 'Snowflake, Tableau and KPI lineage are the BioMarin work.',
    ...over,
  }) as QueuedJob;

describe('promoting a queued job', () => {
  test('carries the captured description across, so deleting the queue row loses nothing', () => {
    const d = draftFromQueued(job(), new Date(2026, 9, 14));
    expect(d.description).toContain('Design Tableau dashboards over Snowflake.');
  });

  test('carries the triage verdict across', () => {
    expect(draftFromQueued(job(), new Date()).fitReason).toBe(
      'Snowflake, Tableau and KPI lineage are the BioMarin work.',
    );
  });

  test('stores nothing rather than the title-and-company stand-in when there was no capture', () => {
    // The parser is fed "position\ncompany" when the description is empty;
    // that stand-in must not be saved as if it were the posting.
    expect(draftFromQueued(job({ description: '' }), new Date()).description).toBe('');
  });

  test('still links to the employer page, not the aggregator', () => {
    expect(draftFromQueued(job(), new Date()).sourceUrl).toBe('https://careers.patagonia.com/1');
  });
});

describe('captureSources', () => {
  test('credits the capture with what the extension read, and the parser with the rest', () => {
    const src = captureSources(job({ salary: '' }));
    expect(src).toMatchObject({
      company: 'capture',
      position: 'capture',
      location: 'capture',
      salary: 'parser',
      skills: 'parser',
      industry: 'parser',
    });
  });

  test('a field the capture missed is blamed on the parser that filled it', () => {
    expect(captureSources(job({ location: '' })).location).toBe('parser');
  });
});
