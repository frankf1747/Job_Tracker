/**
 * Writes the extraction log. See lib/extractionLog.ts for what it is for.
 *
 * Fire and forget: the log is for improving the parser later, so a failed
 * write must never fail or slow down saving the application itself. That also
 * makes it safe to ship before the table's migration has been run.
 */

import { requireSupabase } from '../lib/supabase';
import type { LogEntry } from '../lib/extractionLog';

export function logExtraction(entry: LogEntry, userId: string, applicationId: string): void {
  void Promise.resolve()
    .then(() =>
      requireSupabase().from('extraction_log').insert({
        user_id: userId,
        application_id: applicationId,
        origin: entry.origin,
        proposed: entry.proposed,
        saved: entry.saved,
        changed: entry.changed,
        sources: entry.sources,
        site: entry.site,
        parser_version: entry.parserVersion,
      }),
    )
    .then(({ error }) => {
      if (error) console.warn('extraction log not written:', error.message);
    })
    .catch(() => undefined);
}
