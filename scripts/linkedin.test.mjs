import { describe, expect, test } from 'vitest';
import { offsiteApplyUrl } from '../extension/linkedin.js';

describe('offsiteApplyUrl', () => {
  test('reads the employer link from the escaped JSON a posting page embeds', () => {
    // The shape LinkedIn served on 2026-11-18, quotes and & escaped in place.
    const html =
      'x{\\"offsiteApplyUrl\\":\\"https://www.tesla.com/careers/search/job/282286?source=LinkedIn\\u0026source=LinkedIn\\",\\"isProfileSharedWithJobPoster\\":false}';
    expect(offsiteApplyUrl(html)).toBe(
      'https://www.tesla.com/careers/search/job/282286?source=LinkedIn&source=LinkedIn',
    );
  });

  test('reads it when the JSON is entity-encoded instead', () => {
    const html =
      '<code>{&quot;offsiteApplyUrl&quot;:&quot;https://jobs.acme.com/1?a=1&amp;b=2&quot;}</code>';
    expect(offsiteApplyUrl(html)).toBe('https://jobs.acme.com/1?a=1&b=2');
  });

  test('falls back to the safety redirect', () => {
    const html =
      '<a href="https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fwww%2Etesla%2Ecom%2Fcareers%2F282286&urlhash=9qp1">';
    expect(offsiteApplyUrl(html)).toBe('https://www.tesla.com/careers/282286');
  });

  test('is empty for an Easy Apply posting', () => {
    expect(offsiteApplyUrl('<html><title>Analyst | Acme | LinkedIn</title></html>')).toBe('');
  });
});
