import { describe, expect, test } from 'vitest';
import { USERNAME_DOMAIN, toAccountEmail } from './account';

describe('toAccountEmail', () => {
  test('expands a bare username against the no-mail domain', () => {
    expect(toAccountEmail('frank')).toBe(`frank@${USERNAME_DOMAIN}`);
  });

  test('uses a full address verbatim', () => {
    expect(toAccountEmail('me@example.com')).toBe('me@example.com');
  });

  test('normalises case and surrounding space, so sign-in is forgiving', () => {
    expect(toAccountEmail('  Frank  ')).toBe(`frank@${USERNAME_DOMAIN}`);
    expect(toAccountEmail('Me@Example.COM')).toBe('me@example.com');
  });

  test('empty input stays empty rather than becoming a bare domain', () => {
    // "@jobtracker.local" would be a syntactically odd address to send upstream.
    expect(toAccountEmail('')).toBe('');
    expect(toAccountEmail('   ')).toBe('');
  });
});
