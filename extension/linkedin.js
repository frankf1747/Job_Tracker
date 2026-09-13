/**
 * Reading a posting from its own page, in the service worker.
 *
 * Two constraints drive the string-first approach. A service worker has no DOM,
 * so there is no DOMParser to lean on. And parsing in the page instead is worse,
 * not better: LinkedIn enforces Trusted Types with its own sanitizer, which
 * strips <script> — so ld+json is invisible to any parse done inside the tab.
 *
 * `<title>` is the sturdiest field LinkedIn serves: "Position | Company |
 * LinkedIn", stable across redesigns because it is not markup structure.
 */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      const key = e.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return m;
    })
    .trim();
}

/** Markup to readable text, keeping the line breaks a description relies on. */
function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Every ld+json block on the page, flattened past arrays and @graph. */
function structuredData(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      out.push(...items);
    } catch {
      // A malformed block is skipped; the others are still worth having.
    }
  }
  return out;
}

function titleParts(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return { position: '', company: '' };
  // "Position | Company | LinkedIn" — drop the trailing brand segment.
  const parts = decodeEntities(m[1])
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts[parts.length - 1] === 'LinkedIn') parts.pop();
  return { position: parts[0] ?? '', company: parts[1] ?? '' };
}

function placeOf(jobLocation) {
  const first = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  const a = first?.address;
  if (!a) return '';
  return [a.addressLocality, a.addressRegion || a.addressCountry].filter(Boolean).join(', ');
}

/**
 * Fields for a posting, read from its own page.
 *
 * Never throws: enrichment is an improvement on what the page already gave us,
 * so a failure here must not cost the user the capture.
 */
export async function fetchJobDetails(jobId) {
  try {
    const res = await fetch(`https://www.linkedin.com/jobs/view/${jobId}/`, {
      credentials: 'include',
    });
    if (!res.ok) return { ok: false, reason: `status ${res.status}` };
    const html = await res.text();

    const { position, company } = titleParts(html);
    const job = structuredData(html).find((x) => x && x['@type'] === 'JobPosting');

    return {
      ok: true,
      // Which branch actually produced the description, so the first live run
      // tells us what LinkedIn is really serving.
      via: job ? 'ld+json' : 'title-only',
      position: position || job?.title || '',
      company: company || job?.hiringOrganization?.name || '',
      location: placeOf(job?.jobLocation),
      description: job?.description ? htmlToText(job.description) : '',
      postedNote: job?.datePosted || '',
      htmlChars: html.length,
    };
  } catch (err) {
    return { ok: false, reason: err.message || String(err) };
  }
}
