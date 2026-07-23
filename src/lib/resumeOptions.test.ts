import { describe, expect, test } from 'vitest';
import { prettySize, resumeOptions } from './resumeOptions';
import { makeResume, type Resume } from '../data/resumeStore';

const list: Resume[] = [
  makeResume('General v4'),
  makeResume('Analytics v3'),
  makeResume('Analytics — Regeneron', true),
  makeResume('Ops — Vizient', true),
];

describe('resumeOptions', () => {
  test('offers only the reusable resumes', () => {
    expect(resumeOptions(list, 'General v4')).toEqual(['General v4', 'Analytics v3']);
  });

  test('keeps a tailored resume visible while it is the one selected', () => {
    // Otherwise opening that application would silently reassign its resume.
    expect(resumeOptions(list, 'Analytics — Regeneron')).toEqual([
      'Analytics — Regeneron',
      'General v4',
      'Analytics v3',
    ]);
  });

  test('keeps a resume that has since been deleted', () => {
    expect(resumeOptions(list, 'Gone v1')[0]).toBe('Gone v1');
  });

  test('adds nothing when nothing is selected', () => {
    expect(resumeOptions(list, '')).toEqual(['General v4', 'Analytics v3']);
  });

  test('a list of only tailored resumes offers just the current one', () => {
    const onlyTailored = [makeResume('One-off', true)];
    expect(resumeOptions(onlyTailored, 'One-off')).toEqual(['One-off']);
    expect(resumeOptions(onlyTailored, '')).toEqual([]);
  });
});

describe('prettySize', () => {
  test('scales the unit to the size', () => {
    expect(prettySize(512)).toBe('512 B');
    expect(prettySize(2048)).toBe('2 KB');
    expect(prettySize(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
