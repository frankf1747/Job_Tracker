/**
 * The pure half of the tracker's MCP server (scripts/mcp.mjs): the query it
 * sends for a search, the overview it computes, and the fields an update writes.
 *
 * Kept apart from the server so the rules are tested here rather than trusted
 * to a model's reading of a tool description. The status and round lists, and
 * the `reached` rule, mirror src/lib/schema.ts; the test fails if they drift.
 */

export const STATUSES = ['Submitted', 'OA', 'Interview', 'Offer', 'Rejected', 'Ghosted'];

export const ROUND_TYPES = [
  'HR / Recruiter',
  'Hiring Manager',
  'Technical',
  'Case / Presentation',
  'Behavioral',
  'Panel / Final',
  'Other',
];

const STAGE_OF = { Submitted: 0, OA: 1, Interview: 2, Offer: 3 };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_LIMIT = 100;

/** Same rule as reachedFrom in src/lib/schema.ts: Rejected and Ghosted keep how far the row got. */
function reachedAfter(status, current) {
  return status === 'Rejected' || status === 'Ghosted' ? current : STAGE_OF[status];
}

/**
 * The fields an update writes to one application.
 *
 * `reached` moves only with the status (the app's own rule) or when given
 * explicitly, so a rejection email never promotes a row to Interview. Notes are
 * appended under the date, never replaced; a round is appended to the list.
 */
export function planUpdate(app, change, today) {
  const fields = {};
  if (change.status !== undefined) {
    if (!STATUSES.includes(change.status))
      throw new Error(`Unknown status "${change.status}"; use one of ${STATUSES.join(', ')}`);
    fields.status = change.status;
    fields.reached = reachedAfter(change.status, app.reached ?? 0);
  }
  if (change.reached !== undefined) {
    if (!Number.isInteger(change.reached) || change.reached < 0 || change.reached > 3)
      throw new Error('reached must be 0 (resume screen), 1 (OA), 2 (interview) or 3 (offer)');
    fields.reached = change.reached;
  }
  if (change.notes_append !== undefined && String(change.notes_append).trim()) {
    const line = `${today}: ${String(change.notes_append).trim()}`;
    fields.notes = app.notes ? `${app.notes}\n${line}` : line;
  }
  if (change.round !== undefined) {
    const { type, label, date } = change.round ?? {};
    if (!ROUND_TYPES.includes(type))
      throw new Error(`Unknown round type "${type}"; use one of ${ROUND_TYPES.join(', ')}`);
    if (date !== undefined && !ISO.test(date)) throw new Error('A round date must be YYYY-MM-DD');
    const round = { type };
    if (label && String(label).trim()) round.label = String(label).trim();
    if (date) round.date = date;
    fields.rounds = [...(Array.isArray(app.rounds) ? app.rounds : []), round];
  }
  if (Object.keys(fields).length === 0)
    throw new Error('nothing to change: pass status, reached, notes_append or round');
  return { fields };
}

