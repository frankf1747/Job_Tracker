import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

/**
 * Track the Supabase session.
 *
 * Starts as `loading` because the client restores a persisted session
 * asynchronously — rendering the sign-in screen before that resolves would
 * flash it at an already-signed-in user on every reload.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isSupabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  );

  useEffect(() => {
    if (!supabase) return;

    let live = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setState(
        data.session ? { status: 'signed-in', session: data.session } : { status: 'signed-out' },
      );
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: 'signed-in', session } : { status: 'signed-out' });
    });

    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
