/**
 * The Supabase client, and the question of whether we have one at all.
 *
 * Both env vars ship in the browser bundle. That is expected: the publishable
 * key grants nothing by itself, and row-level security is what actually gates
 * the data. It also means any check performed in this app's UI is cosmetic —
 * the real boundary is the RLS policies in supabase/migrations.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * False when the env vars are absent — during local UI work, or on a
 * misconfigured deploy. The app falls back to generated sample data rather
 * than crashing, and says so.
 */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        // Keeps the session in localStorage and refreshes it in the background,
        // so signing in on this laptop is a one-time act.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Narrowing helper for the call sites that must have a client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
