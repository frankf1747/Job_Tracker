import type { ExitStat, FunnelStage, Momentum } from '../lib/charts';
import type { Status } from '../lib/schema';
import {
  SANS,
  SERIF,
  SERIF_JP,
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
  onToggleStage,
  onToggleStatus,
}: {
  stages: FunnelStage[];
  exits: ExitStat[];
  momentum: Momentum;
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

        <div
          style={{
            borderTop: '1px solid #d8d1c2',
            padding: '18px 0 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ ...panelLabel, marginBottom: 12 }}>WEEKLY MOMENTUM</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontFamily: SERIF_JP,
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: '-.01em',
                lineHeight: 0.9,
                color: '#2c3640',
              }}
            >
              {momentum.thisWeek}
            </span>
            <span style={{ fontSize: 12, color: '#8b939e' }}>apps this week</span>
          </div>

          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: momentum.deltaColor,
              marginTop: 6,
            }}
          >
            {momentum.deltaLabel}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 5,
              height: 66,
              marginTop: 'auto',
              paddingTop: 16,
            }}
          >
            {momentum.bars.map((wk, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: wk.h + '%',
                    minHeight: 3,
                    background: wk.fill,
                    borderRadius: '2px 2px 0 0',
                    transition: 'height .5s cubic-bezier(.2,.7,.2,1)',
                  }}
                />
                <span style={{ fontSize: 8.5, color: '#9aa3ad' }}>{wk.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
