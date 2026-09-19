/**
 * Signals read out of a job description.
 *
 * Each returns null when the posting doesn't say, which the UI shows as a greyed
 * cell. That distinction matters: "this posting does not sponsor" and "this
 * posting never mentions sponsorship" are different facts, and collapsing them
 * into a single negative would invent a claim the posting never made.
 *
 * A content script shares one isolated world across its files, so these are
 * plain top-level functions rather than modules — manifest content scripts
 * cannot be ES modules.
 */

/**
 * Whether the employer sponsors work visas: 'yes', 'no', or null if unstated.
 *
 * Negatives are checked first and win. Postings that refuse sponsorship often
 * still contain the word "sponsorship" in the same sentence, so any
 * "yes"-looking phrase has to lose to an explicit refusal.
 */
function detectSponsorship(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;

  const refuses = [
    // "unable to consider candidates who require, or will require in the future,
    // sponsorship" — 68 characters between the negation and the verb. The
    // window used to be 60, so the refusal was missed by eight characters and
    // the sentence then matched an *offer* pattern instead.
    /\b(?:not|unable|cannot|can't|won't|will not|does not|do not|doesn't|no longer)\b[^.!?]{0,140}\bsponsor/,
    /\bno\b[^.!?]{0,20}\b(?:visa\s+)?sponsorship/,
    /\bwithout\b[^.!?]{0,60}\bsponsor/,
    /\bsponsorship\b[^.!?]{0,40}\b(?:is\s+)?not\s+(?:available|offered|provided)/,
    /\bnot\s+eligible\b[^.!?]{0,40}\bsponsor/,
    // The candidate requiring sponsorship is being excluded by the sentence,
    // never offered it.
    /\b(?:candidates?|applicants?|individuals?)\b[^.!?]{0,80}\brequir(?:e|es|ing)\b[^.!?]{0,80}\bsponsor/,
    /\bwho\s+(?:will\s+)?requires?\b[^.!?]{0,60}\bsponsor/,
    // Citizenship and status gates amount to the same answer for a visa holder.
    /\b(?:must\s+be|require[sd]?)\b[^.!?]{0,30}\b(?:u\.?s\.?|united\s+states)\s+citizen/,
    /\b(?:u\.?s\.?\s+)?citizens?(?:hip)?\b[^.!?]{0,30}\b(?:required|only)/,
    /\b(?:green\s*card|permanent\s+resident)[^.!?]{0,30}\b(?:required|only)/,
    /\bitar\b|\bsecurity\s+clearance\b/,
  ];
  if (refuses.some((re) => re.test(t))) return 'no';

  const offers = [
    // The employer has to be the one doing the sponsoring. The old patterns
    // allowed thirty characters of slack after "will", which let "candidates
    // who **will** require in the future, **sponsor**ship" read as an offer.
    /\b(?:will|do|does|can)\s+sponsor\b/,
    /\b(?:willing|happy|open|able|prepared)\s+to\s+sponsor\b/,
    /\bwe\s+sponsor\b/,
    /\bsponsorship\b[^.!?]{0,30}\b(?:is\s+)?(?:available|offered|provided)/,
    /\beligible\s+for\s+(?:visa\s+)?sponsorship\b/,
    /\bh-?1-?b\s+(?:visa\s+)?sponsorship\b[^.!?]{0,30}\b(?:available|offered|provided)/,
  ];
  if (offers.some((re) => re.test(t))) return 'yes';

  return null;
}

/**
 * Required experience, as "5+" or "3-5". Null when unstated.
 *
 * Anchored to the word "experience" so it can't pick up "5 years of growth" or
 * a tenure figure from the company blurb. The lowest figure across all matches
 * wins, since a posting asking for "3+ years, 5+ preferred" requires three.
 */
function detectYears(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;

  const re =
    /(\d{1,2})\s*(?:\+|plus|or\s+more)?\s*(?:(?:-|–|—|to)\s*(\d{1,2}))?\s*(?:\+)?\s*years?['’]?\s*(?:of\s+)?(?:[a-z]+\s+){0,3}experience/g;

  let best = null;
  let match;
  while ((match = re.exec(t))) {
    const low = Number(match[1]);
    const high = match[2] ? Number(match[2]) : null;
    if (!Number.isFinite(low) || low > 30) continue;
    if (best === null || low < best.low) best = { low, high };
  }
  if (!best) return null;
  return best.high ? `${best.low}-${best.high}` : `${best.low}+`;
}

/** A money figure to a number, treating a "k" suffix as thousands. */
function toAmount(raw) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return /k/i.test(raw) ? n * 1000 : n;
}

/** Thousands, rounded — 74560 becomes "75". */
const inK = (n) => String(Math.round(n / 1000));

/**
 * The pay range, compressed to fit a narrow cell: "75-140k", "120k", "48/hr".
 *
 * Hourly rates are kept as rates rather than annualised, because the assumed
 * hours would be a guess and the posting is what it is.
 */
function detectPay(text) {
  const t = String(text || '');
  if (!t) return null;

  const AMOUNT = String.raw`\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*[kK]?`;
  const range = new RegExp(`(${AMOUNT})\\s*(?:-|–|—|to)\\s*(${AMOUNT})`);
  const hourly = new RegExp(`(${AMOUNT})\\s*(?:/|\\s+per\\s+)\\s?(?:hr|hour)`, 'i');

  const hit = t.match(hourly);
  if (hit) {
    const n = toAmount(hit[1]);
    return n ? `${Math.round(n)}/hr` : null;
  }

  const pair = t.match(range);
  if (pair) {
    const lo = toAmount(pair[1]);
    const hi = toAmount(pair[2]);
    // Below 1000 it is an hourly rate or a typo, not a salary band.
    if (lo && hi && lo >= 1000 && hi >= lo) return `${inK(lo)}-${inK(hi)}k`;
  }

  const single = t.match(new RegExp(AMOUNT));
  if (single) {
    const n = toAmount(single[0]);
    if (n && n >= 1000) return `${inK(n)}k`;
  }
  return null;
}
