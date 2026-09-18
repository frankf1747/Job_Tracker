/**
 * Reading a place out of a job posting.
 *
 * Split out of parsePosting because the old rules were three lines that guessed
 * and were wrong more often than right: over 41 real postings only 14 produced
 * a usable location. Twelve produced prose — "during the hiring process.",
 * "where the position is filled." — because a `location[:\s]+` match will
 * happily swallow a sentence, and one stored "Partner with engineering, IT"
 * because nothing checked that "IT" is not a state.
 *
 * The rule now: a location is a place or it is nothing. Every candidate is
 * validated against a real list of states and provinces, and a field left empty
 * for the review modal to fill beats a wrong one that has to be noticed first.
 */

const US_STATES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
  'puerto rico': 'PR',
};

const CA_PROVINCES: Record<string, string> = {
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  newfoundland: 'NL',
  'nova scotia': 'NS',
  ontario: 'ON',
  'prince edward island': 'PE',
  quebec: 'QC',
  saskatchewan: 'SK',
};

/** Every valid two-letter code, so "IT", "AI" and "HR" cannot pass as one. */
const CODES = new Set([...Object.values(US_STATES), ...Object.values(CA_PROVINCES)]);

/**
 * Cities the posting can name alone without ambiguity.
 *
 * Deliberately short: only places that turned up bare in the tracker's own
 * rows. A longer list starts guessing, and guessing is what this module exists
 * to stop.
 */
const BARE_CITIES: Record<string, string> = {
  toronto: 'ON',
  'new york': 'NY',
  'new york city': 'NY',
  'los angeles': 'CA',
  'san francisco': 'CA',
  'salt lake city': 'UT',
  boston: 'MA',
  chicago: 'IL',
  seattle: 'WA',
  austin: 'TX',
  denver: 'CO',
  atlanta: 'GA',
  houston: 'TX',
  philadelphia: 'PA',
  'san diego': 'CA',
  'san jose': 'CA',
  portland: 'OR',
  minneapolis: 'MN',
  phoenix: 'AZ',
  dallas: 'TX',
  miami: 'FL',
  vancouver: 'BC',
  montreal: 'QC',
  ottawa: 'ON',
};

