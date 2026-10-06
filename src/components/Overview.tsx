import { useRef, useState } from 'react';
import { useElementWidth } from '../hooks/useElementWidth';
import { isoOf } from '../lib/derive';
import { pipsToDraw } from '../lib/derive';
import { SANS, SERIF, SERIF_JP, section, sectionHeading, sectionHeadingRow } from './styles';

const PIP_SIZE = 8;
const PIP_GAP = 3;
/** The strip shares a 120px-tall panel with the countdown, so it gets three rows. */
const PIP_ROWS = 3;

/**
 * "Day N" plus one tick per elapsed day, wrapping into rows and capped at
 * whatever fits.
 *
 * The cap is computed from the measured width rather than hardcoded, so the
 * strip never pushes the panel taller than the column beside it. The label
 * keeps the real count readable once the ticks stop keeping up.
 */
function PipStrip({ days }: { days: number }) {
  const [ref, width] = useElementWidth(0, 0);
  const shown = pipsToDraw(days, width, PIP_SIZE, PIP_GAP, PIP_ROWS);

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 'auto' }}
      title={`Day ${days} of your search`}
    >
      <span
        style={{
          fontFamily: SANS,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.06em',
          color: '#5f6a75',
          whiteSpace: 'nowrap',
          flex: 'none',
          paddingTop: 1,
        }}
      >
        Day {days}
      </span>
      <div ref={ref} style={{ display: 'flex', flexWrap: 'wrap', gap: PIP_GAP, flex: 1 }}>
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            style={{ width: PIP_SIZE, height: PIP_SIZE, borderRadius: 2, background: '#b6cadb' }}
          />
        ))}
      </div>
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
  /** The target as "YYYY-MM-DD"; null while the saved choice is loading. */
  cdTargetIso: string | null;
  /** Set the target, or null to return to the default. */
  onChangeDeadline: (iso: string | null) => void;
  /** Which day of the search this is; also the number of ticks. */
  dayNumber: number;
};

/**
 * The countdown's target, editable in place.
 *
 * Commits on Enter or when focus leaves, not on every change event. A date
 * field fires change while its year is still being typed — "0002", "0020" —
 * and committing those would save a deadline two thousand years ago. Escape
 * puts it back; clearing the field returns the countdown to its default.
 */
function DeadlineField({
  label,
  iso,
  onChange,
}: {
  label: string;
  iso: string;
  onChange: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  const open = () => {
    cancelled.current = false;
    setEditing(true);
    // Open the calendar straight away. Not every browser supports it, and the
    // focused field is usable either way.
    requestAnimationFrame(() => {
      try {
        field.current?.showPicker();
      } catch {
        /* unsupported, or blocked outside a user gesture */
      }
    });
  };

  // Takes the field's own value rather than reading it from state: a clear
  // followed at once by a blur can arrive before React has re-rendered, and a
  // value read from state would then be the stale one.
  const commit = (value: string) => {
    setEditing(false);
    if (cancelled.current) return;
    if (value === '') return onChange(null);
    // A half-typed date is not a choice; leave the saved one alone.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 2000 && value !== iso) {
      onChange(value);
    }
  };

  if (editing) {
    return (
      <input
        ref={field}
        type="date"
        defaultValue={iso}
        min={isoOf(new Date())}
        autoFocus
        aria-label="Countdown date"
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        style={{
          fontFamily: SERIF,
          fontSize: 12.5,
          color: '#2c3640',
          background: '#fff',
          border: '1px solid #cfc8b9',
          borderRadius: 5,
          padding: '2px 6px',
        }}
      />
    );
  }

  return (
    <button
      onClick={open}
      title="Change the countdown date"
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: 12.5,
        color: '#8b939e',
        textDecoration: 'underline dotted',
        textUnderlineOffset: 3,
        cursor: 'pointer',
      }}
    >
      → {label}
    </button>
  );
}

export function Overview({
  totalApps,
  totalAppsSub,
  cdWeeks,
  cdDays,
  cdDaysExtra,
  cdTargetLabel,
  cdTargetIso,
  onChangeDeadline,
  dayNumber,
}: OverviewProps) {
  // Until the saved date arrives, show no numbers rather than the default's —
  // otherwise every load would flash Dec 11 before settling on the real one.
  const loading = cdTargetIso === null;
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
            {loading ? (
              <span style={{ fontSize: 12.5, color: '#c2c8cf' }}>…</span>
            ) : (
              <DeadlineField label={cdTargetLabel} iso={cdTargetIso} onChange={onChangeDeadline} />
            )}
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
                {loading ? '–' : cdWeeks}
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
                {loading ? '–' : cdDaysExtra}
              </span>
              <span style={{ fontSize: 11, color: '#8b939e', whiteSpace: 'nowrap' }}>
                days · {loading ? '–' : cdDays} total
              </span>
            </span>
          </div>

          <PipStrip days={dayNumber} />
        </div>
      </div>
    </section>
  );
}
