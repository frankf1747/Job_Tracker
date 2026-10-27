import { useMemo, useState } from 'react';
import { roundSummary, type Outcome } from '../lib/rounds';
import type { Round, RoundType, Status } from '../lib/schema';
import { SANS } from './styles';

/**
 * Validated against the page surface (#f7f5f0) for colour-blind separation.
 * Rejected is orange rather than the app's red: the muted red and green read
 * as the same colour to a deuteranope (ΔE 3.4). Every segment is also labelled,
 * so no ending is identified by colour alone.
 */
const OUTCOME_COLOUR: Record<Outcome, string> = {
  'In progress': '#4a6fae',
  Offer: '#13876b',
  Rejected: '#dd7a2a',
  Ghosted: '#a3abb5',
};

/** White only where it clears contrast; the orange and grey take dark text. */
const OUTCOME_INK: Record<Outcome, string> = {
  'In progress': '#fff',
  Offer: '#fff',
  Rejected: '#1f2a35',
  Ghosted: '#1f2a35',
};

/**
 * Round types as tints of one blue, in a fixed order so a type keeps its tint
 * in every row. Identity comes from the label in each segment, not the tint,
 * which is why seven types don't need seven hues.
 */
const ROUND_TINT: Record<RoundType, { bg: string; ink: string }> = {
  'HR / Recruiter': { bg: '#41678a', ink: '#f4f2ec' },
  'Hiring Manager': { bg: '#5d82a6', ink: '#f4f2ec' },
  Technical: { bg: '#86a3bf', ink: '#1f2a35' },
  'Case / Presentation': { bg: '#a9bfd3', ink: '#1f2a35' },
  Behavioral: { bg: '#c7d5e3', ink: '#1f2a35' },
  'Panel / Final': { bg: '#2c4a66', ink: '#f4f2ec' },
  Other: { bg: '#ddd6c8', ink: '#1f2a35' },
};

/** What fits inside a narrow segment. The full name is in its tooltip. */
const SHORT: Record<string, string> = {
  'HR / Recruiter': 'HR',
  'Hiring Manager': 'HM',
  Technical: 'Tech',
  'Case / Presentation': 'Case',
  Behavioral: 'Behav.',
  'Panel / Final': 'Panel',
  Other: 'Other',
  'In progress': 'Open',
  Offer: 'Offer',
  Rejected: 'Rejected',
  Ghosted: 'Ghosted',
};

/**
 * Interview rounds at a glance, folded into one line until asked for.
 *
 * Opened, it is one bar per round: which types happened there, and how many
 * applications got that far. Every bar is drawn against the same total, so a
 * round 3 bar shorter than round 1 is the drop-off, read without a legend.
 */
export function InterviewMap({ rows }: { rows: { status: Status; rounds: Round[] }[] }) {
  const [open, setOpen] = useState(false);
  const sum = useMemo(() => roundSummary(rows), [rows]);

  return (
    <div style={{ marginTop: 26 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderTop: '1px solid #d8d1c2',
          padding: '12px 0 4px',
          fontFamily: SANS,
          fontSize: 11,
          letterSpacing: '.12em',
          color: '#6b7078',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9 }}>{open ? '▾' : '▸'}</span>
        INTERVIEW ROUNDS
        <span style={{ color: '#b9bfc7', letterSpacing: 0 }}>
          · {sum.total ? `${sum.total} recorded` : 'none recorded yet'}
        </span>
      </button>

      {open &&
        (sum.total === 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#8b939e', lineHeight: 1.6 }}>
            Open an application&rsquo;s details with ▸ and add its rounds in order — HR, hiring
            manager, panel. They&rsquo;re summarised here.
          </p>
        ) : (
          <div
            role="table"
            aria-label={`Interview rounds across ${sum.total} applications`}
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: '7px 12px',
              marginTop: 10,
            }}
          >
            {sum.rows.map((row) => (
              <div key={row.label} role="row" style={{ display: 'contents' }}>
                <span
                  role="rowheader"
                  style={{
                    fontFamily: SANS,
                    fontSize: 11,
                    color: row.kind === 'outcome' ? '#37414c' : '#8b939e',
                    fontWeight: row.kind === 'outcome' ? 600 : 400,
                    alignSelf: 'center',
                  }}
                >
                  {row.label}
                </span>
                <div
                  role="cell"
                  style={{
                    display: 'flex',
                    gap: 2,
                    width: `${(row.reached / sum.total) * 100}%`,
                    minWidth: 40,
                    height: 22,
                  }}
                >
                  {row.segments.map((s) => {
                    const c =
                      row.kind === 'outcome'
                        ? {
                            bg: OUTCOME_COLOUR[s.name as Outcome],
                            ink: OUTCOME_INK[s.name as Outcome],
                          }
                        : ROUND_TINT[s.name as RoundType];
                    return (
                      <div
                        key={s.name}
                        title={`${row.label} · ${s.name} · ${s.count}`}
                        style={{
                          flex: s.count,
                          minWidth: 0,
                          background: c.bg,
                          color: c.ink,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 6px',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          fontFamily: SANS,
                          fontSize: 10.5,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {SHORT[s.name] ?? s.name} {s.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
