/**
 * Dump applications to a JSON file, for auditing what the parser extracted.
 *
 *   node scripts/apps-dump.mjs [outfile]
 */

import { writeFileSync } from 'node:fs';
import { connect, select } from './supabase.mjs';

const COLUMNS =
  'id,company,position,location_raw,skills,industry,level,salary,applied_on,source_url';

const client = await connect();
const rows = await select(client, 'applications', `select=${COLUMNS}&order=applied_on.desc`);

const out = process.argv[2] ?? 'applications.json';
writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`${rows.length} applications -> ${out}`);
