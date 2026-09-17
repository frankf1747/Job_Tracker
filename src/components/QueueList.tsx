import { useState } from 'react';
import type { QueuedJob } from '../data/queue';
import { MONTHS } from '../lib/schema';
import {
  BANDS,
  COLLAPSED,
  DIMENSIONS,
  bandLabel,
  gateLabel,
  groupQueue,
  targetLabel,
  type Band,
} from '../lib/triage';
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

/** Per-dimension colour, so the breakdown reads as three things, not one bar. */
const DIMENSION_COLOURS = ['#41678a', '#5f8a6a', '#a08256'];

/**
 * The score and what it is made of.
 *
 * The breakdown is shown rather than hidden because a bare total is not
 * arguable: a 58 that lost its points on skills means something different from
 * one that lost them on problem overlap, and only the parts say which.
 */
function ScoreBlock({ job }: { job: QueuedJob }) {
  if (job.scoredAt == null) {
    return (
      <div style={{ flex: 'none', width: 58, textAlign: 'center' }}>
        <div style={{ fontFamily: SANS, fontSize: 10, color: '#c2c8cf', letterSpacing: '.06em' }}>
          UNSCORED
        </div>
      </div>
    );
  }
  const muted = job.gate != null;
  return (
    <div style={{ flex: 'none', width: 58 }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 23,
          fontWeight: 600,
          lineHeight: 1,
          textAlign: 'center',
          color: muted ? '#b3a998' : '#2c3640',
        }}
      >
        {job.fitScore ?? '—'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 5 }}>
        {DIMENSIONS.map((d, i) => {
          const value = job[d.key] ?? 0;
          return (
            <div
              key={d.key}
              title={`${d.label} ${value}/${d.max}`}
              style={{ height: 3, background: '#ece6d9', borderRadius: 2, overflow: 'hidden' }}
            >
              <div
                style={{
                  width: `${Math.min(100, (value / d.max) * 100)}%`,
                  height: '100%',
                  background: muted ? '#cfc8b9' : DIMENSION_COLOURS[i],
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HR_COLOURS = { pass: '#3f7d55', drag: '#a07a33', fail: '#a35242' } as const;

/**
 * The HR read, beside the score and never folded into it.
 *
 * HR applies hard filters; a hiring manager reads the whole page. They reach
 * opposite verdicts often enough that averaging them would destroy the only
 * useful part — a row can be worth tailoring *and* likely to fail a portal
 * filter, which is what makes it a referral rather than an application.
 */
function HrChip({ job }: { job: QueuedJob }) {
  if (!job.hrVerdict) return null;
  return (
    <span
      title={job.hrNote || undefined}
      style={{
        fontFamily: SANS,
        fontSize: 10,
        letterSpacing: '.07em',
        color: HR_COLOURS[job.hrVerdict],
        border: `1px solid ${HR_COLOURS[job.hrVerdict]}44`,
        borderRadius: 4,
        padding: '1px 5px',
        whiteSpace: 'nowrap',
      }}
    >
      HR {job.hrVerdict.toUpperCase()}
    </span>
  );
}

/** The badge naming what to do, or what stopped it. */
function DecisionBadge({ job }: { job: QueuedJob }) {
  if (job.gate) {
    return (
      <span
        style={{
          fontFamily: SANS,
          fontSize: 10,
          letterSpacing: '.07em',
          color: '#a35242',
          border: '1px solid #a3524244',
          borderRadius: 4,
          padding: '1px 5px',
        }}
      >
        {gateLabel(job.gate).toUpperCase()}
      </span>
    );
  }
  if (job.decision === 'tailor') {
    return (
      <span
        style={{
          fontFamily: SANS,
          fontSize: 10,
          letterSpacing: '.07em',
          fontWeight: 600,
          color: '#f4f2ec',
          background: '#41678a',
          borderRadius: 4,
          padding: '2px 6px',
        }}
      >
        TAILOR
      </span>
    );
  }
  if (job.decision === 'general' && job.resumeTarget) {
    return (
      <span
        style={{
          fontFamily: SANS,
          fontSize: 10,
          letterSpacing: '.07em',
          color: '#41678a',
          border: '1px solid #41678a44',
          borderRadius: 4,
          padding: '1px 5px',
        }}
      >
        {targetLabel(job.resumeTarget).toUpperCase()}
      </span>
    );
  }
  return null;
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

  // Which collapsed bands the user has opened this visit. Not persisted: the
  // point of collapsing them is that they start out of the way each time.
  const [shown, setShown] = useState<Partial<Record<Band, boolean>>>({});
  const grouped = groupQueue(jobs);

  const renderRow = (j: QueuedJob) => {
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
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 7,
                marginTop: 5,
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: 11, color: '#8b939e' }}>
                {[j.location, when(j.capturedAt), j.workplaceType].filter(Boolean).join(' · ')}
              </span>
              <DecisionBadge job={j} />
              <HrChip job={j} />
              {j.softFloor && (
                <span
                  title="Carries an equivalency or new-grad clause — the only thing that overrides a years floor"
                  style={{
                    fontFamily: SANS,
                    fontSize: 10,
                    letterSpacing: '.07em',
                    color: '#3f7d55',
                    border: '1px solid #3f7d5544',
                    borderRadius: 4,
                    padding: '1px 5px',
                  }}
                >
                  SOFT FLOOR
                </span>
              )}
            </div>

            {j.reason && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: '#5f6a75',
                  borderLeft: '2px solid #e2dccd',
                  paddingLeft: 9,
                }}
              >
                {j.reason}
              </div>
            )}
            {j.hrVerdict && j.hrVerdict !== 'pass' && j.hrNote && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: SANS,
                  fontSize: 11,
                  color: '#a07a33',
                  paddingLeft: 11,
                }}
              >
                {j.hrNote}
              </div>
            )}
          </div>

          <ScoreBlock job={j} />

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
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
                copied?.id === j.id && copied.ok ? 'Description copied' : 'Copy description'
              }
              title={copied?.id === j.id && !copied.ok ? 'Copy failed' : 'Copy the description'}
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
                color: copied?.id === j.id ? (copied.ok ? '#3f7d55' : '#a35242') : '#8b939e',
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
          BANDS.map((band) => {
            const rows = grouped[band];
            if (rows.length === 0) return null;
            // Skip and blocked are kept behind their count: nothing in them
            // needs a decision, and they exist so a heuristic can be audited
            // rather than trusted silently.
            const collapsible = COLLAPSED.includes(band);
            const hidden = collapsible && !shown[band];
            return (
              <section key={band} style={{ marginBottom: hidden ? 8 : 22 }}>
                <button
                  onClick={() => collapsible && setShown((v) => ({ ...v, [band]: !v[band] }))}
                  aria-expanded={collapsible ? !hidden : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '0 0 9px',
                    fontFamily: SANS,
                    fontSize: 11,
                    letterSpacing: '.12em',
                    color: band === 'tailor' ? '#41678a' : '#8b939e',
                    cursor: collapsible ? 'pointer' : 'default',
                  }}
                >
                  {collapsible && (
                    <span style={{ fontSize: 9 }}>{hidden ? '\u25b8' : '\u25be'}</span>
                  )}
                  {bandLabel(band).toUpperCase()}
                  <span style={{ color: '#b9bfc7' }}>{rows.length}</span>
                </button>
                {!hidden && rows.map(renderRow)}
              </section>
            );
          })}
      </div>
    </div>
  );
}
