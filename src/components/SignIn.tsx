import { useEffect, useRef, useState } from 'react';
import { toAccountEmail } from '../lib/account';
import { requireSupabase } from '../lib/supabase';
import { SANS, SERIF } from './styles';

/**
 * Username and passcode sign-in.
 *
 * The passcode is a Supabase account password, not a string compared in this
 * file. That distinction is the whole security model: the session it returns is
 * what row-level security checks on every query, so someone holding the
 * publishable key still reads nothing. A passcode checked in the client would
 * be decoration — the REST API is reachable without ever loading this page.
 *
 * Sessions persist and refresh, so a browser signs in once.
 */

export function SignIn() {
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  const submit = async () => {
    if (!username.trim() || !passcode) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await requireSupabase().auth.signInWithPassword({
        email: toAccountEmail(username),
        password: passcode,
      });
      if (error) throw error;
      // No success branch: the session listener in useSession swaps the screen.
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        /invalid login credentials/i.test(message)
          ? "That username and passcode don't match an account."
          : message || 'Could not sign in. Try again.',
      );
      setPasscode('');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: '#f7f5f0',
        backgroundImage: "url('/fuji_hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 37%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg,rgba(247,245,240,.55) 0%,rgba(247,245,240,.72) 60%,rgba(247,245,240,.92) 100%)',
        }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{
          position: 'relative',
          width: 350,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(252,251,248,.88)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(110,120,132,.26)',
          borderRadius: 12,
          padding: '34px 32px 28px',
          boxShadow: '0 24px 60px rgba(44,54,64,.18)',
          animation: 'cardIn .3s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Noto Serif JP', 'Source Serif 4', Georgia, serif",
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '.08em',
              color: '#26303a',
            }}
          >
            応募記録
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 13,
              color: '#5f6a75',
              marginTop: 7,
            }}
          >
            Fall seven times, stand up eight.
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Username</span>
          <input
            ref={first}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Passcode</span>
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>

        {error && (
          <div
            role="alert"
            style={{
              background: '#f7ecd4',
              border: '1px solid #e7d5a8',
              color: '#8a6420',
              borderRadius: 6,
              padding: '8px 11px',
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !passcode}
          style={{
            background: '#41678a',
            border: '1px solid #41678a',
            borderRadius: 8,
            padding: '11px 18px',
            fontSize: 13.5,
            fontWeight: 600,
            color: '#f4f2ec',
            opacity: busy || !username.trim() || !passcode ? 0.6 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p
          style={{
            margin: 0,
            fontFamily: SANS,
            fontSize: 11,
            color: '#9aa3ad',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          Asked once per browser — this device stays signed in.
        </p>
      </form>
    </div>
  );
}

const labelStyle = {
  fontFamily: SANS,
  fontSize: 10,
  letterSpacing: '.06em',
  color: '#8b939e',
  textTransform: 'uppercase' as const,
};

const inputStyle = {
  background: '#fff',
  border: '1.5px solid #cfc8b9',
  borderRadius: 6,
  padding: '10px 12px',
  fontSize: 13.5,
};
