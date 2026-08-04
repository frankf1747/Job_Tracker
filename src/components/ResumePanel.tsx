import { useEffect, useRef, useState } from 'react';
import type { Resume } from '../data/resumeStore';
import { MAX_PDF_BYTES, prettySize } from '../lib/resumeOptions';
import { SANS, microLabel } from './styles';

/**
 * Manage the list of resume versions and the PDF attached to each.
 *
 * The panel is storage-agnostic: it calls the operations passed in and shows
 * what comes back. App points those at Supabase when signed in and at the
 * browser when not, so the same panel serves both. The labels here populate the
 * resume dropdown in the review modal, so renaming one is a rename everywhere —
 * rows keep referring to it by label.
 */
export function ResumePanel({
  resumes,
  live,
  loading,
  onAdd,
  onRename,
  onToggleTailored,
  onDelete,
  onAttach,
  onDetach,
  onOpenFile,
  onClose,
}: {
  resumes: Resume[];
  /** Signed in: resumes persist to the account rather than this browser. */
  live: boolean;
  loading: boolean;
  onAdd: (label: string, file?: File) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
  onToggleTailored: (id: string, tailored: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAttach: (id: string, file: File) => Promise<void>;
  onDetach: (id: string) => Promise<void>;
  onOpenFile: (id: string) => Promise<Blob | null>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRole, setShowRole] = useState(false);
  // In-progress rename text, per row. Kept local so typing stays smooth and the
  // rename commits once on blur rather than on every keystroke — the latter
  // would be a database write per character when signed in.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [addBusy, setAddBusy] = useState(false);
  const fileFor = useRef<string | null>(null);
  // True while the file picker is open for the "Add a version" row rather than
  // an existing row, so the one hidden input can serve both.
  const addFile = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Run a row operation with a busy marker and a single error surface. */
  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Couldn't save that change. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const commitRename = async (r: Resume) => {
    const next = (edits[r.id] ?? r.label).trim();
    setEdits((e) => {
      const { [r.id]: _drop, ...rest } = e;
      return rest;
    });
    if (!next || next === r.label) return;
    if (resumes.some((o) => o.id !== r.id && o.label.toLowerCase() === next.toLowerCase())) {
      setError('You already have a resume with that name.');
      return;
    }
    await run(r.id, () => onRename(r.id, next));
  };

  const pickFile = (id: string) => {
    fileFor.current = id;
    setError(null);
    fileInput.current?.click();
  };

  const pickAddFile = () => {
    addFile.current = true;
    setError(null);
    fileInput.current?.click();
  };

  /** Add a new version whose PDF is `file`, named from the field or the file. */
  const addWithFile = async (file: File) => {
    const label = draft.trim() || file.name.replace(/\.pdf$/i, '').trim() || 'Resume';
    if (resumes.some((r) => r.label.toLowerCase() === label.toLowerCase())) {
      setError('You already have a resume with that name.');
      return;
    }
    setError(null);
    setAddBusy(true);
    try {
      await onAdd(label, file);
      setDraft('');
    } catch {
      setError("Couldn't add that resume. Please try again.");
    } finally {
      setAddBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    const addingVersion = addFile.current;
    addFile.current = false;
    const id = fileFor.current;
    fileFor.current = null;
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('Only PDF files can be attached.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`That file is ${prettySize(file.size)} — the limit is 10 MB.`);
      return;
    }
    if (addingVersion) {
      await addWithFile(file);
      return;
    }
    if (!id) return;
    await run(id, () => onAttach(id, file));
  };

  const openPdf = async (id: string) => {
    setError(null);
    const blob = await onOpenFile(id).catch(() => null);
    if (!blob) {
      setError('That file is no longer stored. Try attaching it again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Give the new tab time to claim the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // Split so the picker's contents (general) sit apart from role-specific
  // one-offs, matching how the picker itself hides the tailored ones.
  const general = resumes.filter((r) => !r.tailored);
  const tailored = resumes.filter((r) => r.tailored);

  const renderRow = (r: Resume) => (
    <div
      key={r.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#fff',
        border: '1px solid #e2dccd',
        // A gold left accent marks role-specific rows at a glance, echoing the badge.
        borderLeftWidth: r.tailored ? 3 : 1,
        borderLeftColor: r.tailored ? '#d9b877' : '#e2dccd',
        borderRadius: 7,
        padding: '9px 11px',
      }}
    >
      <input
        value={edits[r.id] ?? r.label}
        onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
        onBlur={() => void commitRename(r)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={`Name for ${r.label}`}
        style={{
          flex: 1,
          minWidth: 0,
          border: '1px solid transparent',
          borderRadius: 5,
          background: 'transparent',
          padding: '5px 6px',
          fontSize: 13,
          fontWeight: 600,
          color: '#2c3640',
        }}
      />

      <button
        onClick={() => void run(r.id, () => onToggleTailored(r.id, !r.tailored))}
        aria-label={r.tailored ? 'Make general' : 'Make role-only'}
        title={r.tailored ? 'Make general' : 'Make role-only'}
        style={{
          flex: 'none',
          background: 'transparent',
          border: '1px solid #ddd6c8',
          borderRadius: 6,
          padding: '4px 7px',
          fontSize: 12,
          lineHeight: 1,
          color: '#8b939e',
        }}
      >
        ⇄
      </button>

      {r.fileName ? (
        <button
          onClick={() => void openPdf(r.id)}
          title={`${r.fileName}${r.fileSize ? ' · ' + prettySize(r.fileSize) : ''}`}
          style={{
            background: '#e7edf3',
            border: '1px solid #cfdce6',
            color: '#3f6079',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 11,
            fontFamily: SANS,
            maxWidth: 130,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          {r.fileName}
        </button>
      ) : (
        <span style={{ fontFamily: SANS, fontSize: 11, color: '#aeb6bf', flex: 'none' }}>
          no PDF
        </span>
      )}

      <button
        onClick={() => (r.fileName ? void run(r.id, () => onDetach(r.id)) : pickFile(r.id))}
        disabled={busyId === r.id}
        style={{
          background: 'transparent',
          border: '1px solid #ddd6c8',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 11.5,
          color: '#5f6a75',
          flex: 'none',
        }}
      >
        {busyId === r.id ? 'Saving…' : r.fileName ? 'Replace' : 'Attach PDF'}
      </button>

      <button
        onClick={() => void run(r.id, () => onDelete(r.id))}
        aria-label={`Delete ${r.label}`}
        title="Delete"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#a99f8e',
          fontSize: 17,
          lineHeight: 1,
          padding: '0 2px',
          flex: 'none',
        }}
      >
        ×
      </button>
    </div>
  );

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Resumes"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(40,48,60,.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 75,
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
          width: 560,
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
              CONFIGURE
            </div>
            <h3
              style={{ margin: '6px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}
            >
              Resumes
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#8b939e' }}>
              These names fill the resume picker when you save an application.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
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

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ padding: '22px 0', textAlign: 'center', color: '#9aa3ad', fontSize: 13 }}>
              Loading your resumes…
            </div>
          ) : (
            resumes.length === 0 && (
              <div
                style={{
                  padding: '22px 0',
                  textAlign: 'center',
                  color: '#9aa3ad',
                  fontSize: 13,
                }}
              >
                No resumes yet — add your first below.
              </div>
            )
          )}

          {general.map((r) => renderRow(r))}

          {tailored.length > 0 && (
            <button
              onClick={() => setShowRole((v) => !v)}
              aria-expanded={showRole}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                margin: '6px 2px 0',
                background: 'transparent',
                border: 'none',
                padding: 0,
                width: '100%',
              }}
            >
              <span style={{ fontSize: 10, color: '#8b939e' }}>{showRole ? '▾' : '▸'}</span>
              <span style={{ ...microLabel, whiteSpace: 'nowrap' }}>
                ROLE-SPECIFIC ({tailored.length})
              </span>
              <div style={{ flex: 1, height: 1, background: '#e7e2d5' }} />
            </button>
          )}

          {showRole && tailored.map((r) => renderRow(r))}

          {error && (
            <div
              role="alert"
              style={{
                background: '#f7ecd4',
                border: '1px solid #e7d5a8',
                color: '#8a6420',
                borderRadius: 6,
                padding: '8px 11px',
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
            <span style={microLabel}>Add a version</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    pickAddFile();
                  }
                }}
                placeholder="e.g. Analytics v4"
                style={{
                  flex: 1,
                  background: '#fff',
                  border: '1.5px solid #cfc8b9',
                  borderRadius: 6,
                  padding: '9px 11px',
                  fontSize: 13,
                }}
              />
              {/* Choosing a PDF adds the version in one step — named from the
                  field, or from the filename when it's left blank. */}
              <button
                onClick={pickAddFile}
                disabled={addBusy}
                title="Add a version with a PDF attached"
                style={{
                  background: 'transparent',
                  border: '1px solid #cfc8b9',
                  borderRadius: 7,
                  padding: '9px 14px',
                  fontSize: 13,
                  color: '#41678a',
                  flex: 'none',
                }}
              >
                {addBusy ? 'Adding…' : 'Attach PDF'}
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '13px 24px',
            borderTop: '1px solid #e2dccd',
            background: '#f2efe7',
            fontFamily: SANS,
            fontSize: 11,
            color: '#9aa3ad',
            lineHeight: 1.6,
          }}
        >
          {live
            ? 'Saved to your account — sign in on any device to find them here.'
            : 'Stored in this browser. Sign in to save resumes to your account and reach them from any device.'}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
