/**
 * The mechanical half of queue triage.
 *
 * Everything here is text pattern matching a person can audit and a test can
 * pin. It exists because a scoring run kept getting these facts wrong while
 * reading eight thousand characters of prose looking for everything at once: a
 * 5-year floor read as 2, a salary band missed entirely, a company's head
 * office mistaken for the job's location.
 *
 * So the model no longer looks for them. These run first, the facts are handed
 * to it alongside the posting, and its job shrinks to the one thing only it can
 * do — judging whether the problem this team describes is one Frank has solved.
 *
 * Plain ESM rather than TypeScript so `node scripts/…` runs it with no build
 * step, and so the app's browser-only tsconfig never has to cover it.
 */

/**
 * Years Frank can credibly claim: the BioMarin internship, the Anderson
 * research assistantship, and MOOBOX. A floor at or under this is something a
 * resume can argue with; above it, no amount of writing helps.
 */
export const CREDITED_YEARS = 2;

/** Top of the realistic band, per frank-resume. A posting opening above this is two levels up. */
export const SALARY_CEILING = 110_000;

/** A figure inside one of these is an aspiration, not a bar. */
const ASPIRATIONAL = /\b(?:preferred|bonus|ideally|a plus|nice[- ]to[- ]haves?)\b/i;

/**
 * The lowest number of years the posting actually requires.
 *
 * Two rules, both learned from a posting that was scored wrong:
 *
 * - A range is read from its low end. "2-5 years" asks for two.
 * - When several requirements stack, the governing one is the *highest* floor.
 *   "5+ years of strategy, including 2+ in consulting" requires five; the two
 *   is a subset of it. Reading the smallest figure on the page turned a hard
 *   block into a shortlist entry.
 */
export function yearsFloor(text) {
  const floors = [];
  // Scoped per sentence rather than by a character window. A fixed window
  // reaches across sentence boundaries, so "5+ years preferred" in the next
  // line silently disqualified the "1+ years required" in this one.
  // Not split on ':' — a label governs what follows it ("Bonus: 6+ years").
  const chunks = String(text || '').split(/(?<=[.;!?])\s+|\n+/);
  const re = /(\d{1,2})\s*(?:\+|-|–|—|\s*to\s*)?\s*(?:\d{1,2})?\s*\+?\s*years?\b/gi;

  // Postings also put the qualifier in a heading above the bullets it governs
  // ("Preferred Qualifications" / "Nice to Haves"), so a heading carries
  // forward until the next one replaces it.
  let aspirationalSection = false;

  for (const chunk of chunks) {
    const line = chunk.trim();
    if (line.length > 0 && line.length <= 60 && !/\d/.test(line)) {
      aspirationalSection = ASPIRATIONAL.test(line);
    }
    if (aspirationalSection || ASPIRATIONAL.test(chunk)) continue;
    // A requirement says "years of experience" or "years in <a role>". Without
    // this, a company blurb's "for more than 80 years" reads as a bar.
    if (!/\bexperience\b|\byears? (?:in|of|as)\b/i.test(chunk)) continue;

    for (const m of chunk.matchAll(re)) {
      const years = Number(m[1]);
      if (!Number.isFinite(years) || years < 1 || years > 15) continue;
      floors.push(years);
    }
  }
  return floors.length ? Math.max(...floors) : null;
}

const DEGREE_LADDER =
  /(?:bachelor|master)[’'s]*\s*(?:degree)?\s*(?:\+|and|with|plus)\s*\d+\s*years?[\s\S]{0,120}?(?:bachelor|master)[’'s]*\s*(?:degree)?\s*(?:\+|and|with|plus)\s*\d+\s*years?/i;
const EQUIVALENCY =
  /\b(?:any\s+)?combination of education[, ]+(?:and\s+)?(?:training[, ]+(?:and\s+)?)?experience|in lieu of (?:a |the )?degree|equivalent combination\b/i;
const NEW_GRAD =
  /\b(?:recent (?:college )?graduate|new grad(?:uate)?s?|graduating (?:student|senior))\b/i;
