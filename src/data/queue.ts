/**
 * The only module that knows the queue lives in Supabase.
 *
 * Mirrors data/applications.ts: everything above speaks `QueuedJob`, everything
 * here speaks snake_case rows, and the translation stays in one place.
 *
 * The tracker only reads and removes. Rows are written by the Chrome extension,
 * which inserts straight into the same table under the same row-level security —
 * so there is no create path here.
 */

import { requireSupabase } from '../lib/supabase';

const TABLE = 'job_queue';
const COLUMNS =
  'id,source,external_id,company,position,location_raw,job_url,apply_url,description,salary,workplace_type,posted_note,created_at';

/** A job captured from a posting but not applied to yet. */
export type QueuedJob = {
  id: string;
  /** Which site it came from, e.g. "linkedin". */
  source: string;
  /** That site's own id for the posting, used to dedupe a re-capture. */
  externalId: string | null;
  company: string;
  position: string;
  location: string;
  /** The posting itself. Always present. */
  jobUrl: string;
  /**
   * The employer's application page, unwrapped from LinkedIn's redirect. Null
   * for Easy Apply postings, which have no off-site URL — jobUrl stands in.
   */
  applyUrl: string | null;
  /** The full job description, kept so promoting can infer skills and industry. */
  description: string;
  salary: string;
  workplaceType: string;
  /** Raw as the posting worded it, e.g. "Reposted 4 days ago". */
  postedNote: string;
  /** When it was captured. */
  capturedAt: number;
};

/** Shape as stored. Mirrors supabase/migrations/20260913000000_job_queue.sql. */
type Row = {
  id: string;
  source: string;
  external_id: string | null;
  company: string;
  position: string;
  location_raw: string;
  job_url: string;
  apply_url: string | null;
  description: string;
  salary: string;
  workplace_type: string;
  posted_note: string;
  created_at: string;
};

export function toQueuedJob(row: Row): QueuedJob {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    company: row.company,
    position: row.position,
    location: row.location_raw,
    jobUrl: row.job_url,
    applyUrl: row.apply_url,
    description: row.description,
    salary: row.salary,
    workplaceType: row.workplace_type,
    postedNote: row.posted_note,
    capturedAt: Date.parse(row.created_at),
  };
}

/** Everything waiting to be applied to, newest capture first. */
export async function listQueue(): Promise<QueuedJob[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Row[]).map(toQueuedJob);
}

/** Drop a queued job — either discarded, or promoted into an application. */
export async function deleteQueued(id: string): Promise<void> {
  const { error } = await requireSupabase().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
