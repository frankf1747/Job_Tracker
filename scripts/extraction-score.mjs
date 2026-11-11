/**
 * Scoring the parser against saved answers, shared by replay and the report.
 *
 * Pure: the location normaliser is passed in, so this can be tested without
 * bundling the app.
 */

export const FIELDS = [
  'company',
  'position',
  'location',
  'skills',
  'industry',
  'level',
  'employmentType',
  'salary',
];

const SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh|l\.?p)\b\.?$/;

/** Case, spacing, punctuation and "Inc." are not what a correction is about. */
export function textKey(s) {
  let k = String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  for (let i = 0; i < 2; i++) k = k.replace(SUFFIX, '').trim();
  return k;
}

/** The numbers in a salary, in order: "$90k - $110k" and "$90K–110K" agree. */
export function salaryKey(s) {
  return (String(s ?? '').match(/\d+/g) ?? []).join('-');
}

/**
 * Whether the parser's value for a field matches what was saved.
 * `loc` turns a location into its map identity, so "NYC" and "New York, NY" agree.
 */
export function fieldMatches(field, proposed, saved, loc) {
  if (field === 'skills') {
    const s = skillDiff(proposed, saved);
    return s.extra.length === 0 && s.missing.length === 0;
  }
  if (field === 'location') return locKey(proposed, loc) === locKey(saved, loc);
  if (field === 'salary') return salaryKey(proposed) === salaryKey(saved);
  return textKey(proposed) === textKey(saved);
}

export function locKey(s, loc) {
  const n = loc(s ?? '');
  return n.type === 'unknown' ? '' : n.display.toLowerCase();
}

/** Skills proposed but not kept, and kept but not proposed. */
export function skillDiff(proposed = [], saved = []) {
  const p = new Map(proposed.map((s) => [s.toLowerCase(), s]));
  const v = new Map(saved.map((s) => [s.toLowerCase(), s]));
  return {
    extra: [...p].filter(([k]) => !v.has(k)).map(([, s]) => s),
    missing: [...v].filter(([k]) => !p.has(k)).map(([, s]) => s),
    kept: [...p].filter(([k]) => v.has(k)).map(([, s]) => s),
  };
}

/**
 * Tally a list of {proposed, saved, site?, origin?} pairs.
 *
 * Returns, per field, how many were scored and matched, with the misses; and,
 * per skill, how often it was wrongly proposed or missed, which is where most
 * skill rules get tuned.
 */
export function score(pairs, loc, fields = FIELDS) {
  const byField = Object.fromEntries(fields.map((f) => [f, { n: 0, hit: 0, misses: [] }]));
  const skills = new Map();
  const bump = (name, k) => {
    const key = name.toLowerCase();
    const s = skills.get(key) ?? { name, proposed: 0, kept: 0, missed: 0 };
    s[k]++;
    skills.set(key, s);
  };

  for (const pair of pairs) {
    for (const f of fields) {
      const a = pair.proposed[f];
      const b = pair.saved[f];
      if (a === undefined || b === undefined) continue;
      const t = byField[f];
      t.n++;
      if (fieldMatches(f, a, b, loc)) t.hit++;
      else t.misses.push({ id: pair.id, site: pair.site ?? '', proposed: a, saved: b });
    }
    if (fields.includes('skills') && pair.proposed.skills && pair.saved.skills) {
      const d = skillDiff(pair.proposed.skills, pair.saved.skills);
      for (const s of d.kept) {
        bump(s, 'proposed');
        bump(s, 'kept');
      }
      for (const s of d.extra) bump(s, 'proposed');
      for (const s of d.missing) bump(s, 'missed');
    }
  }
  return { byField, skills: [...skills.values()] };
}

/** "  location   88% (352/400)" lines for a terminal. */
export function formatScore(byField) {
  return Object.entries(byField)
    .filter(([, t]) => t.n > 0)
    .map(([f, t]) => {
      const pct = Math.round((t.hit / t.n) * 100);
      return `  ${f.padEnd(15)} ${String(pct).padStart(3)}%  (${t.hit}/${t.n})`;
    })
    .join('\n');
}

/** The skills most often proposed and then removed, and most often added by hand. */
export function skillTrouble(skills, top = 10) {
  const noisy = skills
    .filter((s) => s.proposed - s.kept >= 2)
    .sort((a, b) => b.proposed - b.kept - (a.proposed - a.kept))
    .slice(0, top);
  const missed = skills
    .filter((s) => s.missed >= 2)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, top);
  return { noisy, missed };
}

/**
 * Whether stored posting text still has its header: the saved title, or the
 * company, near the top. Text without one is a body captured on its own, and
 * scoring the parser's company or title against it would only measure that.
 */
export function hasHeader(text, company, position, within = 400) {
  // LinkedIn's job body, as the extension captures it; the header is not in it.
  if (/^\s*about the job\b/i.test(String(text ?? ''))) return false;
  const top = textKey(String(text ?? '').slice(0, within));
  const has = (s) => {
    const k = textKey(s);
    return k.length >= 3 && top.includes(k);
  };
  return has(position) || has(company);
}
