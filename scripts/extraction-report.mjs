/**
 * The extraction report: what the parser and the extension's capture got
 * wrong, read from the corrections logged when applications were saved.
 *
 *   node scripts/extraction-report.mjs              the last 7 days
 *   node scripts/extraction-report.mjs --days 14
 *   node scripts/extraction-report.mjs --out log.json   every entry, for analysis
 *
 * Run weekly. Where replay scores the parser against saved rows, this sees
 * what replay cannot: the capture's mistakes, and fixes made after saving.
 */

import { writeFileSync } from 'node:fs';
import { connect, select } from './supabase.mjs';
import { loadParser } from './parser.mjs';
import { FIELDS, fieldMatches, score, skillTrouble } from './extraction-score.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const days = Number(opt('--days') ?? 7);
const outPath = opt('--out');

const { normalizeLoc, PARSER_VERSION } = await loadParser();
const client = await connect();
const since = new Date(Date.now() - days * 86400000).toISOString();
const entries = await select(
  client,
  'extraction_log',
  `select=*&created_at=gte.${since}&order=created_at.desc`,
);

console.log(`Extraction log, last ${days} days: ${entries.length} entries`);
if (!entries.length) {
  console.log('Nothing logged yet. Entries appear as queued jobs and pastes are saved.');
  process.exit(0);
}

const count = (xs, key) => xs.reduce((m, x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1), new Map());
const byOrigin = count(entries, (e) => e.origin);
console.log(
  [...byOrigin].map(([o, n]) => `  ${o}: ${n}`).join('\n'),
  `\n  (current parser ${PARSER_VERSION}; ${entries.filter((e) => e.parser_version !== PARSER_VERSION).length} entries from older versions)`,
);

// Accuracy is only meaningful for reviews that started from a posting: an
// edit is logged only when something changed, so it is all misses by design.
const reviews = entries.filter((e) => e.origin !== 'edit');
const edits = entries.filter((e) => e.origin === 'edit');

if (reviews.length) {
  console.log('\nRight on first try, by who filled the field:');
  console.log(`  ${'field'.padEnd(15)} ${'parser'.padStart(14)} ${'capture'.padStart(14)}`);
  for (const f of FIELDS) {
    const cell = (src) => {
      const xs = reviews.filter((e) => (e.sources?.[f] ?? 'parser') === src);
      if (!xs.length) return '—'.padStart(14);
      const hit = xs.filter((e) => fieldMatches(f, e.proposed[f], e.saved[f], normalizeLoc)).length;
      return `${Math.round((hit / xs.length) * 100)}% (${hit}/${xs.length})`.padStart(14);
    };
    console.log(`  ${f.padEnd(15)} ${cell('parser')} ${cell('capture')}`);
  }

  const sites = count(reviews, (e) => e.site || '(no link)');
  const corrected = count(
    reviews.filter((e) => e.changed.length),
    (e) => e.site || '(no link)',
  );
  console.log('\nReviews needing a correction, by site:');
  for (const [s, n] of [...sites].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${s.padEnd(34)} ${corrected.get(s) ?? 0} of ${n}`);
  }
}

const show = (v) => (Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v));
console.log('\nCorrections (proposed -> saved):');
for (const f of FIELDS) {
  const xs = entries.filter((e) => e.changed.includes(f));
  if (!xs.length) continue;
  console.log(`  ${f} (${xs.length}):`);
  for (const e of xs.slice(0, 6)) {
    const who = e.origin === 'edit' ? 'later edit' : (e.sources?.[f] ?? 'parser');
    console.log(
      `    ${show(e.proposed[f])} -> ${show(e.saved[f])}   [${who}${e.site ? `, ${e.site}` : ''}]`,
    );
  }
}

const { skills } = score(
  reviews.map((e) => ({ proposed: e.proposed, saved: e.saved })),
  normalizeLoc,
  ['skills'],
);
const trouble = skillTrouble(skills);
if (trouble.noisy.length) {
  console.log('\nSkills proposed and then removed (proposed / kept):');
  for (const s of trouble.noisy) console.log(`  ${s.name.padEnd(22)} ${s.proposed} / ${s.kept}`);
}
if (trouble.missed.length) {
  console.log('\nSkills added by hand that the parser missed:');
  for (const s of trouble.missed) console.log(`  ${s.name.padEnd(22)} ${s.missed}`);
}
if (edits.length) console.log(`\n${edits.length} later edits fixed fields after saving.`);

if (outPath) {
  writeFileSync(outPath, JSON.stringify(entries, null, 2));
  console.log(`\nEvery entry -> ${outPath}`);
}
