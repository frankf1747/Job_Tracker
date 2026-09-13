-- The queue: jobs captured from a posting but not applied to yet.
--
-- Deliberately separate from applications. A queued job has no applied date,
-- no resume and no status progression, and must not count toward the funnel,
-- the momentum chart, or "apps this week" — promoting it into an application
-- is what makes it real. Same per-user row-level security as everything else.

create table if not exists public.job_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- Where it came from, and that site's own id for the posting. The id is what
  -- dedupes a re-capture of the same job, since the URL can carry tracking junk.
  source        text not null default 'linkedin',
  external_id   text,

  company       text not null default '',
  position      text not null default '',
  location_raw  text not null default '',

  -- The posting itself (always obtainable), and the employer's application page
  -- unwrapped from LinkedIn's /safety/go/ redirect. apply_url is null for Easy
  -- Apply postings, which have no off-site URL — job_url is the fallback.
  job_url       text not null default '',
  apply_url     text,

  -- The full job description, kept so the review modal can infer skills and
  -- industry at promote time without re-fetching the posting, which may be gone.
  description   text not null default '',

  salary        text not null default '',
  -- On-site / Remote / Hybrid, as the posting words it.
  workplace_type text not null default '',
  -- Raw as shown, e.g. "Reposted 4 days ago" — not worth parsing into a date.
  posted_note   text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists job_queue_user_created_idx
  on public.job_queue (user_id, created_at desc);

-- Re-queueing a job already in the queue updates it rather than duplicating.
create unique index if not exists job_queue_user_external_idx
  on public.job_queue (user_id, source, external_id)
  where external_id is not null;

-- Reuse the shared touch_updated_at() from the initial migration.
drop trigger if exists job_queue_touch_updated_at on public.job_queue;
create trigger job_queue_touch_updated_at
  before update on public.job_queue
  for each row execute function public.touch_updated_at();

alter table public.job_queue enable row level security;

drop policy if exists "own queued jobs" on public.job_queue;
create policy "own queued jobs" on public.job_queue
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
