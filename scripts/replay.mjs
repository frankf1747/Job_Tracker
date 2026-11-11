/**
 * Replay: run the current parser over every saved application that kept its
 * posting text, and score it against what was saved.
 *
 *   node scripts/replay.mjs                 accuracy, top misses, noisy skills
 *   node scripts/replay.mjs --out misses.json   every miss, for analysis
 *   node scripts/replay.mjs --baseline      record these scores as the baseline
 *   node scripts/replay.mjs --save rows.json    also keep the fetched rows, and
 *   node scripts/replay.mjs --from rows.json    replay those without signing in
 *
 * The saved rows are labelled data: the posting next to the values that were
 * approved. So any change to the rules can be scored before it ships, and a
 * fix for one site can be checked not to break another. Scores are compared to
 * scripts/replay-baseline.json when it exists.
 *
 * Two limits. Company, title and location are only scored where the stored
 * text still has the posting's header: a queued job's text is just the body,
 * those fields came from the extension's capture, and there is nothing in the
 * body to read them from. The extraction log covers the capture. And a wrong
 * value nobody corrected counts as right here.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { connect, select } from './supabase.mjs';
import { loadParser } from './parser.mjs';
import { FIELDS, formatScore, hasHeader, score, skillTrouble } from './extraction-score.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const outPath = opt('--out');
const BASELINE = new URL('./replay-baseline.json', import.meta.url);

const INFERRED = ['skills', 'industry', 'level', 'employmentType'];

const { parsePostingLocal, normalizeLoc, withLearned, PARSER_VERSION } = await loadParser();

// Every row, oldest first: each posting is replayed knowing only the rows
// saved before it, which is all the app knew when it was reviewed.
const everything = opt('--from')
  ? JSON.parse(readFileSync(opt('--from'), 'utf8'))
  : await select(
      await connect(),
      'applications',
      'select=id,company,position,location_raw,skills,industry,level,employment_type,salary,description,source_url,applied_on,created_at' +
        '&order=created_at.asc',
    );
if (opt('--save')) writeFileSync(opt('--save'), JSON.stringify(everything));
const rows = everything.filter((r) => r.description);
const earlier = (r) => everything.filter((h) => h.created_at < r.created_at).reverse();

const today = new Date();
const site = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const groups = { headed: [], body: [] };
for (const r of rows) {
  // Text without its header came from the queue, where the extension captured
  // the company and title; the parser was given those. A paste had nothing.
  const headed = hasHeader(r.description, r.company, r.position);
  const known = headed ? {} : { position: r.position };
  let p = parsePostingLocal(r.description, today, known);
  p = withLearned(headed ? p : { ...p, company: r.company }, earlier(r));
  groups[headed ? 'headed' : 'body'].push({
    id: r.id,
    site: site(r.source_url),
    label: `${r.company} · ${r.position}`,
    proposed: {
      company: p.company,
      position: p.position,
      location: p.location,
      skills: p.skills,
      industry: p.industry,
      level: p.level,
      employmentType: p.employmentType,
      salary: p.salary,
    },
    saved: {
      company: r.company,
      position: r.position,
      location: r.location_raw,
      skills: r.skills ?? [],
      industry: r.industry,
      level: r.level,
      employmentType: r.employment_type,
      salary: r.salary,
    },
  });
}

const headed = score(groups.headed, normalizeLoc, FIELDS);
const all = score([...groups.headed, ...groups.body], normalizeLoc, INFERRED);

// One table: identity fields from pasted rows only, inferred fields from all.
const combined = {
  ...Object.fromEntries(
    ['company', 'position', 'location', 'salary'].map((f) => [f, headed.byField[f]]),
  ),
  ...all.byField,
};

const pct = (t) => (t.n ? Math.round((t.hit / t.n) * 1000) / 10 : null);

console.log(`Parser ${PARSER_VERSION} replayed over ${rows.length} saved postings`);
console.log(
  `(${groups.headed.length} with the posting's header, ${groups.body.length} body only)\n`,
);
console.log(formatScore(combined));
console.log(
  '\n  company, position, location and salary: only postings whose text has its\n' +
    '  header; the rest are body text, whose header fields came from the capture.',
);

if (existsSync(BASELINE)) {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  console.log(`\nAgainst the baseline (${base.version}, ${base.date}):`);
  for (const [f, t] of Object.entries(combined)) {
    const now = pct(t);
    const was = base.scores[f];
    if (now == null || was == null) continue;
    const d = Math.round((now - was) * 10) / 10;
    const mark = d > 0 ? `+${d}` : d < 0 ? `${d}  <-- worse` : '=';
    console.log(
      `  ${f.padEnd(15)} ${String(was).padStart(5)} -> ${String(now).padStart(5)}  ${mark}`,
    );
  }
}

console.log('\nSample misses (parser -> saved):');
const show = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v));
for (const [f, t] of Object.entries(combined)) {
  if (!t.misses.length) continue;
  console.log(`  ${f}:`);
  for (const m of t.misses.slice(0, 4)) {
    console.log(`    ${show(m.proposed)} -> ${show(m.saved)}${m.site ? `   (${m.site})` : ''}`);
  }
}

const trouble = skillTrouble(all.skills);
if (trouble.noisy.length) {
  console.log('\nSkills proposed and then removed (proposed / kept):');
  for (const s of trouble.noisy) console.log(`  ${s.name.padEnd(22)} ${s.proposed} / ${s.kept}`);
}
if (trouble.missed.length) {
  console.log('\nSkills added by hand that the parser missed:');
  for (const s of trouble.missed) console.log(`  ${s.name.padEnd(22)} ${s.missed}`);
}

if (outPath) {
  const label = Object.fromEntries([...groups.headed, ...groups.body].map((g) => [g.id, g.label]));
  const misses = Object.fromEntries(
    Object.entries(combined).map(([f, t]) => [
      f,
      t.misses.map((m) => ({ ...m, application: label[m.id] })),
    ]),
  );
  writeFileSync(
    outPath,
    JSON.stringify({ version: PARSER_VERSION, misses, skills: all.skills }, null, 2),
  );
  console.log(`\nEvery miss -> ${outPath}`);
}

if (args.includes('--baseline')) {
  const scores = Object.fromEntries(Object.entries(combined).map(([f, t]) => [f, pct(t)]));
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        version: PARSER_VERSION,
        date: today.toISOString().slice(0, 10),
        rows: rows.length,
        scores,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`\nBaseline recorded -> scripts/replay-baseline.json`);
}
