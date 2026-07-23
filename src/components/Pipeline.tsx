import type { ExitStat, FunnelStage, HourStats, Momentum } from '../lib/charts';
import { MomentumPanel } from './MomentumPanel';
import type { Status } from '../lib/schema';
import {
  SANS,
  SERIF,
  bareButton,
  panelLabel,
  section,
  sectionHeading,
  sectionHeadingRow,
} from './styles';

export function Pipeline({
  stages,
  exits,
  momentum,
  daily,
  hours,
  onToggleStage,
  onToggleStatus,
}: {
  stages: FunnelStage[];
  exits: ExitStat[];
  momentum: Momentum;
  /** Last 7 days, for the DAY view of the momentum panel. */
  daily: Momentum;
  /** Hour-of-day aggregate, for the HOUR view. */
  hours: HourStats;
  onToggleStage: (stage: number) => void;
  onToggleStatus: (status: Status) => void;
}) {
  return (
    <section style={section}>
      <div style={sectionHeadingRow}>
        <h2 style={sectionHeading}>Pipeline &amp; Momentum</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 52 }}>
        <div style={{ borderTop: '1px solid #d8d1c2', padding: '18px 0 0' }}>
          <div style={panelLabel}>
            CONVERSION FUNNEL <span style={{ color: '#c2c8cf' }}>— click a stage to filter</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.map((st) => (
              <button
                key={st.key}
                onClick={() => onToggleStage(st.stage)}
                aria-pressed={st.active}
                style={{ ...bareButton, display: 'block' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: st.labelColor }}>
                    {st.key}{' '}
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: 10.5,
                        color: '#aeb6bf',
                        fontWeight: 400,
                      }}
                    >
                      {st.conv}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.02em' }}>
                    {st.count}
                  </span>
                </div>
                <div
                  style={{
                    height: 15,
                    background: '#e9e4d8',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: st.width + '%',
                      background: st.fill,
                      borderRadius: 3,
                      transition: 'width .5s cubic-bezier(.2,.7,.2,1), background .2s',
                    }}
                  />
                </div>
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 28,
              marginTop: 16,
              paddingTop: 13,
              borderTop: '1px dashed #ddd6c8',
            }}
          >
            {exits.map((ex) => (
              <button
                key={ex.key}
                onClick={() => onToggleStatus(ex.key)}
                style={{
                  ...bareButton,
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 7,
                  textDecoration: ex.deco,
                  textUnderlineOffset: 4,
                }}
              >
                <span style={{ fontSize: 12, color: ex.fg }}>{ex.key}</span>
                <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: ex.fg }}>
                  {ex.count}
                </span>
                <span style={{ fontSize: 11, color: ex.fg, opacity: 0.7 }}>{ex.pct}</span>
              </button>
            ))}
          </div>
        </div>

        <MomentumPanel weekly={momentum} daily={daily} hours={hours} />
      </div>
    </section>
  );
}