/** PostgREST reserves , ( ) * in filter values; a search term only needs words. */
const clean = (s) =>
  String(s)
    .replace(/[,()*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The querystring for a search over applications, newest first. */
export function searchQuery(
  { query, status, since, until, limit } = {},
  columns = 'id,company,position,status,reached,applied_on,location_raw,industry,level,salary',
) {
  const q = new URLSearchParams({ select: columns });
  const term = query ? clean(query) : '';
  if (term)
    q.set('or', `(company.ilike.*${term}*,position.ilike.*${term}*,industry.ilike.*${term}*)`);
  if (status) q.set('status', `eq.${status}`);
  if (since) q.append('applied_on', `gte.${since}`);
  if (until) q.append('applied_on', `lte.${until}`);
  q.set('order', 'applied_on.desc');
  q.set('limit', String(Math.min(Math.max(1, Number(limit) || 25), MAX_LIMIT)));
  return q.toString();
}

/** The columns tracker_queue lists and tracker_queue_get returns. */
export const QUEUE_LIST_COLUMNS =
  'id,company,position,location_raw,fit_score,fit_decision,fit_reason,job_url,created_at,scored_at';
export const QUEUE_ROW_COLUMNS =
  'id,company,position,location_raw,job_url,apply_url,description,salary,workplace_type,posted_note,created_at,' +
  'fit_problem,fit_skills,fit_experience,fit_score,fit_decision,fit_reason,hr_verdict,hr_note,gate,soft_floor,resume_target,scored_at';

/**
 * One queued posting as a list line. fit_score is a generated column that reads
 * 0 before scoring, so an unscored row says so instead of showing "fit 0".
 */
export function queueLine(r) {
  const where = r.location_raw ? ` · ${r.location_raw}` : '';
  const score =
    r.scored_at == null
      ? ' · unscored'
      : ` · fit ${r.fit_score}${r.fit_decision ? ` ${r.fit_decision}` : ''}`;
  return (
    `${String(r.created_at).slice(0, 10)} · ${r.company} · ${r.position}${where}${score} (queue id ${r.id})` +
    (r.fit_reason ? `\n    ${r.fit_reason}` : '') +
    `\n    ${r.job_url}`
  );
}

const money = (n) => `$${Math.round(n / 1000)}K`;

/** The mechanical gate facts (scripts/gates.mjs), one line each. */
export function gateLines(facts, gate) {
  const soft = facts.softFloor
    ? ` · soft floor: ${facts.softFloor.type}${facts.softFloor.helps ? ' (helps)' : " (doesn't help)"}`
    : '';
  return [
    `Gate: ${gate ?? 'none fired'}`,
    `Years floor: ${facts.yearsFloor ?? '-'}${soft}`,
    `Salary band: ${facts.salary ? `${money(facts.salary.min)}-${money(facts.salary.max)}` : '-'}`,
    `Authorization: ${facts.authorization ?? '-'} · location rule: ${facts.location ?? '-'}`,
    `Unfamiliar systems: ${facts.systems?.length ? facts.systems.join(', ') : '-'}`,
  ];
}

/** One queued posting in full: the posting, any stored triage, the gate facts and the description. */
export function queueDetail(r, facts, gate, cap) {
  const triage =
    r.scored_at == null
      ? 'Triage: unscored'
      : [
          `Triage: ${r.fit_score}/100 (problem ${r.fit_problem}/45, skills ${r.fit_skills}/30, experience ${r.fit_experience}/25) · ${r.fit_decision}` +
            (r.resume_target ? ` · resume ${r.resume_target}` : '') +
            (r.gate ? ` · gate ${r.gate}` : ''),
          `Reason: ${r.fit_reason || '-'}`,
          `HR read: ${r.hr_verdict || '-'}${r.hr_note ? ` · ${r.hr_note}` : ''}`,
        ].join('\n');
  const d = r.description || '';
  return [
    `${r.company} · ${r.position} (queue id ${r.id})`,
    `Saved ${String(r.created_at).slice(0, 10)}${r.posted_note ? ` · ${r.posted_note}` : ''}`,
    `Location: ${r.location_raw || '-'}${r.workplace_type ? ` · ${r.workplace_type}` : ''} · salary: ${r.salary || '-'}`,
    `Posting: ${r.job_url || '-'}${r.apply_url ? ` · apply: ${r.apply_url}` : ''}`,
    triage,
    ...gateLines(facts, gate),
    `Job description${d.length > cap ? ` (first ${cap} of ${d.length} characters)` : ''}:\n${d.slice(0, cap) || '(none saved)'}`,
  ].join('\n');
}

/** Counts by status, the funnel (how many reached at least each stage) and applications per month. */
export function overview(rows) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byMonth = {};
  const funnel = { applied: 0, oa: 0, interview: 0, offer: 0 };
  for (const r of rows) {
    if (r.status in byStatus) byStatus[r.status] += 1;
    const month = String(r.applied_on ?? '').slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] ?? 0) + 1;
    const reached = r.reached ?? 0;
    funnel.applied += 1;
    if (reached >= 1) funnel.oa += 1;
    if (reached >= 2) funnel.interview += 1;
    if (reached >= 3) funnel.offer += 1;
  }
  const sortedMonths = Object.fromEntries(
    Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)),
  );
  return { total: rows.length, byStatus, funnel, byMonth: sortedMonths };
}
