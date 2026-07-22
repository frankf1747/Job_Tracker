import { useEffect, useRef, useState } from 'react';
import { PASSCODE, rememberUnlocked } from '../lib/lock';
import { SANS, SERIF } from './styles';

/**
 * A local screen lock, not a security boundary.
 *
 * This runs entirely in the browser, so it cannot protect the database — the
 * publishable key is in the bundle and the REST API is reachable without ever
 * loading this component. What it does do is stop someone who picks up an
 * already-signed-in laptop from reading the page. Access control lives in the
 * RLS policies in supabase/migrations, gated by the Supabase session.
 *
 * Unlocking is remembered per-browser, so it is asked for once on a machine.
 */

const LENGTH = PASSCODE.length;

export function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = (code: string) => {
    if (code === PASSCODE) {
      rememberUnlocked();
      onUnlock();
    } else {
      setWrong(true);
      setEntry('');
      input.current?.focus();
    }
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, LENGTH);
    setEntry(digits);
    setWrong(false);
    if (digits.length === LENGTH) submit(digits);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#f7f5f0',
        backgroundImage: "url('/fuji_hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 37%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          background: 'rgba(252,251,248,.86)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(110,120,132,.26)',
          borderRadius: 12,
          padding: '38px 44px 32px',
          boxShadow: '0 24px 60px rgba(44,54,64,.18)',
          animation: 'cardIn .3s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Noto Serif JP', 'Source Serif 4', Georgia, serif",
              fontSize: 34,
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
              fontSize: 13.5,
              color: '#5f6a75',
              marginTop: 8,
            }}
          >
            Fall seven times, stand up eight.
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 10.5,
              letterSpacing: '.26em',
              color: '#8b939e',
              textTransform: 'uppercase',
            }}
          >
            Passcode
          </span>

          <div style={{ position: 'relative' }}>
            <input
              ref={input}
              value={entry}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(entry);
              }}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Passcode"
              aria-invalid={wrong}
              style={{
                width: 168,
                textAlign: 'center',
                letterSpacing: '.7em',
                textIndent: '.7em',
                fontSize: 22,
                fontFamily: SANS,
                background: '#fff',
                border: `1.5px solid ${wrong ? '#c0705c' : '#cfc8b9'}`,
                borderRadius: 8,
                padding: '11px 12px',
                color: '#2c3640',
                transition: 'border-color .15s',
              }}
            />
          </div>
        </label>

        <div
          role={wrong ? 'alert' : undefined}
          style={{
            fontSize: 12.5,
            minHeight: 18,
            color: wrong ? '#a35242' : '#9aa3ad',
            textAlign: 'center',
          }}
        >
          {wrong ? 'Not quite — try again.' : 'Asked once per browser.'}
        </div>
      </div>
    </div>
  );
}
