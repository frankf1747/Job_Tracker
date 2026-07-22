import { SANS } from './styles';

/**
 * Shown while a pasted posting is being parsed. The mock "document" underneath
 * the spinner is decorative — it stands in for the posting being scanned.
 */
export function ParsingOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(40,48,60,.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        style={{
          background: '#fbfaf7',
          border: '1px solid #d8d1c2',
          borderRadius: 8,
          padding: '30px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,.28)',
        }}
      >
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '2.5px solid #ddd6c8',
              borderTopColor: '#41678a',
              borderRadius: '50%',
              animation: 'spin .8s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 14,
              border: '2px solid #41678a33',
              borderRadius: '50%',
              animation: 'ringpulse 1.4s ease-out infinite',
            }}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Reading posting…</div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: '#8b939e', marginTop: 4 }}>
            extracting position · company · skills · location
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            width: 220,
            height: 34,
            background: '#efece3',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid #e2dccd',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              top: 6,
              height: 3,
              background: '#ddd6c8',
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 8,
              width: '60%',
              top: 14,
              height: 3,
              background: '#ddd6c8',
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 8,
              width: '75%',
              top: 22,
              height: 3,
              background: '#ddd6c8',
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 14,
              background: 'linear-gradient(180deg,transparent,rgba(65,103,138,.18),transparent)',
              animation: 'scanline 1.1s linear infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}
