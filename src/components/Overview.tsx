import { useElementWidth } from '../hooks/useElementWidth';
import { pipsToDraw } from '../lib/derive';
import { SERIF, SERIF_JP, section, sectionHeading, sectionHeadingRow } from './styles';

const PIP_SIZE = 8;
const PIP_GAP = 3;
/** The strip shares a 120px-tall panel with the countdown, so it gets three rows. */
const PIP_ROWS = 3;

/**
 * One tick per elapsed day, wrapping into rows and capped at whatever fits.
 *
 * The cap is computed from the measured width rather than hardcoded, so the
 * strip never pushes the panel taller than the column beside it.
 */
function PipStrip({ days }: { days: number }) {
  const [ref, width] = useElementWidth(0, 0);
  const shown = pipsToDraw(days, width, PIP_SIZE, PIP_GAP, PIP_ROWS);

  return (
    <div
      ref={ref}
      style={{ display: 'flex', flexWrap: 'wrap', gap: PIP_GAP, marginTop: 'auto' }}
      title={`${days} day${days === 1 ? '' : 's'} into the cycle`}
    >
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          style={{ width: PIP_SIZE, height: PIP_SIZE, borderRadius: 2, background: '#b6cadb' }}
        />
      ))}
    </div>
  );
}

const statLabel = {
  fontSize: 10.5,
  letterSpacing: '.26em',
  color: '#8b939e',
  textTransform: 'uppercase' as const,
};

export type OverviewProps = {
  totalApps: string;
  totalAppsSub: string;
  cdWeeks: number;
  cdDays: number;
  cdDaysExtra: number;
  cdTargetLabel: string;
  /** One tick per day since the cycle began. */
  pipCount: number;
};

export function Overview({
  totalApps,
  totalAppsSub,
  cdWeeks,
  cdDays,
  cdDaysExtra,
  cdTargetLabel,
  pipCount,
}: OverviewProps) {
  return (
    <section style={section}>
      <div style={sectionHeadingRow}>
        <h2 style={sectionHeading}>Overview</h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.55fr 1fr',
          gap: 0,
          borderTop: '1px solid #d8d1c2',
        }}
      >
        <div
          style={{
            padding: '20px 28px 8px 0',
            borderRight: '1px solid #e7e2d5',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            minHeight: 120,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={statLabel}>Applications</span>
            <span
              style={{
                fontFamily: SERIF_JP,
                fontSize: 56,
                fontWeight: 600,
                letterSpacing: '-.01em',
                lineHeight: 0.86,
                color: '#2c3640',
              }}
            >
              {totalApps}
            </span>
            <span
              style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: '#8b939e' }}
            >
              {totalAppsSub}
            </span>
          </div>
          <div
            style={{
              fontSize: 9.5,
              letterSpacing: '.22em',
              color: '#c2c8cf',
              textAlign: 'right',
              lineHeight: 1.7,
              paddingBottom: 4,
            }}
          >
            2026
            <br />
            CYCLE
          </div>
        </div>

        <div
          style={{
            padding: '20px 0 8px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 120,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={statLabel}>Countdown</span>
            <span
              style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 12.5, color: '#8b939e' }}
            >
              → {cdTargetLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span
                style={{
                  fontFamily: SERIF_JP,
                  fontSize: 42,
                  fontWeight: 600,
                  lineHeight: 0.85,
                  color: '#2c3640',
                }}
              >
                {cdWeeks}
              </span>
              <span style={{ fontSize: 12, color: '#8b939e' }}>weeks</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontFamily: SERIF_JP,
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 0.85,
                  color: '#4a5560',
                }}
              >
                {cdDaysExtra}
              </span>
              <span style={{ fontSize: 11, color: '#8b939e', whiteSpace: 'nowrap' }}>
                days · {cdDays} total
              </span>
            </span>
          </div>

          <PipStrip days={pipCount} />
        </div>
      </div>
    </section>
  );
}
