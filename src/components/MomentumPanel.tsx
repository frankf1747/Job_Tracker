import { useState } from 'react';
import type { HourStats, Momentum } from '../lib/charts';
import { hourLabel } from '../lib/charts';
import { SANS, SERIF_JP, panelLabel } from './styles';

export type MomentumView = 'week' | 'day' | 'hour';

const VIEWS: [MomentumView, string][] = [
  ['week', 'WEEK'],
  ['day', 'DAY'],
  ['hour', 'HOUR'],
];

const HEADINGS: Record<MomentumView, [string, string]> = {
  week: ['WEEKLY MOMENTUM', 'last 8 weeks'],
  day: ['DAILY MOMENTUM', 'last 7 days'],
  hour: ['BY HOUR', 'when you log applications'],
};

function ViewButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? '#f2efe7' : 'transparent',
        border: 'none',
        borderRadius: 4,
        padding: '3px 8px',
        fontFamily: SANS,
        fontSize: 9.5,
        fontWeight: active ? 700 : 500,
        letterSpacing: '.08em',
        color: active ? '#2c3640' : '#a8b0b9',
        transition: 'background .15s, color .15s',
      }}
    >
      {label}
    </button>
  );
}

/** The count-and-delta headline the week and day views share. */
function Headline({ series, unit }: { series: Momentum; unit: string }) {
  return (
    <>
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
          {series.thisWeek}
        </span>
        <span style={{ fontSize: 12, color: '#8b939e' }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: series.deltaColor, marginTop: 6 }}>
        {series.deltaLabel}
      </div>
    </>
  );
}

function Bars({ series }: { series: Momentum }) {
  return (
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
      {series.bars.map((b, i) => (
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
              height: b.h + '%',
              minHeight: 3,
              background: b.fill,
              borderRadius: '2px 2px 0 0',
              transition: 'height .5s cubic-bezier(.2,.7,.2,1)',
            }}
          />
          <span style={{ fontSize: 8.5, color: '#9aa3ad' }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The 24 hours of the day, sized for this half-width panel.
 *
 * Only the quarter-day marks are labelled — 24 legible ticks do not fit here —
 * and empty hours keep a floor so the axis reads as a continuous day rather
 * than a row of gaps.
 */
function Hours({ stats }: { stats: HourStats }) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 66 }}>
        {stats.bars.map((b) => (
          <div
            key={b.hour}
            title={`${hourLabel(b.hour)} — ${b.count} application${b.count === 1 ? '' : 's'}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              height: '100%',
            }}
          >
            <div
              style={{
                height: `${Math.max(b.h, 2)}%`,
                background: b.peak ? '#41678a' : b.count ? '#b9cbd9' : '#e7e2d5',
                borderRadius: '2px 2px 0 0',
                transition: 'height .2s',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 5 }}>
        {stats.bars.map((b) => (
          <div
            key={b.hour}
            style={{
              flex: 1,
              fontSize: 8.5,
              color: '#9aa3ad',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Momentum, over three timescales that answer different questions: which weeks
 * were productive, whether this week is holding up day to day, and what time of
 * day the work actually happens.
 *
 * One panel rather than three, because they are alternatives — you read one at
 * a time, and the comparison worth making is between periods within a view.
 */
export function MomentumPanel({
  weekly,
  daily,
  hours,
}: {
  weekly: Momentum;
  daily: Momentum;
  hours: HourStats;
}) {
  const [view, setView] = useState<MomentumView>('week');
  const [heading, sub] = HEADINGS[view];

  return (
    <div
      style={{
        borderTop: '1px solid #d8d1c2',
        padding: '18px 0 0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={panelLabel}>
          {heading} <span style={{ letterSpacing: 0, color: '#b3bbc4' }}>— {sub}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {VIEWS.map(([v, label]) => (
            <ViewButton key={v} label={label} active={view === v} onClick={() => setView(v)} />
          ))}
        </div>
      </div>

      {view === 'hour' ? (
        <>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 12.5,
              color: hours.peakHour == null ? '#9aa3ad' : '#41678a',
              minHeight: 40,
            }}
          >
            {hours.caption}
          </div>
          <Hours stats={hours} />
        </>
      ) : (
        <>
          <Headline
            series={view === 'week' ? weekly : daily}
            unit={view === 'week' ? 'apps this week' : 'apps today'}
          />
          <Bars series={view === 'week' ? weekly : daily} />
        </>
      )}
    </div>
  );
}
