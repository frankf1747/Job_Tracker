import App from './App';
import { SignIn } from './components/SignIn';
import { SANS } from './components/styles';
import { useSession } from './hooks/useSession';

/**
 * One gate: the Supabase session.
 *
 * There is deliberately no second, client-side check. A passcode compared in
 * this bundle would protect nothing — the REST API is reachable without loading
 * the page at all — so the passcode is an account password instead, and the
 * session it produces is what row-level security enforces on every query.
 */
export default function Root() {
  const session = useSession();

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

  // Sample mode is always labelled. Generated rows are indistinguishable from
  // saved ones on screen, and an unlabelled 442 of them is actively misleading.
  if (session.status === 'unconfigured') {
    return (
      <>
        <SampleDataBanner />
        <App source={{ kind: 'sample' }} />
      </>
    );
  }

  return <App source={{ kind: 'live', userId: session.session.user.id }} />;
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
