import { useEffect } from 'react';
import type { Draft } from '../lib/parsePosting';
import { INDUSTRIES, LEVELS, RESUMES, STATUSES } from '../lib/schema';
import type { Status } from '../lib/schema';
import { SANS, field, guessInput, guessLabel, input, microLabel } from './styles';

/**
 * The confirmation step between parsing a posting and saving it.
 *
 * Nothing reaches the database without passing through here — the parser is
 * allowed to guess precisely because every guess is shown and editable first.
 * Amber styling marks the inferred fields.
 */
export function ReviewModal({
  review,
  onPatch,
  onAddSkill,
  onRemoveSkill,
  onDiscard,
  onSave,
  saving,
}: {
  review: Draft;
  onPatch: (patch: Partial<Draft>) => void;
  onAddSkill: () => void;
  onRemoveSkill: (index: number) => void;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDiscard();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDiscard]);

  return (
    <div
      onClick={onDiscard}
      role="dialog"
      aria-modal="true"
      aria-label="Review before saving"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(40,48,60,.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 70,
        padding: '40px 20px',
        overflow: 'auto',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fbfaf7',
          border: '1px solid #d8d1c2',
          borderRadius: 9,
          width: 640,
          maxWidth: '100%',
          boxShadow: '0 30px 70px rgba(0,0,0,.32)',
          animation: 'cardIn .28s cubic-bezier(.2,.8,.2,1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #e2dccd',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.1em', color: '#41678a' }}
            >
              ✓ EXTRACTED FROM CLIPBOARD
            </div>
            <h3
              style={{ margin: '6px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}
            >
              Review before saving
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#8b939e' }}>
              Edit anything. <span style={{ color: '#c98a3a' }}>Amber</span> fields are inferred
              guesses — double-check them.
            </p>
          </div>
          <button
            onClick={onDiscard}
            aria-label="Discard"
            style={{
              background: '#efece3',
              border: '1px solid #ddd6c8',
              borderRadius: 6,
              width: 30,
              height: 30,
              fontSize: 16,
              color: '#5f6a75',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={field}>
              <span style={microLabel}>Position</span>
              <input
                value={review.position}
                onChange={(e) => onPatch({ position: e.target.value })}
                style={{ ...input, fontWeight: 600 }}
              />
            </label>
            <label style={field}>
              <span style={microLabel}>Company</span>
              <input
                value={review.company}
                onChange={(e) => onPatch({ company: e.target.value })}
                style={{ ...input, fontWeight: 600 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={microLabel}>Skills</span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
                background: '#fff',
                border: '1.5px solid #cfc8b9',
                borderRadius: 6,
                padding: '8px 10px',
                minHeight: 42,
              }}
            >
              {review.skills.map((s, i) => (
                <span
                  key={s}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#e7edf3',
                    border: '1px solid #cfdce6',
                    color: '#3f6079',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 12,
                  }}
                >
                  {s}
                  <button
                    onClick={() => onRemoveSkill(i)}
                    aria-label={`Remove ${s}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 0.6,
                      color: '#7f9cb2',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={review.draft}
                onChange={(e) => onPatch({ draft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddSkill();
                  }
                }}
                placeholder="add skill + Enter"
                aria-label="Add a skill"
                style={{
                  flex: 1,
                  minWidth: 110,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12.5,
                  padding: 2,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={field}>
              <span style={guessLabel}>Industry · guess</span>
              <select
                value={review.industry}
                onChange={(e) => onPatch({ industry: e.target.value })}
                style={guessInput}
              >
                {INDUSTRIES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              <span style={guessLabel}>Level · guess</span>
              <select
                value={review.level}
                onChange={(e) => onPatch({ level: e.target.value })}
                style={guessInput}
              >
                {LEVELS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={field}>
              <span style={microLabel}>Location</span>
              <input
                value={review.location}
                onChange={(e) => onPatch({ location: e.target.value })}
                placeholder="City, ST / Remote"
                style={input}
              />
            </label>
            <label style={field}>
              <span style={microLabel}>Salary range</span>
              <input
                value={review.salary}
                onChange={(e) => onPatch({ salary: e.target.value })}
                placeholder="—"
                style={input}
              />
            </label>
          </div>

          <label style={field}>
            <span style={microLabel}>Source URL</span>
            <input
              value={review.sourceUrl}
              onChange={(e) => onPatch({ sourceUrl: e.target.value })}
              placeholder="https://…"
              style={{ ...input, fontSize: 12.5, color: '#41678a', fontFamily: SANS }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              paddingTop: 14,
              borderTop: '1px dashed #ddd6c8',
            }}
          >
            <label style={field}>
              <span style={microLabel}>Status</span>
              <select
                value={review.status}
                onChange={(e) => onPatch({ status: e.target.value as Status })}
                style={input}
              >
                {STATUSES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              <span style={microLabel}>Applied date</span>
              <input
                type="date"
                value={review.appliedDate}
                onChange={(e) => onPatch({ appliedDate: e.target.value })}
                style={{ ...input, padding: '8px 11px' }}
              />
            </label>
            <label style={field}>
              <span style={microLabel}>Resume</span>
              <select
                value={review.resume}
                onChange={(e) => onPatch({ resume: e.target.value })}
                style={input}
              >
                {RESUMES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2dccd',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#f2efe7',
          }}
        >
          <button
            onClick={onDiscard}
            style={{
              background: 'transparent',
              border: '1px solid #cfc8b9',
              borderRadius: 7,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 500,
              color: '#5f6a75',
            }}
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              background: '#41678a',
              border: '1px solid #41678a',
              borderRadius: 7,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 600,
              color: '#f4f2ec',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Add to tracker →'}
          </button>
        </div>
      </div>
    </div>
  );
}
