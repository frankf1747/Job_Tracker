/**
 * The service worker: the only place that talks to Supabase.
 *
 * The content script runs inside LinkedIn's page and is deliberately kept away
 * from the session — it captures a job and hands it here. This also sidesteps
 * LinkedIn's Trusted Types policy, which rewrites DOM parsing done in the page
 * but has no reach into this context.
 */

import { queueJob, currentSession } from './supabase.js';
import { fetchJobDetails } from './linkedin.js';

/**
 * Fill in what the page could not give us, then store.
 *
 * The captured values win where present — they describe the posting actually on
 * screen — and enrichment only fills the blanks. A failed enrichment is logged
 * and ignored: a capture with a title and the two URLs is still worth keeping.
 */
async function captureAndQueue(job) {
  const details = job.externalId ? await fetchJobDetails(job.externalId) : { ok: false };
  if (details.ok) {
    console.info('[job-tracker] enriched via', details.via, `(${details.htmlChars} chars)`);
  } else {
    console.warn('[job-tracker] enrichment skipped:', details.reason);
  }

  const prefer = (captured, fetched) => (captured && captured.trim() ? captured : fetched || '');
  const merged = details.ok
    ? {
        ...job,
        position: prefer(job.position, details.position),
        company: prefer(job.company, details.company),
        location: prefer(job.location, details.location),
        description: prefer(job.description, details.description),
        postedNote: prefer(job.postedNote, details.postedNote),
      }
    : job;

  return queueJob(merged);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'queue-job') {
    captureAndQueue(msg.job)
      .then((row) => sendResponse({ ok: true, row }))
      .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
    // Keeps the message channel open for the async reply above.
    return true;
  }

  if (msg?.type === 'session') {
    currentSession()
      .then((s) => sendResponse({ ok: true, signedIn: !!s }))
      .catch(() => sendResponse({ ok: true, signedIn: false }));
    return true;
  }

  return false;
});
