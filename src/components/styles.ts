/**
 * Style values shared across sections, lifted from the design prototype.
 *
 * Everything else stays inline next to the markup it applies to, matching how
 * the prototype was authored — these are only the ones repeated verbatim.
 */

import type { CSSProperties } from 'react';

export const SANS = "'Archivo', sans-serif";
export const SERIF = "'Source Serif 4', Georgia, serif";
export const SERIF_JP = "'Source Serif 4', 'Noto Serif JP', Georgia, serif";
export const SCRIPT = "'Caveat', cursive";

/** The hand-highlighted section headings. */
export const sectionHeading: CSSProperties = {
  margin: 0,
  fontFamily: SCRIPT,
  fontSize: 29,
  fontWeight: 700,
  letterSpacing: '.01em',
  color: '#2c3640',
  lineHeight: 0.9,
  background: 'linear-gradient(transparent 62%, #c3d6e6 62%, #c3d6e6 96%, transparent 96%)',
  padding: '0 6px 2px',
  WebkitBoxDecorationBreak: 'clone',
  boxDecorationBreak: 'clone',
};

export const sectionHeadingRow: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  margin: '0 0 14px',
};

export const section: CSSProperties = { marginTop: 46 };

/** The small letter-spaced label above each panel. */
export const panelLabel: CSSProperties = {
  fontFamily: SANS,
  fontSize: 11,
  color: '#8b939e',
  letterSpacing: '.18em',
  marginBottom: 16,
};

/** Uppercase micro-label used inside cards and the review modal. */
export const microLabel: CSSProperties = {
  fontFamily: SANS,
  fontSize: 10,
  letterSpacing: '.06em',
  color: '#8b939e',
  textTransform: 'uppercase',
};

/** Field wrapper in the review modal. */
export const field: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

export const input: CSSProperties = {
  background: '#fff',
  border: '1.5px solid #cfc8b9',
  borderRadius: 6,
  padding: '9px 11px',
  fontSize: 13,
};

/** Inputs holding an inferred guess, flagged so the user re-checks them. */
export const guessInput: CSSProperties = {
  background: '#fdf6ea',
  border: '1.5px dashed #dcb98a',
  borderRadius: 6,
  padding: '9px 11px',
  fontSize: 13,
  color: '#7a5a24',
};

/**
 * A select drawn with its own chevron. The browser's arrow ignores padding and
 * sits hard against the right border; this one is inset to match the text's
 * left inset, and centred vertically.
 */
function asSelect(base: CSSProperties, chevron: string): CSSProperties {
  const { background, ...rest } = base;
  return {
    ...rest,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundColor: background as string,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='${encodeURIComponent(chevron)}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '10px 6px',
    paddingRight: 32,
  };
}

export const selectInput = asSelect(input, '#5f6a75');
export const guessSelect = asSelect(guessInput, '#a87a3a');

export const guessLabel: CSSProperties = { ...microLabel, color: '#c98a3a' };

/** Table header cell. */
export const th: CSSProperties = {
  textAlign: 'left',
  padding: '11px 14px',
  fontFamily: SANS,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '.06em',
  color: '#5f6a75',
  whiteSpace: 'nowrap',
};

export const sortableTh: CSSProperties = { ...th, cursor: 'pointer' };

/** Detail-panel field label inside an expanded table row. */
export const detailLabel: CSSProperties = {
  fontFamily: SANS,
  fontSize: 9.5,
  letterSpacing: '.08em',
  color: '#8b939e',
};

export const detailValue: CSSProperties = { fontSize: 12.5, color: '#37414c' };

export const detailCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

/** Resets a button back to plain text so it can wrap arbitrary content. */
export const bareButton: CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
};
