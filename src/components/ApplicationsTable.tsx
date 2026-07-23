import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import type { SortDir, SortKey } from '../lib/derive';
import { loggedAtOf } from '../lib/loggedAt';
import { MONTHS, STATUSES, STATUS_META } from '../lib/schema';
import type { Application, Status } from '../lib/schema';
import {
  SANS,
  detailCol,
  detailLabel,
  detailValue,
  section,
  sectionHeading,
  sectionHeadingRow,
  sortableTh,
  th,
} from './styles';

const SORTABLE: [SortKey, string][] = [
  ['company', 'COMPANY'],
  ['position', 'POSITION'],
  ['location', 'LOCATION'],
  ['applied', 'APPLIED'],
  ['status', 'STATUS'],
];

const truncate: CSSProperties = {
  maxWidth: 250,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00');
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}

/**
 * When the row was logged, e.g. "Jul 22, 9:41 PM". Distinct from the applied
 * date above it, which the user sets; this is stamped on save and feeds the
 * by-hour chart.
 */
function addedAt(ts: number): string {
  if (!Number.isFinite(ts)) return '—';
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** How long an armed delete stays armed before reverting. */
const ARM_MS = 4000;

/**
 * Two-step delete: the first click arms it, the second commits.
 *
 * Deleting an application is not undoable, and this lives inside a panel the
 * user opened deliberately, so a modal would be heavier than the risk warrants.
 * Arming reverts on its own so a forgotten click doesn't stay dangerous.
 */
function DeleteControl({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {armed && (
        <button
          onClick={() => setArmed(false)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 11.5,
            color: '#8b939e',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Cancel
        </button>
      )}
      <button
        onClick={() => (armed ? onDelete() : setArmed(true))}
        aria-label={armed ? `Confirm deleting ${label}` : `Delete ${label}`}
        style={{
          background: armed ? '#a35242' : 'transparent',
          border: `1px solid ${armed ? '#a35242' : '#ddd6c8'}`,
          borderRadius: 6,
          padding: '5px 11px',
          fontSize: 11.5,
          fontWeight: armed ? 600 : 400,
          color: armed ? '#f7f5f0' : '#8b939e',
          whiteSpace: 'nowrap',
          transition: 'background .15s, border-color .15s, color .15s',
        }}
      >
        {armed ? 'Really delete?' : 'Delete'}
      </button>
    </div>
  );
}

export type TableProps = {
  rows: Application[];
  /** Matching the current filter. */
  total: number;
  /** Before filtering — distinguishes an empty tracker from an empty result. */
  unfilteredTotal: number;
  search: string;
  onSearch: (v: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  /** In-flight text for rows whose date is being edited. */
  dateEdit: Record<string, string>;
  onDateFocus: (id: string, current: string) => void;
  onDateInput: (id: string, v: string) => void;
  onDateCommit: (id: string, v: string) => void;
  onStatusChange: (id: string, status: Status) => void;
  onNotesChange: (id: string, notes: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPickSkill: (skill: string) => void;
  pageInfo: string;
  /** ⌘ or Ctrl, for the empty-state hint. */
  pasteKey: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
};

export function ApplicationsTable(p: TableProps) {
  const arrow = p.sortDir === 'asc' ? '↑' : '↓';

  return (
    <section style={section}>
      <div style={sectionHeadingRow}>
        <h2 style={sectionHeading}>Applications</h2>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 12,
              color: '#aeb6bf',
            }}
          >
            ⌕
          </span>
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Search company, role, location…"
            aria-label="Search applications"
            style={{
              width: 300,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #d8d1c2',
              borderRadius: 0,
              padding: '8px 4px 8px 26px',
              fontSize: 12.5,
            }}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #d8d1c2', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12.5, minWidth: 1120 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #d8d1c2' }}>
                <th style={{ width: 34, padding: '11px 0 11px 12px' }} />
                {SORTABLE.map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => p.onSort(key)}
                    aria-sort={
                      p.sortKey === key
                        ? p.sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    style={sortableTh}
                  >
                    {label} {p.sortKey === key ? arrow : ''}
                  </th>
                ))}
                <th style={th}>RESUME</th>
                <th style={{ ...th, minWidth: 320, whiteSpace: 'normal' }}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r, idx) => {
                const meta = STATUS_META[r.status];
                const filled = meta.bg !== 'transparent';
                const isOpen = !!p.expanded[r.id];
                const applied = shortDate(r.applied);
                const dateValue = p.dateEdit[r.id] ?? applied;
                const logged = loggedAtOf(r.createdAt, r.applied);

                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={(e) => {
                        // The row is a click target for expanding, but it is full of
                        // controls with their own jobs — don't steal their clicks.
                        if ((e.target as HTMLElement).closest('input, select, a, button')) return;
                        p.onToggleExpand(r.id);
                      }}
                      title="Click for skills & details"
                      style={{
                        borderBottom: '1px solid #e7e2d5',
                        background: idx % 2 === 1 ? '#f1ede4' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '8px 0 8px 12px', verticalAlign: 'middle' }}>
                        <button
                          onClick={() => p.onToggleExpand(r.id)}
                          title="Skills & details"
                          aria-expanded={isOpen}
                          style={{
                            width: 22,
                            height: 22,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isOpen ? '#e9e4d8' : '#efece3',
                            border: `1px solid ${isOpen ? '#c2c8cf' : '#ddd6c8'}`,
                            borderRadius: 6,
                            fontSize: 9,
                            color: isOpen ? '#41678a' : '#8b939e',
                            lineHeight: 1,
                          }}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>

                      <td style={{ padding: '10px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {r.company}
                      </td>

                      <td style={{ padding: '10px 14px', maxWidth: 250 }}>
                        {r.sourceUrl ? (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open job posting"
                            style={{
                              ...truncate,
                              color: '#41678a',
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {r.position}
                            <span style={{ fontSize: 9, opacity: 0.55, flex: 'none' }}>↗</span>
                          </a>
                        ) : (
                          <span style={{ ...truncate, color: '#37414c', display: 'inline-block' }}>
                            {r.position}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', color: '#5f6a75', whiteSpace: 'nowrap' }}>
                        {r.loc.display}
                      </td>

                      <td style={{ padding: '6px 8px 6px 14px', whiteSpace: 'nowrap' }}>
                        {/* Baseline-aligned so the time sits on the same line as
                            the date text inside the input, not the input's box. */}
                        <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
                          <input
                            className="date-cell"
                            value={dateValue}
                            onFocus={() => p.onDateFocus(r.id, applied)}
                            onChange={(e) => p.onDateInput(r.id, e.target.value)}
                            onBlur={(e) => p.onDateCommit(r.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            title="Type e.g. 0721 → Jul 21"
                            aria-label={`Applied date for ${r.company}`}
                          />
                          {logged && (
                            <span
                              title={
                                logged.sameDay
                                  ? `Logged at ${logged.time}`
                                  : `Logged ${logged.full}; the applied date was set to ${applied}`
                              }
                              style={{
                                fontSize: 11,
                                // Dimmed and italic when it belongs to a different
                                // day than the applied date, so it never reads as
                                // that day's time.
                                color: logged.sameDay ? '#8b939e' : '#c2c8cf',
                                fontStyle: logged.sameDay ? 'normal' : 'italic',
                              }}
                            >
                              , {logged.time}
                            </span>
                          )}
                        </span>
                      </td>

                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          title="Change status"
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: meta.fg,
                            background: meta.bg,
                            padding: filled ? '3px 10px' : 0,
                            borderRadius: 999,
                            fontSize: 12.5,
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Noto Serif JP', Georgia, serif",
                              opacity: 0.85,
                            }}
                          >
                            「
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              fontFamily: "'Source Serif 4', 'Noto Serif JP', Georgia, serif",
                            }}
                          >
                            {r.status}
                          </span>
                          <span
                            style={{
                              fontFamily: "'Noto Serif JP', Georgia, serif",
                              opacity: 0.85,
                            }}
                          >
                            」
                          </span>
                          <select
                            value={r.status}
                            onChange={(e) => p.onStatusChange(r.id, e.target.value as Status)}
                            aria-label={`Status for ${r.company}`}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: 'pointer',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              border: 'none',
                            }}
                          >
                            {STATUSES.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </span>
                      </td>

                      <td
                        style={{
                          padding: '10px 14px',
                          color: '#8b939e',
                          fontFamily: SANS,
                          fontSize: 10.5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.resume}
                      </td>

                      <td style={{ padding: '6px 14px 6px 12px' }}>
                        <input
                          className="notes-input"
                          value={r.notes}
                          onChange={(e) => p.onNotesChange(r.id, e.target.value)}
                          placeholder="add a note…"
                          aria-label={`Notes for ${r.company}`}
                        />
                      </td>
                    </tr>

                    {isOpen && (
                      <tr style={{ borderBottom: '1px solid #e7e2d5', background: '#f1eee6' }}>
                        <td />
                        <td colSpan={7} style={{ padding: '4px 14px 16px' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 24,
                              alignItems: 'flex-start',
                              padding: '14px 16px',
                              background: '#f7f5f0',
                              border: '1px solid #e2dccd',
                              borderRadius: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 7,
                                flex: 1,
                                minWidth: 230,
                              }}
                            >
                              <span style={detailLabel}>SKILLS REQUESTED</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                {r.skills.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => p.onPickSkill(s)}
                                    style={{
                                      background: '#ece7db',
                                      border: '1px solid #ddd6c8',
                                      borderRadius: 999,
                                      padding: '4px 11px',
                                      fontSize: 11,
                                      color: '#4a5560',
                                    }}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                              <div style={detailCol}>
                                <span style={detailLabel}>INDUSTRY</span>
                                <span style={detailValue}>{r.industry}</span>
                              </div>
                              <div style={detailCol}>
                                <span style={detailLabel}>LEVEL</span>
                                <span style={detailValue}>{r.level}</span>
                              </div>
                              <div style={detailCol}>
                                <span style={detailLabel}>TYPE</span>
                                <span style={detailValue}>{r.employmentType}</span>
                              </div>
                              <div style={detailCol}>
                                <span style={detailLabel}>SALARY</span>
                                <span style={detailValue}>{r.salary || '—'}</span>
                              </div>
                              <div style={detailCol}>
                                <span style={detailLabel}>ADDED</span>
                                <span style={detailValue}>{addedAt(r.createdAt)}</span>
                              </div>
                              <div style={detailCol}>
                                <span style={detailLabel}>POSTING</span>
                                {r.sourceUrl ? (
                                  <a
                                    href={r.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      fontSize: 12,
                                      color: '#41678a',
                                      fontFamily: SANS,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    Open posting<span style={{ fontSize: 9, opacity: 0.6 }}>↗</span>
                                  </a>
                                ) : (
                                  <span
                                    style={{ fontSize: 12, color: '#9aa3ad', fontFamily: SANS }}
                                  >
                                    no link saved
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                marginLeft: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() => p.onEdit(r.id)}
                                aria-label={`Edit ${r.company} · ${r.position}`}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #ddd6c8',
                                  borderRadius: 6,
                                  padding: '5px 13px',
                                  fontSize: 11.5,
                                  color: '#41678a',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Edit
                              </button>
                              <DeleteControl
                                label={`${r.company} · ${r.position}`}
                                onDelete={() => p.onDelete(r.id)}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {p.total === 0 && (
          <div style={{ padding: 34, textAlign: 'center', color: '#9aa3ad', fontSize: 13 }}>
            {p.unfilteredTotal === 0 ? (
              <>
                Nothing tracked yet — copy a job posting and press{' '}
                <kbd
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#2c3640',
                    color: '#f7f5f0',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontFamily: SANS,
                  }}
                >
                  {p.pasteKey}
                </kbd>
                <kbd
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#2c3640',
                    color: '#f7f5f0',
                    borderRadius: 4,
                    padding: '2px 6px',
                    marginLeft: 3,
                    fontFamily: SANS,
                  }}
                >
                  V
                </kbd>{' '}
                anywhere on this page.
              </>
            ) : (
              'No applications match — try clearing filters.'
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: 11, color: '#8b939e' }}>{p.pageInfo}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={p.onPrev}
            disabled={p.page <= 1}
            style={{
              background: 'transparent',
              border: '1px solid #d8d1c2',
              borderRadius: 3,
              padding: '7px 14px',
              fontSize: 12,
              color: p.page > 1 ? '#2c3640' : '#c2c8cf',
            }}
          >
            ← Prev
          </button>
          <button
            onClick={p.onNext}
            disabled={p.page >= p.totalPages}
            style={{
              background: 'transparent',
              border: '1px solid #d8d1c2',
              borderRadius: 3,
              padding: '7px 14px',
              fontSize: 12,
              color: p.page < p.totalPages ? '#2c3640' : '#c2c8cf',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </section>
  );
}