/** Words that look like a city to a regex but name a country or a work mode. */
const NOT_A_CITY = new Set([
  'usa',
  'us',
  'u.s.',
  'u.s.a.',
  'united states',
  'america',
  'canada',
  'remote',
  'hybrid',
  'on-site',
  'onsite',
  'in-office',
  'anywhere',
  'various',
  'multiple',
  'nationwide',
  'flexible',
  'home',
  'headquarters',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** "new york" -> "New York". Two-letter codes are upper-cased by asRegion. */
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Drop a trailing ZIP or country, which trail a place without changing it. */
const stripTail = (s: string) =>
  clean(s)
    .replace(/[,\s]+\d{5}(?:-\d{1,4})?\s*$/, '')
    .replace(/[,\s]+(?:USA|U\.S\.A\.|US|U\.S\.|United States|Canada)\s*\.?$/i, '')
    .replace(/[.,;:]+$/, '');

/** Title-cased city name, or null if it cannot be one. */
function asCity(raw: string): string | null {
  const city = clean(raw).replace(/[.,;:]+$/, '');
  if (city.length < 2 || city.length > 34) return null;
  if (NOT_A_CITY.has(city.toLowerCase())) return null;
  // Cities are words, optionally hyphenated or apostrophised. A digit, an
  // ampersand or a stray bracket means a sentence was captured, not a place.
  if (!/^[A-Za-z][A-Za-z.'\- ]*$/.test(city)) return null;
  // A run of lowercase words is prose ("the position is filled").
  if (!/^[A-Z]/.test(city)) return null;
  // More than three words stops being a city name.
  if (city.split(' ').length > 3) return null;
  // Canonical casing, so "NEW YORK", "new york" and "New York" are one key and
  // therefore one map pin.
  return titleCase(city);
}

/** "CA" | "California" -> "CA", or null. */
function asRegion(raw: string): string | null {
  const r = clean(raw).replace(/[.,;:]+$/, '');
  if (/^[A-Za-z]{2}$/.test(r) && CODES.has(r.toUpperCase())) return r.toUpperCase();
  const full = US_STATES[r.toLowerCase()] ?? CA_PROVINCES[r.toLowerCase()];
  return full ?? null;
}

/**
 * Whether the "city" is really another state, which makes the pair a list.
 *
 * Postings enumerate the states a salary band covers ("California, Maryland")
 * or the offices a role can sit in ("New York, Texas, Pennsylvania"). Read as
 * city-then-state, those become California, MD and New York, TX. The exception
 * is a city named after its own state — New York, NY and Washington, DC are
 * both real.
 */
const STATE_NAMED_CITIES: Record<string, string[]> = {
  'new york': ['NY'],
  washington: ['DC', 'WA'],
};

function isStateList(city: string, region: string): boolean {
  const key = city.toLowerCase();
  const asState = US_STATES[key] ?? CA_PROVINCES[key];
  if (asState == null) return false;
  return !(STATE_NAMED_CITIES[key] ?? [asState]).includes(region);
}

/**
 * One location string normalised to "City, ST", or null if it is not a place.
 *
 * The same rules the posting parser uses, exposed for the stored
 * `location_raw` column so a value typed by hand, pasted from a posting, or
 * written by an older version of the parser all resolve the same way.
 */
export function canonicalPlace(raw: string): string | null {
  const s = stripTail(String(raw || ''));
  // A stored field is typed by a person, so it arrives in any case. Prose is
  // not, which is why asCity requires a capital — the second attempt supplies
  // one rather than relaxing the rule for postings too.
  return asPlace(s) ?? asPlace(titleCase(s));
}

/** "Webster, NY" out of one fragment, or null. */
function asPlace(raw: string): string | null {
  const s = clean(raw);

  // "City, ST" / "City, State" — the comma may have no space after it, and a
  // ZIP or a country may follow.
  const pair = /^([A-Za-z][A-Za-z.'\- ]{1,33}?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z ]{3,19})\b/.exec(s);
  if (pair) {
    const city = asCity(pair[1]);
    const region = asRegion(pair[2]);
    if (city && region && !isStateList(city, region)) return `${city}, ${region}`;
  }

  // A city that can only mean one place.
  const bare = asCity(s);
  if (bare) {
    const region = BARE_CITIES[bare.toLowerCase()];
    if (region) return `${bare}, ${region}`;
  }
  return null;
}

/** Labels a posting uses for the line that names where the job is. */
const LABEL = /^\s*(?:position\s+)?(?:office\s+|work\s+|job\s+)?locations?\s*[:\-–]?\s*(.*)$/i;

/** Remote as a statement about the job, not a word that happens to appear. */
const REMOTE_STATEMENT =
  /\b(?:this (?:is|role is|position is)[^.\n]{0,40}\bremote\b|fully remote|100% remote|remote position|remote role|work from anywhere|remote[,\s-]+(?:us|usa|united states|anywhere))\b/i;

/**
 * Where the job is: "City, ST", "Remote", or '' when the posting does not say.
 *
 * Ordered by how much the posting is committing to: a labelled line is a
 * statement, a line that is nothing but a place is nearly as good, and a match
 * mid-paragraph is a guess worth making only after those fail.
 */
export function parseLocation(text: string): string {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. A labelled line — "position location: Webster, NY". The value may sit on
  //    the next line instead, which is how Workday and Greenhouse render it.
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL.exec(lines[i]);
    if (!m) continue;
    const here = m[1] ? asPlace(m[1]) : null;
    if (here) return here;
    if (m[1] && /^remote\b/i.test(clean(m[1]))) return 'Remote';
    const next = lines[i + 1];
    if (!m[1] && next) {
      const below = asPlace(next);
      if (below) return below;
      if (/^remote$/i.test(next)) return 'Remote';
    }
  }

  // 2. A line that is only a place. Measured after a ZIP or country is removed,
  //    since neither changes what the line is.
  for (const line of lines) {
    const bare = stripTail(line);
    const place = asPlace(bare);
    if (place && bare.length <= place.length + 12) return place;
  }

  // 3. Anywhere in the text, taking the first — postings that offer a choice
  //    list them in order and the first is the one they lead with. The region
  //    may be spelled out, which is why "located in Houston, Texas" was missed
  //    while the same sentence with "TX" was not.
  const inline =
    /\b([A-Z][A-Za-z.'-]+(?:[ \t][A-Z][A-Za-z.'-]+){0,2}),[ \t]*([A-Z]{2}\b|[A-Z][a-z]+(?:[ \t][A-Z][a-z]+)?)/g;
  for (const m of String(text || '').matchAll(inline)) {
    const place = asPlace(`${m[1]}, ${m[2]}`);
    if (place) return place;
  }

  // 4. Remote, but only where the posting says so about itself.
  if (REMOTE_STATEMENT.test(text)) return 'Remote';

  return '';
}
