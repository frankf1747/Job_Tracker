import { useEffect, useRef, useState } from 'react';
import { SANS } from './styles';

/**
 * A clickable way in, for when paste-anywhere is not discoverable or not
 * possible.
 *
 * A textarea rather than navigator.clipboard.readText(): reading the clipboard
 * prompts or fails outright in Safari and Firefox, and on a phone there is no
 * page to paste onto at all — only a field. Whatever is pasted here goes
 * through exactly the same parse and review as a paste anywhere on the page.
 */
export function AddPositionDialog({
  pasteKey,
  onRead,
  onManual,
  onClose,
}: {
  pasteKey: string;
  /** Parse the posting. Returns false if it does not look like one. */
  onRead: (text: string) => boolean;
  /** Skip the paste and fill the review form by hand. */
  onManual: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [rejected, setRejected] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    field.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const read = () => {
    const t = text.trim();
    if (!t) return;
    // Rejected text stays in the box, so it can be fixed rather than re-pasted.
    if (!onRead(t)) setRejected(true);
  };

  const empty = text.trim() === '';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add a position"
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
          width: 580,
          maxWidth: '100%',
          boxShadow: '0 30px 70px rgba(0,0,0,.32)',
          animation: 'cardIn .28s cubic-bezier(.2,.8,.2,1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2dccd' }}>
          <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.1em', color: '#41678a' }}>
            ADD A POSITION
          </div>
          <h3 style={{ margin: '6px 0 0', fontSize: 19, fontWeight: 700, letterSpacing: '-.02em' }}>
            Paste the job posting
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#8b939e' }}>
            The whole thing — title, company and description. You check every field before it saves.
          </p>
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <textarea
            ref={field}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setRejected(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                read();
              }
            }}
            placeholder="Paste here…"
            aria-label="Job posting text"
            aria-invalid={rejected}
            rows={12}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              background: '#fff',
              border: `1px solid ${rejected ? '#a35242' : '#ddd6c8'}`,
              borderRadius: 7,
              padding: '11px 12px',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: '#37414c',
              fontFamily: 'inherit',
            }}
          />
          <div
            role={rejected ? 'alert' : undefined}
            style={{
              minHeight: 18,
              marginTop: 6,
              fontFamily: SANS,
              fontSize: 11.5,
              color: rejected ? '#a35242' : '#9aa3ad',
            }}
          >
            {rejected
              ? "That doesn't look like a job posting — try copying the full page text."
              : `${pasteKey} + Enter to read it`}
          </div>
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2dccd',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            background: '#f2efe7',
          }}
        >
          <button
            onClick={onManual}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              fontSize: 12.5,
              color: '#41678a',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              marginRight: 'auto',
            }}
          >
            Enter details by hand instead
          </button>
          <button
            onClick={onClose}
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
            Cancel
          </button>
          <button
            onClick={read}
            disabled={empty}
            style={{
              background: '#41678a',
              border: '1px solid #41678a',
              borderRadius: 7,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 600,
              color: '#f4f2ec',
              opacity: empty ? 0.5 : 1,
              cursor: empty ? 'default' : 'pointer',
            }}
          >
            Read posting →
          </button>
        </div>
      </div>
    </div>
  );
}
