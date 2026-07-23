import type { HourStats } from '../lib/charts';
import { hourLabel } from '../lib/charts';
import { SANS, panelLabel } from './styles';

/**
 * When applications get added, across the 24 hours of the local day.
 *
 * 24 bars is a lot of ticks, so only the quarter-day marks are labelled and the
 * rest is left to the tooltip. The peak hour is the one piece of information
 * worth reading at a glance, so it is both coloured and stated in words.
 */
export function HourChart({ stats }: { stats: HourStats }) {
  const empty = stats.peakHour == null;

  return (
    <div>
      <div style={{ ...panelLabel, marginBottom: 6 }}>
        BY HOUR ADDED{' '}
        <span style={{ letterSpacing: 0, color: '#b3bbc4' }}>— when you log applications</span>
      </div>

      <div
        style={{
          fontFamily: SANS,
          fontSize: 12,
          color: empty ? '#9aa3ad' : '#41678a',
          marginBottom: 14,
        }}
      >
        {stats.caption}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96 }}>
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
                // A visible floor for empty hours, so the axis reads as a
                // continuous day rather than a row of gaps.
                height: `${Math.max(b.h, 2)}%`,
                background: b.peak ? '#41678a' : b.count ? '#b9cbd9' : '#e7e2d5',
                borderRadius: '2px 2px 0 0',
                transition: 'height .2s',
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
        {stats.bars.map((b) => (
          <div
            key={b.hour}
            style={{
              flex: 1,
              fontFamily: SANS,
              fontSize: 9.5,
              color: '#a8b0b9',
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
