/**
 * Reading the tools a posting asks for.
 *
 * Two things the old matcher got wrong, both measured over 41 real postings.
 *
 * It matched the whole document with no regard for what the sentence was
 * saying, so a role advertised as "*instead of* assembling reports in Tableau
 * or Power BI, you'll use Claude Code" was recorded as requiring Tableau and
 * Power BI — the two tools it exists to replace — and none of what it names.
 *
 * And it truncated to seven in pool order, so React, at index 35, lost to Excel
 * every time. The cap threw away exactly the tools that distinguish one posting
 * from another.
 */

/**
 * Tools by how much they tell you, most distinctive first.
 *
 * Order is load-bearing: it is the truncation order, so a warehouse or a
 * framework survives the cut and a spreadsheet does not. Everything here is a
 * tool, a language or a named system — the two entries that matched nearly
 * every posting, Communication and Storytelling, were removed once the data
 * showed Communication firing on 28 of 41.
 */
const TIERS: string[][] = [
  // Distinctive: naming one of these narrows the role immediately.
  [
    'Databricks',
    'Snowflake',
    'dbt',
    'Airflow',
    'Spark',
    'Alteryx',
    'Microsoft Fabric',
    'Power Automate',
    'React',
    'TypeScript',
    'Figma',
    'Looker',
    'LLM',
    'Veeva',
    'SAP',
    'Salesforce',
    'GA4',
    'Pandas',
  ],
  // Core craft: expected of an analyst, still worth recording.
  [
    'SQL',
    'Python',
    'R',
    'Java',
    'JavaScript',
    'Tableau',
    'Power BI',
    'Machine Learning',
    'ETL',
    'Git',
    'Statistics',
    'Data Structures',
    'A/B Testing',
    'Experimentation',
    'Data Visualization',
  ],
  // Commodity or method: true of most postings, so last to survive the cut.
  [
    'Excel',
    'Agile',
    'Forecasting',
    'Financial Modeling',
    'Accounting',
    'Market Research',
    'User Research',
    'Process Improvement',
    'Project Mgmt',
    'Stakeholder Mgmt',
    'Product Sense',
    'Roadmapping',
  ],
];

/** Flat list, most distinctive first. */
export const SKILL_POOL: string[] = TIERS.flat();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matchers that a plain word boundary gets wrong.
 *
 * "R" is the whole problem: \bR\b matches the R in "R&D", which appears in a
 * third of these postings. It has to be a token in a list of tools.
 */
const SPECIAL: Record<string, RegExp> = {
  R: /(?<![A-Za-z&(])R(?![A-Za-z&)])/,
  'A/B Testing': /\bA\/B\b/i,
};

function matcher(skill: string): RegExp {
  return SPECIAL[skill] ?? new RegExp('\\b' + escapeRe(skill) + '\\b', 'i');
}

/**
 * Clauses a posting uses to name a tool it is moving away from.
 *
 * The negated span runs from the marker to the end of the clause, not the end
 * of the sentence — "instead of Tableau, you'll use React" names one tool it
 * does not want and one it does, and both halves matter.
 */
const NEGATION =
  /\b(?:instead of|rather than|as an alternative to|not just|no longer|without relying on|migrating (?:a team )?off|move (?:a team )?off|moving away from|away from|replace|replacing|legacy)\b/gi;

/**
 * Where the clause starting at `from` ends.
 *
 * A comma inside brackets is not a clause boundary: "migrating off legacy BI
 * tools (Tableau, Looker)" is one clause, and stopping at the comma left Looker
 * behind as though the posting had asked for it.
 */
function clauseEnd(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') {
      if (depth === 0) return i;
      depth--;
    } else if (depth === 0) {
      if (c === ';' || c === '.' || c === '\n') return i;
      if (c === ',') return i;
      if (c === '-' && s[i - 1] === ' ' && s[i + 1] === ' ') return i;
      if (c === '\u2014') return i;
    }
  }
  return s.length;
}

/** The text with every negated clause removed. */
export function dropNegatedClauses(text: string): string {
  const s = String(text || '');
  const spans: [number, number][] = [];
  for (const m of s.matchAll(NEGATION)) {
    spans.push([m.index, clauseEnd(s, m.index)]);
  }
  if (spans.length === 0) return s;

  let out = '';
  let at = 0;
  for (const [start, end] of spans) {
    if (start < at) continue;
    out += s.slice(at, start) + ' ';
    at = end;
  }
  return out + s.slice(at);
}

/**
 * The tools a posting asks for, most distinctive first, at most `limit`.
 *
 * Returns an empty array rather than a guess. A posting that names no tools —
 * a process role, or one written entirely in competencies — should record none,
 * because a skill list that is always full is a skill list you stop reading.
 */
export function extractSkills(text: string, limit = 7, company = ''): string[] {
  const usable = dropNegatedClauses(text);
  const employer = company.trim().toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_POOL) {
    // Salesforce posting a job is not a posting that requires Salesforce.
    if (employer && skill.toLowerCase() === employer) continue;
    if (matcher(skill).test(usable)) found.push(skill);
    if (found.length === limit) break;
  }
  return found;
}
