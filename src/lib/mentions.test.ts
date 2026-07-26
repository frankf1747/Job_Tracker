import { describe, expect, test } from 'vitest';
import { mentionedNames, splitMentions } from './mentions';

const marks = (t: string) =>
  splitMentions(t)
    .filter((s) => s.mention)
    .map((s) => s.text);

describe('splitMentions', () => {
  test('highlights a two-word capitalised name', () => {
    expect(marks('reach out to @Kristen Lee about the role')).toEqual(['@Kristen Lee']);
  });

  test('stops the name at the first lowercase word', () => {
    // Otherwise the rest of the sentence gets swallowed into the mention.
    expect(marks('@Kristen called back yesterday')).toEqual(['@Kristen']);
  });

  test('accepts a lowercase first token', () => {
    expect(marks('ping @kristen tomorrow')).toEqual(['@kristen']);
  });

  test('finds several mentions in one note', () => {
    expect(marks('@Kristen Lee referred me to @Sam Ortiz in data')).toEqual([
      '@Kristen Lee',
      '@Sam Ortiz',
    ]);
  });

  test('a bare @ with no name is not a mention', () => {
    expect(marks('email me @ the address')).toEqual([]);
    expect(marks('@')).toEqual([]);
  });

  test('reconstructs the original text from its segments', () => {
    const t = 'talk to @Kristen Lee, then @Sam about referrals';
    expect(
      splitMentions(t)
        .map((s) => s.text)
        .join(''),
    ).toBe(t);
  });

  test('plain text with no mention is a single segment', () => {
    expect(splitMentions('just a note')).toEqual([{ text: 'just a note', mention: false }]);
  });
});

describe('mentionedNames', () => {
  test('lists distinct names without the @', () => {
    expect(mentionedNames('@Kristen Lee and @Sam and @Kristen Lee again')).toEqual([
      'Kristen Lee',
      'Sam',
    ]);
  });

  test('is empty when there are no mentions', () => {
    expect(mentionedNames('no contacts here')).toEqual([]);
  });
});
