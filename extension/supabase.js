/**
 * A minimal Supabase client, over plain fetch.
 *
 * supabase-js is deliberately not used: an MV3 service worker cannot load a
 * remote script, so depending on it would force a bundler into what is
 * otherwise a zero-tooling extension you can load unpacked. Only three calls
 * are needed — sign in, refresh, insert — and each is one request.
 *
 * The anon key grants nothing on its own; row-level security on job_queue is
 * the actual boundary, exactly as it is for the web app.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/** Supabase signs in with an email; the tracker signs in with a username. */
const USERNAME_DOMAIN = 'jobtracker.local';

export function toAccountEmail(username) {
  const u = String(username || '')
    .trim()
    .toLowerCase();
  if (!u) return '';
  return u.includes('@') ? u : `${u}@${USERNAME_DOMAIN}`;
}

const SESSION_KEY = 'session';

async function readSession() {
  const { [SESSION_KEY]: s } = await chrome.storage.local.get(SESSION_KEY);
  return s ?? null;
}

async function writeSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

/** Shape the token response into what we store: tokens plus an absolute expiry. */
function toSession(json) {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    userId: json.user?.id ?? null,
    email: json.user?.email ?? null,
    // A minute of slack, so a request never goes out with a just-expired token.
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
  };
}

async function token(body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${body.grant_type}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body.payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.msg || `Sign-in failed (${res.status})`);
  return toSession(json);
}

export async function signIn(username, password) {
  const session = await token({
    grant_type: 'password',
    payload: { email: toAccountEmail(username), password },
  });
  await writeSession(session);
  return session;
}

/**
 * The stored session, refreshed if it has expired. Null when signed out, or
 * when the refresh token is no longer good — the popup then asks to sign in.
 */
export async function currentSession() {
  const s = await readSession();
  if (!s) return null;
  if (Date.now() < s.expiresAt) return s;

  try {
    const next = await token({
      grant_type: 'refresh_token',
      payload: { refresh_token: s.refreshToken },
    });
    await writeSession(next);
    return next;
  } catch {
    await clearSession();
    return null;
  }
}

/**
 * Add a job to the queue, or update it if this posting is already queued.
 *
 * The upsert is what makes re-clicking Queue on the same job harmless; it
 * resolves against the (user_id, source, external_id) unique index.
 */
export async function queueJob(job) {
  const session = await currentSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/job_queue?on_conflict=user_id,source,external_id`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        user_id: session.userId,
        source: job.source ?? 'linkedin',
        external_id: job.externalId ?? null,
        company: job.company ?? '',
        position: job.position ?? '',
        location_raw: job.location ?? '',
        job_url: job.jobUrl ?? '',
        apply_url: job.applyUrl ?? null,
        description: job.description ?? '',
        salary: job.salary ?? '',
        workplace_type: job.workplaceType ?? '',
        posted_note: job.postedNote ?? '',
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Could not queue that job (${res.status}). ${text.slice(0, 140)}`);
  }
  const [row] = await res.json().catch(() => []);
  return row ?? null;
}
