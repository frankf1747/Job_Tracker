import { SANS } from './styles';

export type Chip = { kind: string; label: string; remove: () => void };

/**
 * The active-filter strip above the dashboard. Renders nothing when no filter
 * is set, so the page has no empty affordance until it is relevant.
 */
export function FilterStrip({
  chips,
  shownCount,
  totalCount,
  onReset,
}: {
  chips: Chip[];
  shownCount: number;
  totalCount: number;
  onReset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '11px 0 2px',
        animation: 'fadeIn .25s ease',
      }}
    >
      <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.1em', color: '#8b939e' }}>
        FILTERING
      </span>

      {chips.map((chip) => (
        <button
          key={chip.kind + ':' + chip.label}
          onClick={chip.remove}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: '#41678a',
            color: '#f4f2ec',
            border: 'none',
            borderRadius: 999,
            padding: '5px 8px 5px 11px',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ opacity: 0.6, fontFamily: SANS, fontSize: 10 }}>{chip.kind}</span>
          {chip.label}
          <span style={{ fontSize: 14, lineHeight: 0.6, opacity: 0.75 }}>×</span>
        </button>
      ))}

      <button
        onClick={onReset}
        style={{
          marginLeft: 2,
          background: 'transparent',
          border: '1px dashed #b6ad9c',
          borderRadius: 999,
          padding: '5px 12px',
          fontSize: 12,
          color: '#5f6a75',
        }}
      >
        Reset all
      </button>

      <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 11, color: '#8b939e' }}>
        {shownCount} / {totalCount} applications match
      </span>
    </div>
  );
}
