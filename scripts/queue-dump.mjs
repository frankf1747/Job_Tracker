/**
 * Dump queued jobs to a JSON file, for scoring in a Claude Code session.
 *
 * Read-only and deliberately dumb: job_queue is behind row-level security, so
 * the anon key alone returns nothing and a real sign-in is required.
 *
 * Credentials come from scripts/supabase.mjs.
 *
 *   node scripts/queue-dump.mjs [outfile]
 */

import { writeFileSync } from 'node:fs';
import { connect, select } from './supabase.mjs';
import { gateFacts, gateFor } from './gates.mjs';

const COLUMNS =
  'id,company,position,location_raw,job_url,apply_url,description,salary,workplace_type,posted_note,created_at,' +
  // Included so a scoring run can see what is already done and skip it.
  'fit_problem,fit_skills,fit_experience,fit_score,fit_decision,fit_reason,hr_verdict,hr_note,gate,soft_floor,resume_target,scored_at';

const client = await connect();
const rows = await select(client, 'job_queue', `select=${COLUMNS}&order=created_at.desc`);

const enriched = rows.map((r) => {
  const facts = gateFacts(r.description || '');
  return { ...r, gates: { ...facts, gate: gateFor(facts) } };
});

const out = process.argv[2] ?? 'queue.json';
writeFileSync(out, JSON.stringify(enriched, null, 2));

console.log(`${rows.length} jobs -> ${out}`);
const gated = enriched.filter((r) => r.gates.gate != null).length;
const unscored = rows.filter((r) => r.scored_at == null).length;
console.log(
  `${unscored} unscored, ${rows.length - unscored} already scored, ${gated} gated before reading\n`,
);
for (const r of enriched) {
  const mark = r.scored_at == null ? '  --' : String(r.fit_score).padStart(4);
  const what =
    r.scored_at == null ? '' : `  ${r.fit_decision}${r.resume_target ? ':' + r.resume_target : ''}`;
  const g = r.gates.gate ? `  GATE:${r.gates.gate}` : '';
  console.log(
    `${mark} ${String(r.description?.length ?? 0).padStart(6)} chars  ${r.company} — ${r.position.slice(0, 40)}${what}${g}`,
  );
}
