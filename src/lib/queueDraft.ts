/**
 * Turning a queued job into a reviewable draft.
 *
 * The capture already knows the things a posting states outright — company,
 * title, location, the links. Everything inferred (skills, industry, level,
 * employment type) is left to the same parser a pasted posting goes through, so
 * a promoted job and a pasted one reach the review modal by the same route.
 */

import { parsePostingLocal, type Draft } from './parsePosting';
import type { QueuedJob } from '../data/queue';
import { isoOf } from './derive';

export function draftFromQueued(job: QueuedJob, today: Date): Draft {
  // The description carries the requirements the inference relies on; without
  // one, the title and company still give the parser something to work from.
  const text = job.description?.trim() || `${job.position}\n${job.company}`;
  const parsed = parsePostingLocal(text, today);

  return {
    ...parsed,
    // Captured fields win: they describe the posting as it was listed, rather
    // than as the parser guessed from prose.
    company: job.company || parsed.company,
    position: job.position || parsed.position,
    location: job.location || parsed.location,
    salary: job.salary || parsed.salary,
    // The employer's page where possible, so the saved row links where you
    // actually applied rather than back to the aggregator.
    sourceUrl: job.applyUrl || job.jobUrl || '',
    appliedDate: isoOf(today),
    resume: '',
    draft: '',
  };
}
