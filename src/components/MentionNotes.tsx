import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { splitMentions } from '../lib/mentions';
import { SANS } from './styles';

/**
 * A notes field that highlights @mentions as you type.
 *
 * A textarea can't style parts of its own text, so this is the standard
 * backdrop trick: a div behind the textarea renders the same text with the
 * mentions wrapped in <mark>, and the textarea's own text is made transparent
 * (caret and selection stay visible). The two share one style object so their
 * glyphs line up exactly; the backdrop mirrors the textarea's auto-grown height.
 */

const shared: CSSProperties = {
  width: '100%',
  margin: 0,
  border: '1px solid transparent',
  borderRadius: 5,
  padding: '6px 8px',
  fontSize: 12.5,
  lineHeight: 1.45,
  fontFamily: SANS,
  letterSpacing: 'normal',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  boxSizing: 'border-box',
};

export function MentionNotes({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const back = useRef<HTMLDivElement>(null);

  // Grow to fit the content, and keep the backdrop the same height.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = el.scrollHeight + 'px';
    el.style.height = h;
    if (back.current) back.current.style.height = h;
  }, [value]);

  const segments = splitMentions(value);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={back}
        aria-hidden="true"
        style={{
          ...shared,
          position: 'absolute',
          inset: 0,
          color: '#37414c',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {value === '' ? (
          <span style={{ color: '#9aa3ad' }}>{placeholder}</span>
        ) : (
          segments.map((s, i) =>
            s.mention ? (
              <mark
                key={i}
                style={{
                  background: '#dbe7f2',
                  color: '#2c4a66',
                  borderRadius: 3,
                  padding: '0 1px',
                }}
              >
                {s.text}
              </mark>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )
        )}
        {/* A trailing newline has no glyph to give the last line height. */}
        {value.endsWith('\n') ? '​' : ''}
      </div>
      <textarea
        ref={ta}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        rows={1}
        className="company-cell"
        style={{
          ...shared,
          position: 'relative',
          display: 'block',
          background: 'transparent',
          color: 'transparent',
          caretColor: '#37414c',
          resize: 'none',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
