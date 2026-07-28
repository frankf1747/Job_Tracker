import { useRef, useState } from 'react';
import type { Resume } from '../data/resumeStore';
import { MAX_PDF_BYTES, prettySize, resumeOptions } from '../lib/resumeOptions';
import { SANS, input, microLabel } from './styles';

/** Sentinel option that opens the inline creator rather than selecting a resume. */
const NEW = ' new';

export type NewResume = { label: string; tailored: boolean; file?: File };

/** A label not already taken, appending " (2)", " (3)"… only on a collision. */
function uniqueLabel(base: string, taken: Resume[]): string {
  const used = new Set(taken.map((r) => r.label.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * The resume picker, with a creator folded into it.
 *
 * A resume is often written for the role being logged, so requiring a trip to
 * the Resumes panel first would mean abandoning a half-filled application. The
 * creator is a two-step flow that keeps the common case light: attach the PDF
 * first, then decide. Left alone, it is filed against this one application under
 * an auto-derived name — no field to fill. Only "Keep for future use", which
 * promotes it into the reusable dropdown, asks for a name worth recognising.
 *
 * Nothing here touches storage. The creator only *stages* the resume; it is
 * written when the application is saved, so an abandoned draft leaves no trace.
 */
export function ResumeField({
  value,
  resumes,
  autoLabel,
  onSelect,
  onStage,
}: {
  value: string;
  resumes: Resume[];
  /** Name given to a role-only resume that the user doesn't name — "Position — Company". */
  autoLabel: string;
  onSelect: (label: string) => void;
  /** Hold the new resume against the draft; the parent persists it on save. */
  onStage: (r: NewResume) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  // Default role-only: a resume added while logging an application is usually
  // for that application. "Keep for future use" (checked) promotes it to general.
  const [tailored, setTailored] = useState(true);
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCreating(false);
    setLabel('');
    setTailored(true);
    setFile(undefined);
    setError(null);
  };

  const takeFile = (f: File | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) {
      setError('Only PDF files can be attached.');
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError(`That file is ${prettySize(f.size)} — the limit is 10 MB.`);
      return;
    }
    setError(null);
    setFile(f);
  };

  /** Stage the attached resume against the draft. Reached only via Done. */
  const stage = () => {
    if (!file) return;

    let name: string;
    if (tailored) {
      // Never asked for; derived so the row and the Resumes panel have something
      // to show. The filename is a fallback for the rare blank posting.
      const base =
        autoLabel.trim() || file.name.replace(/\.pdf$/i, '').trim() || 'Untitled resume';
      name = uniqueLabel(base, resumes);
    } else {
      name = label.trim();
      if (!name) {
        setError('Give it a name so you can recognise it later.');
        return;
      }
      if (resumes.some((r) => r.label.toLowerCase() === name.toLowerCase())) {
        setError('You already have a resume with that name.');
        return;
      }
    }

    onStage({ label: name, tailored, file });
    reset();
  };

  if (!creating) {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={microLabel}>Resume</span>
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === NEW) {
              setCreating(true);
              return;
            }
            onSelect(e.target.value);
          }}
          style={input}
        >
          {resumeOptions(resumes, value).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={NEW}>＋ New resume…</option>
        </select>
      </label>
    );
  }

  const future = !tailored;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={microLabel}>New resume</span>

      {/* Step one: attach a PDF. Everything else waits until there is a file. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          style={{
            background: 'transparent',
            border: '1px solid #ddd6c8',
            borderRadius: 6,
            padding: '6px 11px',
            fontSize: 11.5,
            color: '#41678a',
            whiteSpace: 'nowrap',
          }}
        >
          {file ? 'Change PDF' : 'Attach PDF'}
        </button>
        {file && (
          <span style={{ fontFamily: SANS, fontSize: 11.5, color: '#5f6a75' }}>
            {file.name} · {prettySize(file.size)}
          </span>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            takeFile(e.target.files?.[0]);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>

      {/* Step two: only once a PDF is on. Decide whether to keep it, then name it. */}
      {file && (
        <>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: SANS,
              fontSize: 11.5,
              color: '#5f6a75',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={future}
              onChange={(e) => setTailored(!e.target.checked)}
            />
            Keep for future use
          </label>

          {future && (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  stage();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  reset();
                }
              }}
              placeholder="e.g. Analytics — Regeneron"
              aria-label="New resume name"
              autoFocus
              style={input}
            />
          )}
        </>
      )}

      {error && (
        <div role="alert" style={{ fontFamily: SANS, fontSize: 11.5, color: '#a35242' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {file && (
          <button
            type="button"
            onClick={stage}
            style={{
              background: '#41678a',
              border: '1px solid #41678a',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#f4f2ec',
            }}
          >
            Done
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'transparent',
            border: '1px solid #ddd6c8',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 12,
            color: '#5f6a75',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
