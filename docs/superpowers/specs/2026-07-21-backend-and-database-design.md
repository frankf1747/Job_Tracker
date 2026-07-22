# Job Tracker — Backend & Database Design

**Date:** 2026-07-21
**Status:** Approved for planning

## Context

The frontend exists only as a Claude Design artifact: `Job Tracker.dc.html` in design project
`d3469b8d-511d-43cb-b5e0-59cfb6d25d72`. It is a single 1,100-line file containing:

- A `Component extends DCLogic` class holding all state and logic
- A template using a proprietary DSL (`{{ expr }}`, `<sc-if>`, `<sc-for>`) — 24 conditionals, 34 loops
- 442 rows of deterministically generated fake applications (`makeRows`)
- Client-side filtering, sorting, pagination, and aggregation
- A D3 + topojson map of North America with per-city pins
- A regex-based "paste a job posting anywhere to add it" parser
- No persistence of any kind — state dies on refresh

The git repo is empty apart from `.gitattributes`.

## Goals

Turn this into a real, deployed, persistent application:

1. Port the design to a standard React codebase with **no visual regression**
2. Persist applications to a real database, scoped to an authenticated user
3. Deploy to Netlify on a free tier
4. Keep the door open for an LLM-backed posting parser

## Non-goals (v1)

- Multi-tenant team features, sharing, or collaboration
- Mobile-native apps
- Email/calendar integration or automated status scraping
- Status-change history / timeline (see Open Questions)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | **Supabase (Postgres)** | Free indefinitely, real SQL, `text[]` for skills, auto-generated REST API, RLS for auth. Firebase Data Connect is Postgres but bills ~$9.37/mo after a 90-day trial; Firestore is free but NoSQL. |
| Auth | **Supabase email magic link**, single user | No password to manage, no OAuth app registration. Schema is `user_id`-scoped so multi-user is a config change, not a migration. |
| API layer | **PostgREST via `supabase-js`**, direct from browser | RLS is the authorization boundary. A hand-written CRUD API would add a tier with no benefit. |
| Serverless functions | **Netlify Functions, phase 5 only** | Needed only when the parser calls the Claude API and the key must stay server-side. |
| Parser | **Port regex as-is, behind a seam** | `parsePosting(text): Promise<Draft>` — swapping to a `fetch('/api/parse-posting')` implementation touches one file. |
| Seed data | **Start empty** | The 442-row generator becomes a dev-only seed script so charts and the map have something to render locally. |
| Hosting | **Netlify** | Static SPA build, free tier, Functions available when needed. |

### Why the free tiers actually work here

Supabase free projects pause after ~7 days with zero activity and take one click to wake. For a
tracker touched weekly this is a non-issue. Netlify's free tier covers a personal SPA comfortably.

## Architecture

```
Browser (React SPA on Netlify CDN)
  │
  ├── supabase-js ──► Supabase Auth        (magic link, JWT in localStorage)
  │
  └── supabase-js ──► PostgREST ──► Postgres
                                     └── RLS: user_id = auth.uid()

  (phase 5) fetch('/api/parse-posting') ──► Netlify Function ──► Claude API
```

There is no application server. Authorization lives in the database as row-level security
policies, which is the only place it can't be bypassed by a crafted client request.

## Data model

Single table. Skills stay denormalized as a Postgres array — the app filters by skill and computes
skill frequency entirely client-side over a few hundred rows, so a join table would add migration
and query surface for no gain.

```sql
create table applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  company      text not null,
  position     text not null,
  industry     text,
  level        text,
  salary       text,               -- free text: "$48/hr", "$120k"

  status       text not null default 'Submitted'
               check (status in ('Submitted','OA','Interview','Offer','Rejected','Ghosted')),
  reached      smallint not null default 0 check (reached between 0 and 3),

  location_raw text,               -- exactly what was typed; normalized client-side
  lat          double precision,   -- nullable, for cities outside the built-in table
  lng          double precision,

  applied_on   date not null,
  resume       text,
  notes        text,
  source_url   text,

  skills       text[] not null default '{}',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index on applications (user_id, applied_on desc);
create index on applications using gin (skills);

alter table applications enable row level security;

create policy "own rows" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`updated_at` is maintained by a `before update` trigger.

### Notes on specific columns

- **`reached`** is genuinely independent of `status`, not derived from it. A `Rejected` row records
  how far the application got before the rejection (0 = resume screen, 2 = after interviews). The
  current UI has no control for setting this — see Open Questions.
- **`location_raw` + client-side normalization.** `normalizeLoc()` is a pure function over a
  hardcoded 30-city coordinate table. Keeping raw text in the database means the normalizer can be
  improved without a migration. `lat`/`lng` are nullable escape hatches for cities the table
  doesn't know.

## Module structure

The current 1,100-line file does everything. The port splits it so each unit has one job and the
pure logic is testable without a browser or a database.

```
src/
  lib/
    supabase.ts        Supabase client singleton
    schema.ts          Types + constants (STATUSES, STATUS_META, INDUSTRIES, LEVELS, RESUMES, SKILL_POOL)
    locations.ts       CITY_COORDS, BARE_CITY, normalizeLoc(), cityAgg()
    parsePosting.ts    Posting parser — the swap seam for the Claude upgrade
    derive.ts          filterRows(), sortRows(), derive(), pieArcs(), parseMMDD()
  data/
    applications.ts    Repository: list / create / update / remove against Supabase
    seed.ts            Dev-only 442-row generator (was makeRows)
  components/
    Hero.tsx  FilterStrip.tsx  StatsRow.tsx  SkillsChart.tsx
    LocationMap.tsx  ApplicationsTable.tsx  ReviewModal.tsx  Toast.tsx
  App.tsx              State, wiring, optimistic mutations
  main.tsx
