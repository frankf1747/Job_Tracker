/**
 * Shared sign-in and select for the scripts in this directory.
 *
 * Extracted once a third script needed it. job_queue and applications are both
 * behind row-level security, so the anon key alone returns nothing and every
 * script needs a real session.
 *
 * The password comes from the macOS keychain rather than .env, because .env is
 * for the publishable key and a user password is a different kind of secret.
 * Store it once:
 *
 *   security add-generic-password -a "<tracker-username>" -s job-tracker -w
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function env() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  return Object.fromEntries(
    raw
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
}

function keychain() {
  const pass = execFileSync('security', ['find-generic-password', '-s', 'job-tracker', '-w'], {
    encoding: 'utf8',
  }).trim();
  const meta = execFileSync('security', ['find-generic-password', '-s', 'job-tracker'], {
    encoding: 'utf8',
  });
  const acct = /"acct"<blob>="([^"]*)"/.exec(meta)?.[1] ?? '';
  return { user: acct, pass };
}

/** A signed-in client: { url, key, token }. */
export async function connect() {
  const e = env();
  const url = e.VITE_SUPABASE_URL;
  const key = e.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('.env is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');

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
  const email = user.includes('@') ? user : `${user.toLowerCase()}@jobtracker.local`;

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  const json = await res.json();
  if (!res.ok)
    throw new Error(json.error_description || json.msg || `Sign-in failed (${res.status})`);
  return { url, key, token: json.access_token };
}

/** GET rows from a table. `query` is appended to the querystring. */
export async function select({ url, key, token }, table, query) {
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  const rows = await res.json();
  if (!res.ok) throw new Error(rows.message || `Fetch failed (${res.status})`);
  return rows;
}
