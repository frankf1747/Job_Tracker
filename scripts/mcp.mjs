/**
 * MCP server for the tracker, so a Claude chat can look things up on demand
 * instead of copying the data somewhere else.
 *
 *   node scripts/mcp.mjs                      # stdio; read and write tools
 *   JT_MCP_READONLY=1 node scripts/mcp.mjs    # read tools only
 *
 * Signs in the same way as the other scripts (supabase.mjs: the keychain
 * password, so row-level security applies). The rules for what a write may
 * change live in mcp-tools.mjs and are tested there.
 *
 * Tool schemas are written as plain JSON Schema with no $schema key: some
 * clients only accept 2020-12, and the SDK's Zod conversion emits draft-07.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connect } from './supabase.mjs';
import { gateFacts, gateFor } from './gates.mjs';
import {
  MAX_LIMIT,
  QUEUE_LIST_COLUMNS,
  QUEUE_ROW_COLUMNS,
  queueDetail,
  queueLine,
  ROUND_TYPES,
  STATUSES,
  overview,
  planUpdate,
  searchQuery,
} from './mcp-tools.mjs';

const READONLY = process.env.JT_MCP_READONLY === '1';
const DESCRIPTION_CAP = 6000;
const REACHED = ['resume screen', 'OA', 'interview', 'offer'];

let session = null;

/** A PostgREST call, signing in on first use and once more if the token has expired. */
async function rest(path, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    session ??= await connect();
    const res = await fetch(`${session.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: session.key,
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
    if (res.status === 401 && attempt === 0) {
      session = null;
      continue;
    }
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok) throw new Error(body?.message || `Tracker request failed (${res.status})`);
    return body;
  }
}

const line = (r) =>
  `${r.applied_on} · ${r.company} · ${r.position} · ${r.status}` +
  (r.reached ? ` (reached ${REACHED[r.reached]})` : '') +
  (r.location_raw ? ` · ${r.location_raw}` : '') +
  ` (id ${r.id})`;

async function getApp(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id)))
    throw new Error('id must be an application id (a UUID from tracker_search)');
  const [row] = await rest(`applications?id=eq.${id}&select=*`);
  if (!row) throw new Error(`No application ${id}`);
  return row;
}

const TOOLS = [
  {
    name: 'tracker_overview',
    title: 'Job applications at a glance',
    description:
      "Frank's job-application tracker in numbers: total applications, count per status, the funnel (how many reached the OA, interview and offer stages) and applications per month. Call this for questions like 'how is my job search going' before searching rows.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    read: true,
    run: async () => {
      const rows = await rest('applications?select=status,reached,applied_on');
      const o = overview(rows);
      const pct = (n) => (o.total ? `${Math.round((100 * n) / o.total)}%` : '0%');
      return [
        `${o.total} applications`,
        `By status: ${Object.entries(o.byStatus)
          .map(([s, n]) => `${s} ${n}`)
          .join(', ')}`,
        `Funnel (reached at least): applied ${o.funnel.applied}, OA ${o.funnel.oa} (${pct(o.funnel.oa)}), interview ${o.funnel.interview} (${pct(o.funnel.interview)}), offer ${o.funnel.offer} (${pct(o.funnel.offer)})`,
        `Per month: ${Object.entries(o.byMonth)
          .map(([m, n]) => `${m} ${n}`)
          .join(', ')}`,
      ].join('\n');
    },
  },
  {
    name: 'tracker_search',
    title: 'Find job applications',
    description: `Search Frank's job applications, newest first, one line each: date applied, company, position, status, how far it got, location and id. 'query' matches company, position or industry (substring, any case). Use the id with tracker_get for notes, interview rounds and the job description. At most ${MAX_LIMIT} rows.`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text in the company, position or industry, e.g. "Amgen" or "supply chain"',
        },
        status: { type: 'string', enum: STATUSES },
        since: { type: 'string', description: 'Applied on or after, YYYY-MM-DD' },
        until: { type: 'string', description: 'Applied on or before, YYYY-MM-DD' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Default 25' },
      },
      additionalProperties: false,
    },
    read: true,
    run: async (a) => {
      const rows = await rest(`applications?${searchQuery(a)}`);
      return rows.length
        ? `${rows.length} application(s)\n${rows.map(line).join('\n')}`
        : 'No applications match.';
    },
  },
  {
    name: 'tracker_get',
    title: 'One job application in full',
    description:
      'Everything recorded for one application: status and how far it got, level, salary, location, skills, resume used, source link, why it looked like a fit, interview rounds, notes and (with include_description) the job description, capped at 6,000 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Application id from tracker_search' },
        include_description: {
          type: 'boolean',
          description: 'Also return the saved job description',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    read: true,
    run: async ({ id, include_description }) => {
      const r = await getApp(id);
      const rounds =
        Array.isArray(r.rounds) && r.rounds.length
          ? r.rounds
              .map(
                (x, i) =>
                  `  ${i + 1}. ${x.type}${x.label ? ` (${x.label})` : ''}${x.date ? ` · ${x.date}` : ''}`,
              )
              .join('\n')
          : '  none recorded';
      const out = [
        `${r.company} · ${r.position} (id ${r.id})`,
        `Status: ${r.status} · reached ${REACHED[r.reached ?? 0]} · applied ${r.applied_on}`,
        `Level: ${r.level || '-'} · ${r.employment_type} · salary: ${r.salary || '-'} · industry: ${r.industry || '-'}`,
        `Location: ${r.location_raw || '-'}`,
        `Skills: ${(r.skills ?? []).join(', ') || '-'}`,
        `Resume: ${r.resume || '-'} · source: ${r.source_url || '-'}`,
        `Why it fit: ${r.fit_reason || '-'}`,
        `Interview rounds:\n${rounds}`,
        `Notes:\n${r.notes || '  (none)'}`,
      ];
      if (include_description) {
        const d = r.description || '';
        out.push(
          `Job description${d.length > DESCRIPTION_CAP ? ` (first ${DESCRIPTION_CAP} of ${d.length} characters)` : ''}:\n${d.slice(0, DESCRIPTION_CAP) || '(none saved)'}`,
        );
      }
      return out.join('\n');
    },
  },
  {
    name: 'tracker_queue',
    title: 'Saved job postings not yet applied to',
    description:
      'The queue of job postings Frank captured but has not applied to yet, newest first: company, position, location, the triage score and verdict (or "unscored"), the queue id and the posting link. Pass the queue id to tracker_queue_get for the full job description.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text in the company or position' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Default 25' },
      },
      additionalProperties: false,
    },
    read: true,
    run: async ({ query, limit }) => {
      const q = new URLSearchParams({
        select: QUEUE_LIST_COLUMNS,
        order: 'created_at.desc',
        limit: String(Math.min(Math.max(1, Number(limit) || 25), MAX_LIMIT)),
      });
      const term = query
        ? String(query)
            .replace(/[,()*]+/g, ' ')
            .trim()
        : '';
      if (term) q.set('or', `(company.ilike.*${term}*,position.ilike.*${term}*)`);
      const rows = await rest(`job_queue?${q}`);
      if (!rows.length) return 'The queue is empty or nothing matches.';
      return rows.map(queueLine).join('\n');
    },
  },
  {
    name: 'tracker_queue_get',
    title: 'One queued job posting in full',
    description: `One posting from the queue in full: location, workplace type, salary, posting and apply links, the stored triage (score out of 100 with its problem/skills/experience parts, decision, reason, HR read) when scored, the mechanical gate facts read from the description (years floor, soft floor, salary band, work authorization, unfamiliar systems, and which gate fires), and the job description, capped at ${DESCRIPTION_CAP.toLocaleString('en-US')} characters. Use for scoring or tailoring a queued job.`,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Queue id from tracker_queue' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    read: true,
    run: async ({ id }) => {
      if (!/^[0-9a-f-]{36}$/i.test(String(id)))
        throw new Error('id must be a queue id (a UUID from tracker_queue)');
      const [row] = await rest(`job_queue?id=eq.${id}&select=${QUEUE_ROW_COLUMNS}`);
      if (!row) throw new Error(`No queued job ${id}`);
      const facts = gateFacts(row.description || '');
      return queueDetail(row, facts, gateFor(facts), DESCRIPTION_CAP);
    },
  },
  {
    name: 'tracker_update',
    title: 'Update one job application',
    description:
      "Change one application's status, record an interview round, or add a note. Status follows the tracker's own rule: Submitted, OA, Interview and Offer set how far it got; Rejected and Ghosted keep it. Only set OA or Interview from an explicit invitation, scheduled interview or assessment; a rejection that thanks Frank for interviewing is still just Rejected. Notes are appended under today's date, never replaced. Pass dry_run to see the change without writing it. Only update when Frank asked for it.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Application id from tracker_search' },
        status: { type: 'string', enum: STATUSES },
        reached: {
          type: 'integer',
          minimum: 0,
          maximum: 3,
          description: 'Override how far it got: 0 resume screen, 1 OA, 2 interview, 3 offer',
        },
        notes_append: { type: 'string', description: 'A line to add to the notes' },
        round: {
          type: 'object',
          description: 'An interview round to add to the end of the list',
          properties: {
            type: { type: 'string', enum: ROUND_TYPES },
            label: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
          },
          required: ['type'],
          additionalProperties: false,
        },
        dry_run: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    read: false,
    run: async ({ id, dry_run, ...change }) => {
      const before = await getApp(id);
      const today = new Date().toLocaleDateString('en-CA');
      const { fields } = planUpdate(before, change, today);
      const summary = Object.entries(fields)
        .map(([k, v]) =>
          k === 'rounds'
            ? `rounds: +${JSON.stringify(v.at(-1))}`
            : k === 'notes'
              ? `notes: +"${change.notes_append.trim()}"`
              : `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(v)}`,
        )
        .join('\n');
      if (dry_run)
        return `Dry run, nothing written. ${before.company} · ${before.position}\n${summary}`;
      await rest(`applications?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(fields),
      });
      const after = await getApp(id);
      return `Updated ${after.company} · ${after.position} (id ${id})\n${summary}\nNow: ${after.status} · reached ${REACHED[after.reached ?? 0]}`;
    },
  },
];

const enabled = TOOLS.filter((t) => t.read || !READONLY);

const server = new Server(
  { name: 'job-tracker', version: '0.1.0' },
  {
    capabilities: { tools: {} },
    instructions:
      "Frank's job-application tracker (Supabase): every application he has submitted, its status and how far it got, interview rounds, notes, and a queue of postings not yet applied to. Use it when a question is about his job search, a specific application or company he applied to, or his interview pipeline. Read with tracker_overview, tracker_search, tracker_get and tracker_queue. Only call tracker_update when Frank asks for a change. This is live data, not a knowledge base: do not copy rows into other stores.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: enabled.map(({ name, title, description, inputSchema }) => ({
    name,
    title,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = enabled.find((t) => t.name === req.params.name);
  if (!tool)
    return { content: [{ type: 'text', text: `Unknown tool ${req.params.name}` }], isError: true };
  try {
    return { content: [{ type: 'text', text: await tool.run(req.params.arguments ?? {}) }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }],
      isError: true,
    };
  }
});

await server.connect(new StdioServerTransport());
process.stderr.write(
  `job-tracker: MCP server connected over stdio${READONLY ? ' (read-only)' : ''}\n`,
);