/** Substitutes for the diploma only — worth nothing to someone who has one. */
const DEGREE_ONLY =
  /\b(?:degree|bachelor[’'s]*(?:\s*degree)?)\b[^.\n]{0,80}?\bor equivalent\b|\bor equivalent (?:professional |relevant )?experience\b/i;

/**
 * Whether the posting offers relief from its own experience bar.
 *
 * The distinction that matters, and that a previous run got wrong: a clause can
 * substitute for the *degree* or for the *years*, and only the second helps.
 * "Degree or equivalent relevant experience" lowers the bar for someone without
 * a diploma. Frank has one, and an MSBA — it does nothing for him, and marking
 * it as a soft floor wrongly suppressed a real gate.
 */
export function softFloor(text) {
  const t = String(text || '');
  if (DEGREE_LADDER.test(t)) return { type: 'degree-ladder', helps: true };
  if (EQUIVALENCY.test(t)) return { type: 'equivalency', helps: true };
  if (NEW_GRAD.test(t)) return { type: 'new-grad', helps: true };
  if (DEGREE_ONLY.test(t)) return { type: 'degree-only', helps: false };
  return null;
}

const toAmount = (raw, kSuffix) => {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return kSuffix ? Math.round(n * 1000) : Math.round(n);
};

/** The advertised band, in dollars a year. */
export function salaryBand(text) {
  const t = String(text || '');
  // "$85,000—$95,000", "$71,300.00 - $107,000.00", "90-95K USD"
  const dollars =
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:-|–|—|\s*to\s*)\s*\$?\s*([\d,]+(?:\.\d{2})?)/.exec(t);
  if (dollars) {
    const min = toAmount(dollars[1]);
    const max = toAmount(dollars[2]);
    if (min && max && min >= 1000) return { min, max };
  }
  const thousands = /\b(\d{2,3})\s*(?:-|–|—|\s*to\s*)\s*(\d{2,3})\s*[kK]\b/.exec(t);
  if (thousands) {
    return { min: toAmount(thousands[1], true), max: toAmount(thousands[2], true) };
  }
  return null;
}

/** A residency or office requirement, quoted as the posting words it. */
export function locationFilter(text) {
  const t = String(text || '');
  const patterns = [
    /must (?:live|reside) in ([A-Z][\w .'-]{2,40})/i,
    /this role is based in ([A-Z][\w .'-]{2,40})/i,
    /(?:must be |candidates must be )located in ([A-Z][\w .'-]{2,40})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }
  return null;
}

/** Sponsorship, citizenship and clearance are different facts, kept apart. */
export function authorizationFilter(text) {
  const t = String(text || '');
  if (/\b(?:security )?clearance\b/i.test(t) && /\b(?:required|must|active)\b/i.test(t)) {
    return 'clearance';
  }
  if (/\b(?:US|U\.S\.|United States) citizen(?:ship)?\b/i.test(t)) return 'citizenship';
  if (
    /\bwithout (?:requiring )?sponsorship\b|\bnot (?:able|willing) to sponsor\b|\bno (?:visa )?sponsorship\b|\bsponsorship (?:is )?not (?:available|provided|offered)\b/i.test(
      t,
    )
  ) {
    return 'sponsorship';
  }
  return null;
}

/**
 * Systems Frank has never used, taken from the open gates in the content
 * library. Only counted where the posting requires them — a "plus" is a
 * question in an interview, not a closed door.
 */
const SYSTEMS = [
  ['Jira / Confluence', /\b(?:jira|confluence)\b/i],
  ['WMS (HighJump/Korber)', /\b(?:wms|highjump|k[oö]rber|manhattan associates)\b/i],
  [
    'Agile ceremony facilitation',
    /\b(?:sprint planning|stand-?ups?|backlog grooming|retrospectives?|scrum master)\b/i,
  ],
  ['Lean (Gemba/A3/Kanban)', /\b(?:gemba|a3 problem solving|kanban boards?)\b/i],
  ['Specialty pharmacy data', /\b(?:specialty pharmacy|dispense (?:file|data)|hub services)\b/i],
  [
    'Claims / provider performance',
    /\b(?:claims data|provider performance|clinical groupers?|attribution models?)\b/i,
  ],
  ['Deep learning / RL', /\b(?:deep learning|neural networks?|reinforcement learning)\b/i],
  ['Salesforce Administrator certification', /\bsalesforce admin(?:istrator)? certification\b/i],
];

export function unusedSystems(text) {
  const t = String(text || '');
  const found = [];
  for (const [name, re] of SYSTEMS) {
    const m = re.exec(t);
    if (!m) continue;
    const around = t.slice(Math.max(0, m.index - 160), m.index + 160);
    if (ASPIRATIONAL.test(around)) continue;
    if (!/\b(?:required|must|minimum qualification)\b/i.test(around)) continue;
    found.push(name);
  }
  return found;
}

/** Every mechanical fact about a posting, read in one pass. */
export function gateFacts(text) {
  return {
    yearsFloor: yearsFloor(text),
    softFloor: softFloor(text),
    salary: salaryBand(text),
    location: locationFilter(text),
    authorization: authorizationFilter(text),
    systems: unusedSystems(text),
  };
}

/**
 * Which gate disqualifies the posting, in order of how absolute it is.
 *
 * Work authorization first: it is a fact about the person, not the application.
 * Salary next, and ahead of tenure — a band far above the range means the
 * posting is two levels up, which explains the years bar rather than merely
 * coinciding with it, and it is the more honest thing to record.
 */
export function gateFor(facts) {
  if (facts.authorization === 'clearance') return 'clearance';
  if (facts.authorization === 'citizenship') return 'clearance';
  if (facts.authorization === 'sponsorship') return 'authorization';
  if (facts.salary && facts.salary.min > SALARY_CEILING) return 'salary';
  if (facts.yearsFloor != null && facts.yearsFloor > CREDITED_YEARS && !facts.softFloor?.helps) {
    return 'years';
  }
  if (facts.systems.length > 0) return 'system';
  return null;
}
