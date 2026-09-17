/**
 * Dump queued jobs to a JSON file, for scoring in a Claude Code session.
 *
 * Read-only and deliberately dumb: job_queue is behind row-level security, so
 * the anon key alone returns nothing and a real sign-in is required.
 *
 * The password comes from the macOS keychain rather than .env, because .env is
 * for the publishable key and a user password is a different kind of secret —
 * one that should not sit in plaintext just because the file is gitignored.
 * Store it once:
 *
 *   security add-generic-password -a "$USER" -s job-tracker -w
 *
 *   node scripts/queue-dump.mjs [outfile]
 *
 * JT_USER / JT_PASS override the keychain when set, for CI or a one-off.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gateFacts, gateFor } from './gates.mjs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    }),
);

const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
function keychain() {
  // -w prints only the password; the account comes from the same entry.
  const pass = execFileSync('security', ['find-generic-password', '-s', 'job-tracker', '-w'], {
    encoding: 'utf8',
  }).trim();
  const meta = execFileSync('security', ['find-generic-password', '-s', 'job-tracker'], {
    encoding: 'utf8',
  });
  const acct = /"acct"<blob>="([^"]*)"/.exec(meta)?.[1] ?? '';
  return { user: acct, pass };
}

if (!URL_ || !KEY) throw new Error('.env is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');

let user = process.env.JT_USER;
let pass = process.env.JT_PASS;
if (!user || !pass) {
  try {
    ({ user, pass } = keychain());
  } catch {
    throw new Error(
      'No credentials. Store them once with:\n' +
        '  security add-generic-password -a <tracker-username> -s job-tracker -w',
    );
  }
}
if (!user || !pass) throw new Error('Keychain entry job-tracker is missing an account or password');

const email = user.includes('@') ? user : `${user.toLowerCase()}@jobtracker.local`;

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass }),
});
const session = await auth.json();
if (!auth.ok)
  throw new Error(session.error_description || session.msg || `Sign-in failed (${auth.status})`);

const COLUMNS =
  'id,company,position,location_raw,job_url,apply_url,description,salary,workplace_type,posted_note,created_at,' +
  // Included so a scoring run can see what is already done and skip it.
  'fit_problem,fit_skills,fit_experience,fit_score,fit_decision,fit_reason,hr_verdict,hr_note,gate,soft_floor,resume_target,scored_at';

const res = await fetch(`${URL_}/rest/v1/job_queue?select=${COLUMNS}&order=created_at.desc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}` },
});
const rows = await res.json();
if (!res.ok) throw new Error(rows.message || `Fetch failed (${res.status})`);

// Every mechanical fact is computed here rather than left to the scoring run.
// A model reading 8,000 characters of prose for a salary band, a residency
// requirement and a years floor all at once gets them wrong; these are regexes
// with a test suite, and the model is handed the answers.
const enriched = rows.map((r) => {
  const facts = gateFacts(r.description || '');
  return { ...r, gates: { ...facts, gate: gateFor(facts) } };
});

const out = process.argv[2] ?? 'queue.json';
writeFileSync(out, JSON.stringify(enriched, null, 2));

console.log(`${rows.length} jobs -> ${out}`);
const gated = enriched.filter((r) => r.gates.gate != null).length;
const unscored = rows.filter((r) => r.scored_at == null).length;
console.log(
  `${unscored} unscored, ${rows.length - unscored} already scored, ${gated} gated before reading\n`,
);
for (const r of enriched) {
  const mark = r.scored_at == null ? '  --' : String(r.fit_score).padStart(4);
  const what =
    r.scored_at == null ? '' : `  ${r.fit_decision}${r.resume_target ? ':' + r.resume_target : ''}`;
  console.log(
    `${mark} ${String(r.description?.length ?? 0).padStart(6)} chars  ${r.company} — ${r.position.slice(0, 40)}${what}${g}`,
  );
}
