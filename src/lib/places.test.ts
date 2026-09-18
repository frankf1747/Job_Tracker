import { describe, expect, it } from 'vitest';
import { parseLocation } from './places';

describe('parseLocation', () => {
  it('prefers the posting’s own labelled location line', () => {
    // fairlife states this near the end, under 7,000 characters of prose. The
    // old parser never reached it and returned a fragment of a bullet instead.
    expect(parseLocation('...\nposition location: Webster, NY\ntravel requirements: 15%')).toBe(
      'Webster, NY',
    );
  });

  it('rejects two capitals that are not a state', () => {
    // "Partner with engineering, IT and DI teams" was stored as a location,
    // because nothing checked that "IT" is a state.
    expect(
      parseLocation('Partner with engineering, IT and DI teams to identify new data points.'),
    ).toBe('');
  });

  it('expands a full state name', () => {
    expect(parseLocation('South San Francisco, California')).toBe('South San Francisco, CA');
    expect(parseLocation('Location\nHouston, Texas')).toBe('Houston, TX');
  });

  it('drops a trailing ZIP', () => {
    expect(parseLocation('Boston, Massachusetts, 02199-7')).toBe('Boston, MA');
  });

  it('tolerates a missing space after the comma', () => {
    expect(parseLocation('Location:\nSanta Clara,CA')).toBe('Santa Clara, CA');
  });

  it('returns nothing rather than prose when the label introduces a sentence', () => {
    // Every one of these was stored as a location by the old fallback.
    expect(
      parseLocation('Location: This role requires associates to be in-office 1 - 2 days per week.'),
    ).toBe('');
    expect(
      parseLocation('may vary based on the geographic location where the position is filled.'),
    ).toBe('');
  });

  it('does not read "remote" out of a company description', () => {
    // Octagos modernises *remote cardiac monitoring* and the job is in Houston.
    const posting = [
      'Octagos is modernizing remote cardiac monitoring with AI-powered automation.',
      'Position Location',
      'This is an in office position located in Houston, Texas.',
    ].join('\n');
    expect(parseLocation(posting)).toBe('Houston, TX');
  });

  it('still recognises a genuinely remote posting', () => {
    expect(parseLocation('This is a remote position. Candidates must reside in California.')).toBe(
      'Remote',
    );
    expect(parseLocation('Location\nRemote')).toBe('Remote');
  });

  it('takes the first of several offered locations', () => {
    expect(parseLocation('New York, NY, USA; Los Angeles, CA, USA; San Bruno, CA, USA')).toBe(
      'New York, NY',
    );
  });

  it('completes a bare city that can only mean one place', () => {
    expect(parseLocation('Location\nToronto')).toBe('Toronto, ON');
    expect(parseLocation('Location\nSalt Lake City')).toBe('Salt Lake City, UT');
  });

  it('handles Canadian provinces', () => {
    expect(parseLocation('Markham, ON')).toBe('Markham, ON');
    expect(parseLocation('Toronto, Ontario')).toBe('Toronto, ON');
  });

  it('does not treat a country as a city', () => {
    expect(parseLocation('Prime Video is hiring across the USA, CA and beyond.')).toBe('');
  });

  it('returns an empty string when the posting says nothing', () => {
    expect(parseLocation('We are a learning company that values curiosity.')).toBe('');
    expect(parseLocation('')).toBe('');
  });
});

describe('a list of states is not a city and a state', () => {
  it('rejects "California, Maryland"', () => {
    // Elevance names the two states its salary band covers. Read naively that
    // is a city in Maryland.
    expect(parseLocation('Location: California, Maryland')).toBe('');
  });

  it('rejects "New York, Texas, Pennsylvania"', () => {
    expect(
      parseLocation(
        'based out of one of our primary corporate offices in New York, Texas, Pennsylvania',
      ),
    ).toBe('');
  });

  it('still accepts a city that shares its name with its own state', () => {
    expect(parseLocation('New York, NY')).toBe('New York, NY');
    expect(parseLocation('Washington, DC')).toBe('Washington, DC');
  });
});
