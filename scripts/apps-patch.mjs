/**
 * Apply a JSON array of {id, ...fields} updates to applications.
 *
 * Deliberately generic and dumb: it writes exactly the fields it is given and
 * validates only that each row has an id. What is safe to write is decided by
 * whatever produced the file, which for a location backfill is the same
 * canonicalPlace() the app itself uses.
 *
 *   node scripts/apps-patch.mjs updates.json [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { connect } from './supabase.mjs';

const file = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!file) throw new Error('Usage: node scripts/apps-patch.mjs updates.json [--dry-run]');

const rows = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(rows)) throw new Error('Expected a JSON array');

const bad = rows.filter((r) => !r.id || typeof r.id !== 'string');
if (bad.length) {
  console.error(`${bad.length} row(s) have no id; nothing written`);
  process.exit(1);
}

for (const r of rows) {
  const { id, ...fields } = r;
  console.log(`  ${id}  ${JSON.stringify(fields)}`);
}
console.log(`${rows.length} updates`);
if (dry) {
  console.log('--dry-run: nothing written');
  process.exit(0);
}

const { url, key, token } = await connect();
let ok = 0;
for (const r of rows) {
  const { id, ...fields } = r;
  const res = await fetch(`${url}/rest/v1/applications?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    console.error(`  ${id}: ${res.status} ${await res.text()}`);
    continue;
  }
  ok++;
}
console.log(`${ok}/${rows.length} written`);
