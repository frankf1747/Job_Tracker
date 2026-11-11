-- What the parser proposed for a posting, and what was actually saved.
--
-- One row per review that started from a posting (a queued capture or a
-- paste), plus one per later edit that changed an extracted field. Read back
-- by scripts/extraction-report.mjs to find where the rules miss, so they can be
-- improved from real corrections. Append-only from the app.

create table if not exists public.extraction_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Kept when the application is deleted: the correction is still a lesson.
  application_id  uuid references public.applications (id) on delete set null,

  -- 'queue', 'paste' or 'edit'.
  origin          text not null,
  -- {company, position, location, skills, industry, level, employmentType, salary}
  proposed        jsonb not null,
  saved           jsonb not null,
  -- The field names that differ between the two.
  changed         text[] not null default '{}',
  -- Per field, 'capture' (the extension read it) or 'parser'.
  sources         jsonb not null default '{}'::jsonb,
  -- The posting's host, e.g. boards.greenhouse.io.
  site            text not null default '',
  parser_version  text not null default '',

  created_at      timestamptz not null default now()
);

create index if not exists extraction_log_user_created_idx
  on public.extraction_log (user_id, created_at desc);

alter table public.extraction_log enable row level security;

-- Read and append only: nothing in the app rewrites history.
drop policy if exists "read own extraction log" on public.extraction_log;
create policy "read own extraction log" on public.extraction_log
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "append own extraction log" on public.extraction_log;
create policy "append own extraction log" on public.extraction_log
  for insert to authenticated
  with check (auth.uid() = user_id);
