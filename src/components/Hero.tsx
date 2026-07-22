import { SANS, SERIF } from './styles';

/** Paper-grain overlay, as an inline SVG turbulence filter. */
const GRAIN_URL =
  "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22%3E%3Cfilter id=%22g%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23g)%22/%3E%3C/svg%3E')";

export function Grain() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        opacity: 0.05,
        mixBlendMode: 'multiply',
        backgroundImage: GRAIN_URL,
        backgroundSize: '140px 140px',
      }}
    />
  );
}

/** 頑張れ — "do your best", running vertically down the left margin. */
export function VerticalMotto() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '50%',
        left: 20,
        transform: 'translateY(-50%)',
        zIndex: 30,
        writingMode: 'vertical-rl',
        fontFamily: "'Noto Serif JP', 'Source Serif 4', Georgia, serif",
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '.44em',
        color: 'rgba(46,58,72,.5)',
      }}
    >
      頑張れ
    </div>
  );
}

export function Hero({ pasteKey }: { pasteKey: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(420px,30vw,590px)',
        backgroundImage: "url('/fuji_hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center 37%',
      }}
    >
      {/* Fades the photo into the page background so the content has somewhere to
          land. The lower stops stay heavy enough to keep the headline legible —
          the photo is brightest in its upper two-thirds. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg,rgba(247,245,240,.14) 0%,rgba(247,245,240,0) 45%,rgba(247,245,240,.42) 82%,#f7f5f0 100%)',
        }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 560"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.5,
        }}
        fill="none"
        stroke="#2c3640"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M1085 430 C1150 445 1175 470 1150 492 C1132 508 1120 490 1132 480" opacity=".26" />
        <path d="M1050 120 C1110 108 1140 120 1138 140" opacity=".22" />
      </svg>

      <div
        style={{
          position: 'relative',
          maxWidth: 1360,
          margin: '0 auto',
          padding: '0 34px 72px',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '.32em',
              color: '#4d5966',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            2026 APPLICATION RECORD
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Noto Serif JP', 'Source Serif 4', Georgia, serif",
              fontSize: 50,
              fontWeight: 600,
              letterSpacing: '.08em',
              lineHeight: 1,
              color: '#26303a',
            }}
          >
            応募記録
          </h1>
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 15,
              color: '#455060',
              marginTop: 12,
            }}
          >
            Fall seven times, stand up eight.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(252,251,248,.78)',
            backdropFilter: 'blur(5px)',
            border: '1px solid rgba(110,120,132,.28)',
            borderRadius: 999,
            padding: '8px 15px 8px 12px',
            flex: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', gap: 3 }}>
            <kbd
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#2c3640',
                color: '#f7f5f0',
                borderRadius: 4,
                padding: '3px 6px',
                lineHeight: 1,
                fontFamily: SANS,
              }}
            >
              {pasteKey}
            </kbd>
            <kbd
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#2c3640',
                color: '#f7f5f0',
                borderRadius: 4,
                padding: '3px 7px',
                lineHeight: 1,
                fontFamily: SANS,
              }}
            >
              V
            </kbd>
          </span>
          <span style={{ fontSize: 12.5, color: '#37414c' }}>paste anywhere to add</span>
        </div>
      </div>
    </div>
  );
}
