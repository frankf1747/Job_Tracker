import { useState } from 'react';
import { requireSupabase } from '../lib/supabase';
import { SANS, SERIF } from './styles';

/**
 * Magic-link sign-in.
 *
 * This is the real gate. The session it produces is what row-level security
 * checks on every query, so someone without access to this mailbox cannot read
 * the data even holding the publishable key. Sessions persist and refresh, so
 * a given browser does this once.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const address = email.trim();
    if (!address) return;

    setState('sending');
    setError(null);
    try {
      const { error } = await requireSupabase().auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setState('sent');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Could not send the link. Try again.');
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

      <div
        style={{
          position: 'relative',
          width: 380,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
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
            {state === 'sent' ? 'Check your inbox.' : 'Sign in to your tracker.'}
          </div>
        </div>

        {state === 'sent' ? (
          <div
            style={{
              background: '#e7eef4',
              border: '1px solid #c9d9e5',
              color: '#2c5a80',
              borderRadius: 8,
              padding: '13px 15px',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            A sign-in link is on its way to <strong>{email.trim()}</strong>. Open it in this browser
            and you'll stay signed in here.
            <button
              onClick={() => setState('idle')}
              style={{
                display: 'block',
                marginTop: 10,
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 12.5,
                color: '#41678a',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Use a different address
            </button>
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: 10,
                  letterSpacing: '.06em',
                  color: '#8b939e',
                  textTransform: 'uppercase',
                }}
              >
                Email
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void send();
                }}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  background: '#fff',
                  border: '1.5px solid #cfc8b9',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 13.5,
                }}
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
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={() => void send()}
              disabled={state === 'sending' || !email.trim()}
              style={{
                background: '#41678a',
                border: '1px solid #41678a',
                borderRadius: 8,
                padding: '11px 18px',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#f4f2ec',
                opacity: state === 'sending' || !email.trim() ? 0.6 : 1,
              }}
            >
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
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
              No password to remember. The link signs this browser in for good.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
