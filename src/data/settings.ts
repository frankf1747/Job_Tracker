/**
 * Small per-user preferences — currently just the countdown's target date.
 *
 * Signed in, they live in the account's Supabase Auth user metadata rather than
 * a table: a preference this size needs no schema, no row-level security and
 * no migration, and it still follows the account from device to device. In
 * sample mode there is no account, so they live in this browser.
 */

import { requireSupabase } from '../lib/supabase';

export type SettingsBackend = {
  /** The chosen countdown date as "YYYY-MM-DD", or null for the default. */
  loadDeadline(): Promise<string | null>;
  /** Null clears the choice, which puts the countdown back on its default. */
  saveDeadline(iso: string | null): Promise<void>;
};

const META_KEY = 'countdown_deadline';

export function accountSettingsBackend(): SettingsBackend {
  return {
    async loadDeadline() {
      // getUser rather than the cached session: it asks the server, so a date
      // set on another device shows here without waiting for a token refresh.
      const { data, error } = await requireSupabase().auth.getUser();
      if (error) throw error;
      const value = data.user?.user_metadata?.[META_KEY];
      return typeof value === 'string' ? value : null;
    },
    async saveDeadline(iso) {
      // Metadata keys merge, so this leaves anything else stored there alone;
      // a null removes just this key.
      const { error } = await requireSupabase().auth.updateUser({ data: { [META_KEY]: iso } });
      if (error) throw error;
    },
  };
}

const STORAGE_KEY = 'jobtracker.countdown_deadline';

export function localSettingsBackend(): SettingsBackend {
  return {
    async loadDeadline() {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        // Storage can be unavailable outright, e.g. in a private window.
        return null;
      }
    },
    async saveDeadline(iso) {
      try {
        if (iso) localStorage.setItem(STORAGE_KEY, iso);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nowhere to keep it; the choice lasts for this page only.
      }
    },
  };
}
