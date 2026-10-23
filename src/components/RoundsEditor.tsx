import { useState } from 'react';
import { ROUND_TYPES, type Round, type RoundType } from '../lib/schema';
import { SANS, detailLabel } from './styles';

const control = {
  fontFamily: SANS,
  fontSize: 11.5,
  color: '#37414c',
  background: '#fff',
  border: '1px solid #ddd6c8',
  borderRadius: 5,
  padding: '3px 6px',
} as const;

/**
 * An application's interview rounds, in order, edited in place.
 *
 * The date and the Other label save when the field is left, not per keystroke:
 * a date field reports "0002", "0020", "0202" while its year is being typed,
 * and saving each of those would write a round two thousand years ago.
 */
export function RoundsEditor({
  rounds,
  onChange,
}: {
  rounds: Round[];
  onChange: (rounds: Round[]) => void;
}) {
  const [removals, setRemovals] = useState(0);
  const set = (i: number, patch: Partial<Round>) =>
    onChange(rounds.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const add = () => {
    // A guess at what comes next, since rounds usually run in this order.
    const last = rounds[rounds.length - 1]?.type;
    const next = last
      ? ROUND_TYPES[Math.min(ROUND_TYPES.indexOf(last) + 1, ROUND_TYPES.length - 2)]
      : ROUND_TYPES[0];
    onChange([...rounds, { type: next }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={detailLabel}>INTERVIEW ROUNDS</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {rounds.map((r, i) => (
          <div
            // The inputs are uncontrolled, so after a removal they must remount
            // or round 2 would show round 1's old date. Keyed on a count of
            // removals rather than on the values: keying on values remounted a
            // round the moment its date saved, swallowing a click on its own
            // controls that had triggered the save.
            key={`${removals}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px',
              background: '#fff',
              border: '1px solid #e2dccd',
              borderRadius: 7,
            }}
          >
            <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: '#41678a' }}>
              R{i + 1}
            </span>
            <select
              value={r.type}
              aria-label={`Round ${i + 1} type`}
              onChange={(e) => {
                const type = e.target.value as RoundType;
                set(i, type === 'Other' ? { type } : { type, label: undefined });
              }}
              style={control}
            >
              {ROUND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {r.type === 'Other' && (
              <input
                defaultValue={r.label ?? ''}
                placeholder="e.g. Take-home"
                aria-label={`Round ${i + 1} description`}
                onBlur={(e) => {
                  const label = e.currentTarget.value.trim() || undefined;
                  if (label !== r.label) set(i, { label });
                }}
                style={{ ...control, width: 110 }}
              />
            )}
            <input
              type="date"
              defaultValue={r.date ?? ''}
              aria-label={`Round ${i + 1} date`}
              onBlur={(e) => {
                const v = e.currentTarget.value;
                const date =
                  /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 2000 ? v : undefined;
                if (date !== r.date) set(i, { date });
              }}
              style={control}
            />
            <button
              onClick={() => {
                setRemovals((n) => n + 1);
                onChange(rounds.filter((_, j) => j !== i));
              }}
              aria-label={`Remove round ${i + 1}`}
              title="Remove this round"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 2px',
                fontSize: 14,
                lineHeight: 1,
                color: '#a99f8e',
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={add}
          style={{
            background: 'transparent',
            border: '1px dashed #cfc8b9',
            borderRadius: 7,
            padding: '6px 11px',
            fontFamily: SANS,
            fontSize: 11.5,
            color: '#41678a',
          }}
        >
          + {rounds.length ? `Round ${rounds.length + 1}` : 'Add first round'}
        </button>
      </div>
    </div>
  );
}
