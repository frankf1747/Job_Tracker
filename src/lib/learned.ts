/**
 * What past applications teach about a new one.
 *
 * Some fields belong to the company, not the posting: a company's industry is
 * the same on every role it lists, and whatever was saved for it last time was
 * reviewed by a person. So once a company has been applied to, its industry
 * comes from that history rather than from keywords in the next posting. This
 * is the part of extraction that improves by itself: every save teaches it one
 * more company.
 */

import type { Draft } from './parsePosting';

const SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh|lp)\b\.?$/;

/** "Applied Materials, Inc." and "applied materials" are the same company. */
export function companyKey(name: string): string {
  let k = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  for (let i = 0; i < 2; i++) k = k.replace(SUFFIX, '').trim();
  return k;
}

type Past = { company: string; industry: string };

/**
 * The industry most often saved for this company, or null if it is new.
 * Ties go to the most recent, since the list is newest first.
 */
export function learnedIndustry(company: string, history: Past[]): string | null {
  const key = companyKey(company);
  if (!key) return null;
  const counts = new Map<string, number>();
  for (const h of history) {
    if (h.industry && companyKey(h.company) === key) {
      counts.set(h.industry, (counts.get(h.industry) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let most = 0;
  for (const [industry, n] of counts) {
    if (n > most) [best, most] = [industry, n];
  }
  return best;
}

/** A parsed draft, with what history knows put over the parser's guesses. */
export function withLearned(draft: Draft, history: Past[]): Draft {
  const industry = learnedIndustry(draft.company, history);
  return industry ? { ...draft, industry } : draft;
}
