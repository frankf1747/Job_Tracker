/**
 * Write triage results back to job_queue.
 *
 * Reads a JSON array produced by a scoring session and PATCHes each row. The
 * file is validated first, in full, before anything is written: it is generated
 * by a model, and a typo'd decision or an out-of-range sub-score should stop the
 * run rather than land in the database and render as a row in no band at all.
 *
 *   node scripts/queue-score.mjs scores.json [--dry-run]
 *
 * Credentials come from the macOS keychain; see queue-dump.mjs.
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DECISIONS = ['tailor', 'general', 'skip', 'blocked'];
const VERDICTS = ['pass', 'drag', 'fail'];
const GATES = ['years', 'system', 'salary', 'clearance', 'authorization'];
const TARGETS = ['operations', 'data', 'insights'];
const MAX = { fit_problem: 45, fit_skills: 30, fit_experience: 25 };

/** Every problem with a row, so one run reports them all rather than the first. */
function problems(r, i) {
  const at = `[${i}] ${r.id ?? '(no id)'}`;
  const out = [];
  if (!r.id || typeof r.id !== 'string') out.push(`${at}: missing id`);

  for (const [field, max] of Object.entries(MAX)) {
    const v = r[field];
    if (!Number.isInteger(v) || v < 0 || v > max) {
      out.push(`${at}: ${field} must be an integer 0-${max}, got ${JSON.stringify(v)}`);
    }
  }

  if (!DECISIONS.includes(r.fit_decision)) {
    out.push(`${at}: fit_decision must be one of ${DECISIONS.join('|')}`);
  }
  if (typeof r.fit_reason !== 'string' || r.fit_reason.trim() === '') {
    out.push(`${at}: fit_reason is required — a score with no reason is not actionable`);
  }
  if (r.hr_verdict != null && !VERDICTS.includes(r.hr_verdict)) {
    out.push(`${at}: hr_verdict must be one of ${VERDICTS.join('|')} or null`);
  }
  if (r.gate != null && !GATES.includes(r.gate)) {
    out.push(`${at}: gate must be one of ${GATES.join('|')} or null`);
  }
  if (r.resume_target != null && !TARGETS.includes(r.resume_target)) {
    out.push(`${at}: resume_target must be one of ${TARGETS.join('|')} or null`);
  }

  // Cross-field rules the database cannot express.
  if (r.gate != null && r.fit_decision !== 'blocked') {
    out.push(`${at}: a gate fired but fit_decision is "${r.fit_decision}" — a gate outranks the score`);
  }
  if (r.fit_decision === 'blocked' && r.gate == null) {
    out.push(`${at}: blocked without naming a gate`);
  }
  if (r.fit_decision === 'general' && r.resume_target == null) {
    out.push(`${at}: "general" must name which resume to send`);
  }
  if (r.gate === 'years' && r.soft_floor === true) {
    out.push(`${at}: soft_floor suppresses the years gate — they cannot both hold`);
  }
  return out;
}

const file = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!file) throw new Error('Usage: node scripts/queue-score.mjs scores.json [--dry-run]');

const rows = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(rows)) throw new Error('Expected a JSON array of score objects');

const bad = rows.flatMap(problems);
if (bad.length) {
  console.error(`${bad.length} problem(s); nothing written:\n  ` + bad.join('\n  '));
  process.exit(1);
}

const tally = rows.reduce((m, r) => ({ ...m, [r.fit_decision]: (m[r.fit_decision] ?? 0) + 1 }), {});
console.log(`${rows.length} valid rows: ` + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', '));
if (dry) {
  console.log('--dry-run: nothing written');
  process.exit(0);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const pass = execFileSync('security', ['find-generic-password', '-s', 'job-tracker', '-w'], {
  encoding: 'utf8',
}).trim();
const meta = execFileSync('security', ['find-generic-password', '-s', 'job-tracker'], {
  encoding: 'utf8',
});
const acct = /"acct"<blob>="([^"]*)"/.exec(meta)?.[1] ?? '';
const email = acct.includes('@') ? acct : `${acct.toLowerCase()}@jobtracker.local`;

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass }),
});
const session = await auth.json();
if (!auth.ok) throw new Error(session.error_description || session.msg || `Sign-in failed (${auth.status})`);

const scoredAt = new Date().toISOString();
let ok = 0;
for (const r of rows) {
  const { id, ...fields } = r;
  const res = await fetch(`${URL_}/rest/v1/job_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...fields, scored_at: scoredAt }),
  });
  if (!res.ok) {
    console.error(`  ${id}: ${res.status} ${await res.text()}`);
    continue;
  }
  ok++;
}
console.log(`${ok}/${rows.length} written`);
