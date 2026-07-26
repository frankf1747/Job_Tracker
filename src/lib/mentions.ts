/**
 * Splitting outreach notes into plain text and @mentions, for highlighting.
 *
 * A mention is `@` followed by a first name-token of any case, then any number
 * of following capitalised tokens — so "@Kristen Lee" highlights both words,
 * while "@kristen called back" highlights only "kristen". Requiring the
 * continuation words to be capitalised is what stops a whole sentence after an
 * @ from being swallowed into one mention.
 */

const MENTION_RE = /@\w[\w'’.-]*(?:[ \t]+[A-Z][\w'’.-]*)*/g;

export type NoteSegment = { text: string; mention: boolean };

export function splitMentions(text: string): NoteSegment[] {
  const out: NoteSegment[] = [];
  let last = 0;

  for (const m of text.matchAll(MENTION_RE)) {
    const start = m.index;
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: m[0], mention: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });

  return out;
}

/** The distinct names mentioned in a note, without the leading @. */
export function mentionedNames(text: string): string[] {
  const names = splitMentions(text)
    .filter((s) => s.mention)
    .map((s) => s.text.slice(1).trim());
  return [...new Set(names)];
}
