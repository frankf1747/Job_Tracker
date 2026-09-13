import { useState } from 'react';
import type { QueuedJob } from '../data/queue';
import { MONTHS } from '../lib/schema';
import { SANS, SERIF } from './styles';

/** Stroke weight and sizing follow the tool-rail icons, so they read as a set. */
function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Jobs captured from a posting, waiting to be applied to.
 *
 * A full page rather than a section, matching the Company List: it is somewhere
 * you go to work through a list, not something to scroll past on the dashboard.
 *
 * The queue is deliberately outside the applications table — nothing here counts
 * toward the funnel or the weekly figures until it is promoted. Applying and
 * recording the application are separate actions for the same reason: they
 * rarely happen in the same minute.
 */
export function QueueList({
  jobs,
  load,
  busyId,
  onPromote,
  onRemove,
  onReload,
}: {
  jobs: QueuedJob[];
  load: 'loading' | 'ready' | 'error';
  /** The row mid-write, so its buttons can't be pressed twice. */
  busyId: string | null;
  onPromote: (job: QueuedJob) => void;
  onRemove: (id: string) => void;
  onReload: () => void;
}) {
  // Descriptions are long, so a row shows one only when asked.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Which row was just copied, and whether it worked — cleared on a timer so
  // the confirmation doesn't linger as though it were a permanent state.
  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null);

  const copyDescription = async (j: QueuedJob) => {
    try {
      await navigator.clipboard.writeText(j.description);
      setCopied({ id: j.id, ok: true });
    } catch {
      // Denied permission, or an insecure context.
      setCopied({ id: j.id, ok: false });
    }
    setTimeout(() => setCopied((c) => (c?.id === j.id ? null : c)), 1800);
  };

  const when = (ts: number) => {
    if (!Number.isFinite(ts)) return '';
    const d = new Date(ts);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: '#f7f5f0',
        backgroundImage:
          'linear-gradient(rgba(44,54,64,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(44,54,64,.022) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '54px 34px 90px' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.14em', color: '#41678a' }}>
          TO APPLY
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '8px 0 6px',
          }}
        >
          Queue
        </h1>
        <p style={{ margin: '0 0 26px', fontSize: 13, color: '#8b939e' }}>
          Captured from a posting. Nothing counts toward your funnel until you add it to the
          tracker.
          {load === 'ready' && jobs.length > 0 && (
            <span style={{ fontFamily: SANS, fontSize: 11.5 }}> · {jobs.length} waiting</span>
          )}
        </p>

        {load === 'loading' && (
          <div style={{ padding: '44px 0', textAlign: 'center', color: '#9aa3ad', fontSize: 13 }}>
            Loading…
          </div>
        )}

        {load === 'error' && (
          <div style={{ padding: '34px 0', textAlign: 'center', fontSize: 13 }}>
            <div style={{ color: '#a35242', marginBottom: 12 }}>Couldn’t load the queue.</div>
            <button
              onClick={onReload}
              style={{
                background: 'transparent',
                border: '1px solid #cfc8b9',
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 12.5,
                color: '#5f6a75',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {load === 'ready' && jobs.length === 0 && (
          <div
            style={{
              padding: '54px 0',
              textAlign: 'center',
              color: '#9aa3ad',
              fontSize: 13.5,
              lineHeight: 1.8,
            }}
          >
            Nothing queued yet.
            <br />
            <span style={{ fontFamily: SANS, fontSize: 11.5 }}>
              Use the Queue button on a LinkedIn posting.
            </span>
          </div>
        )}

        {load === 'ready' &&
          jobs.map((j) => {
            const isOpen = !!open[j.id];
            return (
              <div
                key={j.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2dccd',
                  borderRadius: 9,
                  padding: '14px 16px',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{j.company || '—'}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#41678a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {j.position || '—'}
                    </div>
                    <div
                      style={{ fontFamily: SANS, fontSize: 11, color: '#8b939e', marginTop: 3 }}
                    >
                      {[j.location, when(j.capturedAt), j.workplaceType].filter(Boolean).join(' · ')}
                    </div>
                  </div>

                  <a
                    href={j.applyUrl || j.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    // Falls back to the posting when there is no employer link,
                    // which is every Easy Apply capture.
                    title={j.applyUrl ? 'Open the employer’s application page' : 'Open on LinkedIn'}
                    style={{
                      flex: 'none',
                      background: 'transparent',
                      border: '1px solid #cfc8b9',
                      borderRadius: 7,
                      padding: '7px 14px',
                      fontSize: 12.5,
                      color: '#41678a',
                    }}
                  >
                    Apply ↗
                  </a>

                  <button
                    onClick={() => onPromote(j)}
                    disabled={busyId === j.id}
                    style={{
                      flex: 'none',
                      background: '#41678a',
                      border: '1px solid #41678a',
                      borderRadius: 7,
                      padding: '7px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: '#f4f2ec',
                      opacity: busyId === j.id ? 0.7 : 1,
                    }}
                  >
                    Add to tracker
                  </button>

                  <button
                    onClick={() => onRemove(j.id)}
                    disabled={busyId === j.id}
                    aria-label={`Remove ${j.position || 'job'}`}
                    title="Remove"
                    style={{
                      flex: 'none',
                      background: 'transparent',
                      border: 'none',
                      color: '#a99f8e',
                      fontSize: 17,
                      lineHeight: 1,
                      padding: '0 2px',
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}
                >
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [j.id]: !o[j.id] }))}
                    aria-expanded={isOpen}
                    disabled={!j.description}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      fontFamily: SANS,
                      fontSize: 11,
                      letterSpacing: '.08em',
                      color: j.description ? '#6b7078' : '#c2c8cf',
                      cursor: j.description ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: 10 }}>{isOpen ? '▾' : '▸'}</span>
                    {j.description
                      ? `JOB DESCRIPTION (${j.description.length.toLocaleString()} chars)`
                      : 'NO DESCRIPTION CAPTURED'}
                  </button>

                  {j.description && (
                    <button
                      onClick={() => void copyDescription(j)}
                      aria-label={
                        copied?.id === j.id && copied.ok
                          ? 'Description copied'
                          : 'Copy description'
                      }
                      title={
                        copied?.id === j.id && !copied.ok
                          ? 'Copy failed'
                          : 'Copy the description'
                      }
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        background: 'transparent',
                        border: '1px solid #ddd6c8',
                        borderRadius: 6,
                        padding: 0,
                        color:
                          copied?.id === j.id ? (copied.ok ? '#3f7d55' : '#a35242') : '#8b939e',
                      }}
                    >
                      {copied?.id === j.id && copied.ok ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  )}
                </div>

                {isOpen && j.description && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 12,
                      borderTop: '1px dashed #e2dccd',
                      maxHeight: 380,
                      overflow: 'auto',
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      color: '#37414c',
                      // The capture keeps the posting's own line breaks.
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {j.description}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