```

`lib/*` has no I/O and no React — it is directly unit-testable. `data/applications.ts` is the only
module that knows Supabase exists.

## Data flow and mutations

The app loads every row for the user once on mount and holds them in memory. Filtering, sorting,
pagination, chart aggregation, and map aggregation all run client-side over that array, exactly as
they do today. At a few hundred rows this is far cheaper than round-tripping each filter change.

Mutations are **optimistic**: local state updates immediately, the write fires, and on failure the
previous value is restored and an error toast shown. This preserves the current feel of inline
status dropdowns, notes editing, and click-to-edit dates.

```
setRowStatus(id, status)
  ├─ setState(rows -> patched)            immediate
  ├─ await applications.update(id, {...})
  └─ on error: restore snapshot + showToast(..., 'error')
```

## Error handling

| Failure | Behavior |
|---|---|
| Initial load fails | Full-page retry state; no empty-looking table that implies zero applications |
| Mutation fails | Optimistic rollback + error toast naming the row |
| Session expired | Redirect to the magic-link screen, preserving intended destination |
| Supabase project paused | Detected as a load failure; retry state explains it and links to the dashboard |
| Map CDN (`world-atlas`) fails | Existing `mapReady: 'error'` path already handles this — keep it |

## Testing

Vitest over the pure modules, which is where the real logic lives:

- `parsePosting` — company/title/location/salary/skill extraction across real posting samples
- `normalizeLoc` — `"sf"`, `"San Francisco, CA"`, `"Remote"`, `""`, unknown cities, Canadian provinces
- `parseMMDD` — `"Jul 4"`, `"0704"`, `"704"`, garbage input
- `derive` / `filterRows` / `sortRows` — filter composition, stage thresholds, sort stability
- `pieArcs` — single-slice (100%) and empty-total edge cases

The repository layer is exercised against a local Supabase instance if one is available, otherwise
left to manual verification — mocking PostgREST would test the mock, not the code.

## Implementation phases

**Phase 0 — Scaffold.** Vite + React + TypeScript. Pull `uploads/fuji_hero.jpg` and any other
referenced assets from the design project into `public/`. Vitest, ESLint, Prettier.

**Phase 1 — Port the UI.** Convert the template DSL to JSX, preserving inline styles verbatim.
Split the logic class into `lib/*` modules. Run against the in-memory 442-row generator, with no
backend at all. **Gate: screenshot-compare against the design before proceeding.** Getting the port
right against known-good data, before introducing async, keeps port bugs and backend bugs from
being confused for each other.

**Phase 2 — Supabase.** Create the project, apply the schema and RLS migration, wire the magic-link
auth gate, generate TypeScript types from the schema.

**Phase 3 — Persistence.** Replace the in-memory array with `data/applications.ts`. Wire optimistic
create/update/delete. Load on mount. Move the generator to a dev-only seed script.

**Phase 4 — Deploy.** `netlify.toml` with the SPA redirect, environment variables in the Netlify
dashboard, Supabase auth redirect URLs for both the Netlify domain and localhost.

**Phase 5 (later) — Claude parser.** Netlify Function at `/api/parse-posting` calling the Claude
API with a structured-output tool definition. `parsePosting.ts` switches from local regex to
`fetch`. `ANTHROPIC_API_KEY` stays server-side.

## Secrets

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` ship to the browser — this is correct and expected
for Supabase, because the anon key grants nothing on its own and RLS is what enforces access. The
`service_role` key must never appear in the client bundle or the repo. `ANTHROPIC_API_KEY` is
server-side only, phase 5.

## Open questions

These do not block phases 0–4 but should be resolved before the app carries real data long-term.

1. **Setting `reached` from the UI.** When marking an application `Rejected`, there is currently no
   way to record whether it died at the resume screen or after final rounds — yet the funnel chart
   depends on that number. Proposed: when status changes to `Rejected` or `Ghosted`, the row's
   inline editor exposes a "got as far as" selector.

2. **Cities outside the built-in table.** `CITY_COORDS` hardcodes ~30 cities. Real applications will
   include cities that aren't in it, and those rows will silently never appear on the map. Options:
   accept it, expand the table, or geocode once on save into the `lat`/`lng` columns.

3. **Status history.** The model stores only current status, so "how long from submission to first
   response" is unanswerable. A `status_events` table would enable real funnel-timing analytics.
   Deferred as YAGNI for v1, but it is cheap now and expensive to backfill later.
