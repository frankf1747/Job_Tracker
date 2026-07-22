import { useState } from 'react';
import App from './App';
import { PasscodeLock } from './components/PasscodeLock';
import { SignIn } from './components/SignIn';
import { SANS } from './components/styles';
import { isUnlocked } from './lib/lock';
import { useSession } from './hooks/useSession';

/**
 * Gate order: local passcode, then the Supabase session, then the app.
 *
 * Only the second of those is a security boundary. The passcode is a screen
 * lock for a laptop someone else can reach; row-level security, keyed to the
 * session, is what stops anyone reading the data.
 */
export default function Root() {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const session = useSession();

  if (!unlocked) return <PasscodeLock onUnlock={() => setUnlocked(true)} />;

  if (session.status === 'loading') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7f5f0',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            border: '2.5px solid #ddd6c8',
            borderTopColor: '#41678a',
            borderRadius: '50%',
            animation: 'spin .8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (session.status === 'signed-out') return <SignIn />;

  return (
    <>
      {session.status === 'unconfigured' && <SampleDataBanner />}
      <App />
    </>
  );
}

/**
 * Shown when the Supabase env vars are missing. Without this the generated
 * sample rows look like real saved data, which is a bad thing to be confused
 * about in a tracker.
 */
function SampleDataBanner() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 95,
        background: '#f7ecd4',
        borderBottom: '1px solid #e7d5a8',
        color: '#8a6420',
        fontFamily: SANS,
        fontSize: 12,
        textAlign: 'center',
        padding: '7px 14px',
      }}
    >
      Sample data — no database connected. Nothing you change here is saved.
    </div>
  );
}
