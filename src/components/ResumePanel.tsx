import { useEffect, useRef, useState } from 'react';
import type { Resume } from '../data/resumeStore';
import { deleteResumeFile, getResumeFile, makeResume, putResumeFile } from '../data/resumeStore';
import { SANS, microLabel } from './styles';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function prettySize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Manage the list of resume versions and the PDF attached to each.
 *
 * The labels here populate the resume dropdown in the review modal, so renaming
 * one is a rename everywhere — rows keep referring to it by label.
 */
export function ResumePanel({
  resumes,
  onChange,
  onClose,
}: {
  resumes: Resume[];
  onChange: (next: Resume[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (resumes.some((r) => r.label.toLowerCase() === label.toLowerCase())) {
      setError('You already have a resume with that name.');
      return;
    }
    setError(null);
    onChange([...resumes, makeResume(label)]);
    setDraft('');
  };

  const rename = (id: string, label: string) =>
    onChange(
      resumes.map((r) => (r.id === id ? { ...r, label, updatedAt: new Date().toISOString() } : r)),
    );

  const setTailored = (id: string, tailored: boolean) =>
    onChange(
      resumes.map((r) =>
        r.id === id ? { ...r, tailored, updatedAt: new Date().toISOString() } : r,
      ),
    );

  const remove = async (id: string) => {
    await deleteResumeFile(id);
    onChange(resumes.filter((r) => r.id !== id));
  };

  const pickFile = (id: string) => {
    fileFor.current = id;
    setError(null);
    fileInput.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const id = fileFor.current;
    fileFor.current = null;
    if (!file || !id) return;

    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('Only PDF files can be attached.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`That file is ${prettySize(file.size)} — the limit is 10 MB.`);
      return;
    }

    setBusyId(id);
    try {
      await putResumeFile(id, file);
      onChange(
        resumes.map((r) =>
          r.id === id
            ? {
                ...r,
                fileName: file.name,
                fileSize: file.size,
                updatedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
    } catch {
      setError("Couldn't save that file. Your browser may be blocking local storage.");
    } finally {
      setBusyId(null);
    }
  };

  const openPdf = async (id: string) => {
    const blob = await getResumeFile(id);
    if (!blob) {
      setError('That file is no longer stored. Try attaching it again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    // Give the new tab time to claim the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const detach = async (id: string) => {
    await deleteResumeFile(id);
    onChange(
      resumes.map((r) =>
        r.id === id
          ? { ...r, fileName: undefined, fileSize: undefined, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
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
        value={r.label}
        onChange={(e) => rename(r.id, e.target.value)}
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
        onClick={() => setTailored(r.id, !r.tailored)}
        aria-pressed={r.tailored}
        title={
          r.tailored
            ? 'Role-specific — kept out of the picker. Click to make it general.'
            : 'General — offered in the picker. Click to mark it role-only.'
        }
        style={{
          flex: 'none',
          background: r.tailored ? '#f3e7d1' : '#eef1f4',
          border: `1px solid ${r.tailored ? '#e3cfa0' : '#d6dde4'}`,
          color: r.tailored ? '#8a6420' : '#5f7488',
          borderRadius: 999,
          padding: '3px 9px',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '.05em',
          fontFamily: SANS,
          whiteSpace: 'nowrap',
        }}
      >
        {r.tailored ? 'ROLE-ONLY' : 'GENERAL'}
      </button>

      {r.fileName ? (
        <button
          onClick={() => openPdf(r.id)}
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
        onClick={() => (r.fileName ? detach(r.id) : pickFile(r.id))}
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
        onClick={() => remove(r.id)}
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
          {resumes.length === 0 && (
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
          )}

          {general.map((r) => renderRow(r))}

          {tailored.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 2px 0' }}>
              <span style={{ ...microLabel, whiteSpace: 'nowrap' }}>ROLE-SPECIFIC</span>
              <span style={{ fontFamily: SANS, fontSize: 10.5, color: '#aeb6bf' }}>
                kept out of the picker
              </span>
              <div style={{ flex: 1, height: 1, background: '#e7e2d5' }} />
            </div>
          )}

          {tailored.map((r) => renderRow(r))}

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
                    add();
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
              <button
                onClick={add}
                style={{
                  background: '#41678a',
                  border: '1px solid #41678a',
                  borderRadius: 7,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#f4f2ec',
                  flex: 'none',
                }}
              >
                Add
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
          Stored in this browser for now. Both the list and the PDFs move to your account once the
          database is wired up — nothing here is lost in that move.
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
