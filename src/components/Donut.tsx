import type { BreakdownArc } from '../lib/charts';
import { SANS, bareButton } from './styles';

/**
 * A pie plus its legend, used for both the industry and skill breakdowns.
 * Slices and legend rows are the same click target, so either filters.
 */
export function Donut({
  title,
  subtitle,
  arcs,
  onPick,
}: {
  title: string;
  subtitle: string;
  arcs: BreakdownArc[];
  onPick: (name: string) => void;
}) {
  return (
    <div style={{ borderTop: '1px solid #d8d1c2', padding: '18px 4px 0' }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 11,
          color: '#8b939e',
          letterSpacing: '.05em',
          marginBottom: 6,
        }}
      >
        {title} <span style={{ color: '#c2c8cf' }}>— {subtitle}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 14px' }}>
        <svg viewBox="0 0 164 164" width="150" height="150" style={{ display: 'block' }}>
          {arcs.map((a) => (
            <path
              key={a.name}
              d={a.d}
              fill={a.color}
              stroke="#f7f5f0"
              strokeWidth="1.5"
              onClick={() => !a.other && onPick(a.name)}
              style={{
                cursor: a.other ? 'default' : 'pointer',
                opacity: a.opacity,
                transition: 'opacity .2s',
              }}
            >
              <title>
                {a.name} · {a.count} ({a.pct}%)
              </title>
            </path>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {arcs.map((a) => (
          <button
            key={a.name}
            onClick={() => !a.other && onPick(a.name)}
            style={{
              ...bareButton,
              cursor: a.other ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: a.opacity,
              transition: 'opacity .2s',
            }}
          >
            <span
              style={{ width: 9, height: 9, borderRadius: 2, background: a.color, flex: 'none' }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: a.nameColor,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {a.name}
            </span>
            <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: '#4a5560' }}>
              {a.pct}%
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: 10,
                color: '#aeb6bf',
                width: 30,
                textAlign: 'right',
              }}
            >
              {a.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
