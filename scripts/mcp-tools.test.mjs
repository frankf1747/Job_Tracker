import { describe, expect, it } from 'vitest';
import { ROUND_TYPES as APP_ROUND_TYPES, reachedFrom } from '../src/lib/schema';
import {
  ROUND_TYPES,
  STATUSES,
  overview,
  planUpdate,
  queueDetail,
  queueLine,
  searchQuery,
} from './mcp-tools.mjs';

const app = (over = {}) => ({
  id: 'a1',
  company: 'Acme',
  position: 'Data Analyst',
  status: 'Submitted',
  reached: 0,
  applied_on: '2026-10-01',
  notes: '',
  rounds: [],
  ...over,
});

describe('planUpdate', () => {
  it('sets reached the way the app does for every status and starting stage', () => {
    for (const status of STATUSES) {
      for (const current of [0, 1, 2, 3]) {
        const { fields } = planUpdate(app({ reached: current }), { status }, '2026-10-30');
        expect(fields.reached, `${status} from ${current}`).toBe(reachedFrom(status, current));
      }
    }
  });

  it('keeps reached on a rejection, so a boilerplate "thanks for interviewing" stays at the resume screen', () => {
    const { fields } = planUpdate(app({ reached: 0 }), { status: 'Rejected' }, '2026-10-30');
    expect(fields).toEqual({ status: 'Rejected', reached: 0 });
  });

  it('appends to notes with the date, never replacing them', () => {
    const { fields } = planUpdate(
      app({ notes: 'Referred by Priya.' }),
      { notes_append: 'Rejection email.' },
      '2026-10-30',
    );
    expect(fields.notes).toBe('Referred by Priya.\n2026-10-30: Rejection email.');
    expect(planUpdate(app(), { notes_append: 'First note.' }, '2026-10-30').fields.notes).toBe(
      '2026-10-30: First note.',
    );
  });

  it('appends a round and refuses an unknown round type or a bad date', () => {
    const { fields } = planUpdate(
      app({ rounds: [{ type: 'HR / Recruiter' }] }),
      { round: { type: 'Technical', date: '2026-11-03' } },
      '2026-10-30',
    );
    expect(fields.rounds).toEqual([
      { type: 'HR / Recruiter' },
      { type: 'Technical', date: '2026-11-03' },
    ]);
    expect(() => planUpdate(app(), { round: { type: 'Vibe check' } }, '2026-10-30')).toThrow(
      /round type/,
    );
    expect(() =>
      planUpdate(app(), { round: { type: 'Technical', date: 'next Tuesday' } }, '2026-10-30'),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('refuses an unknown status, a reached outside 0 to 3, and an update with nothing in it', () => {
    expect(() => planUpdate(app(), { status: 'Hired' }, '2026-10-30')).toThrow(/status/);
    expect(() => planUpdate(app(), { reached: 4 }, '2026-10-30')).toThrow(/reached/);
    expect(() => planUpdate(app(), {}, '2026-10-30')).toThrow(/nothing to change/);
  });

  it('lets an explicit reached override the one the status implies', () => {
    const { fields } = planUpdate(
      app({ reached: 0 }),
      { status: 'Rejected', reached: 2 },
      '2026-10-30',
    );
    expect(fields).toEqual({ status: 'Rejected', reached: 2 });
  });

  it('round types match the app', () => {
    expect(ROUND_TYPES).toEqual([...APP_ROUND_TYPES]);
  });
});

describe('searchQuery', () => {
  it('filters on text, status and dates, newest first, with a capped limit', () => {
    const q = new URLSearchParams(
      searchQuery({
        query: 'acme',
        status: 'Interview',
        since: '2026-09-01',
        until: '2026-10-31',
        limit: 500,
      }),
    );
    expect(q.get('or')).toBe('(company.ilike.*acme*,position.ilike.*acme*,industry.ilike.*acme*)');
    expect(q.get('status')).toBe('eq.Interview');
    expect(q.getAll('applied_on')).toEqual(['gte.2026-09-01', 'lte.2026-10-31']);
    expect(q.get('order')).toBe('applied_on.desc');
    expect(q.get('limit')).toBe('100');
  });

  it('strips characters that would break the PostgREST filter', () => {
    const q = new URLSearchParams(searchQuery({ query: 'a,b)(c*' }));
    expect(q.get('or')).toBe(
      '(company.ilike.*a b c*,position.ilike.*a b c*,industry.ilike.*a b c*)',
    );
  });
});

describe('overview', () => {
  it('counts statuses, the funnel by reached, and applications per month', () => {
    const rows = [
      app({ status: 'Submitted', reached: 0, applied_on: '2026-09-02' }),
      app({ status: 'Rejected', reached: 0, applied_on: '2026-09-20' }),
      app({ status: 'Rejected', reached: 2, applied_on: '2026-10-05' }),
      app({ status: 'Interview', reached: 2, applied_on: '2026-10-07' }),
      app({ status: 'Offer', reached: 3, applied_on: '2026-10-09' }),
    ];
    const o = overview(rows);
    expect(o.total).toBe(5);
    expect(o.byStatus).toEqual({
      Submitted: 1,
      OA: 0,
      Interview: 1,
      Offer: 1,
      Rejected: 2,
      Ghosted: 0,
    });
    // Reached at least each stage: everyone applied, 3 got past the screen to OA or beyond, 3 interviewed, 1 offer.
    expect(o.funnel).toEqual({ applied: 5, oa: 3, interview: 3, offer: 1 });
    expect(o.byMonth).toEqual({ '2026-09': 2, '2026-10': 3 });
  });
});

describe('queue formatting', () => {
  const queued = (over = {}) => ({
    id: '11111111-2222-3333-4444-555555555555',
    company: 'Acme',
    position: 'Supply Chain Analyst',
    location_raw: 'San Jose, CA',
    job_url: 'https://www.linkedin.com/jobs/view/1/',
    created_at: '2026-11-13T10:00:00Z',
    fit_score: 0,
    scored_at: null,
    description: 'Build SQL reports.',
    ...over,
  });
  const noFacts = { yearsFloor: null, softFloor: null, salary: null, location: null, authorization: null, systems: [] };

  it('lists the queue id, and says unscored instead of the generated 0', () => {
    const line = queueLine(queued());
    expect(line).toContain('(queue id 11111111-2222-3333-4444-555555555555)');
    expect(line).toContain('· unscored');
    expect(line).not.toContain('fit 0');
  });

  it('shows the stored score and decision once scored', () => {
    const line = queueLine(queued({ scored_at: '2026-11-13', fit_score: 72, fit_decision: 'tailor', fit_reason: 'Pharma supply chain' }));
    expect(line).toContain('· fit 72 tailor');
    expect(line).toContain('\n    Pharma supply chain');
  });

  it('returns the description, capped, with the gate facts', () => {
    const out = queueDetail(queued({ description: 'x'.repeat(50) }), { ...noFacts, yearsFloor: 5, salary: { min: 90000, max: 120000 } }, 'years', 20);
    expect(out).toContain('Job description (first 20 of 50 characters):\n' + 'x'.repeat(20));
    expect(out).toContain('Gate: years');
    expect(out).toContain('Years floor: 5');
    expect(out).toContain('Salary band: $90K-$120K');
    expect(out).toContain('Triage: unscored');
  });

  it('breaks a stored score into its rubric parts', () => {
    const out = queueDetail(
      queued({ scored_at: '2026-11-13', fit_problem: 30, fit_skills: 20, fit_experience: 15, fit_score: 65, fit_decision: 'general', resume_target: 'operations' }),
      noFacts,
      null,
      6000,
    );
    expect(out).toContain('Triage: 65/100 (problem 30/45, skills 20/30, experience 15/25) · general · resume operations');
    expect(out).toContain('Gate: none fired');
    expect(out).toContain('Build SQL reports.');
  });
});
