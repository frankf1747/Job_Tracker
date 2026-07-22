-- Job Tracker: initial schema.
--
-- Every table is scoped by user_id and protected by row-level security, which
-- is the actual security boundary for this app: the publishable key ships in
-- the browser bundle, so anything not enforced here is not enforced at all.

-- ---------------------------------------------------------------- applications

create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  company      text not null,
  position     text not null,
  industry     text        not null default '',
  level        text        not null default '',
  -- Full-time, Part-time, Contract, Internship, Temporary.
  employment_type text     not null default 'Full-time',
  -- Free text rather than numeric: postings quote "$48/hr", "$71,000-$106,600",
  -- and "competitive". Normalising would lose more than it gains.
  salary       text        not null default '',

  status       text not null default 'Submitted'
               check (status in ('Submitted','OA','Interview','Offer','Rejected','Ghosted')),
  -- How far the application actually got, independent of status: a Rejected row
  -- records whether it died at the resume screen (0) or after interviews (2).
  -- The funnel chart reads this, not status.
  reached      smallint not null default 0 check (reached between 0 and 3),

  -- Exactly what was typed. Normalisation into a city/lat/lng happens in the
  -- client, so the normaliser can improve without a migration.
  location_raw text not null default '',
  lat          double precision,
  lng          double precision,

  applied_on   date not null default current_date,
  resume       text not null default '',
  notes        text not null default '',
  source_url   text not null default '',

  -- Denormalised deliberately. The app loads every row and filters client-side
  -- over a few hundred records; a join table would add surface for no gain.
  skills       text[] not null default '{}',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists applications_user_applied_idx
  on public.applications (user_id, applied_on desc);

create index if not exists applications_skills_idx
  on public.applications using gin (skills);

-- --------------------------------------------------------------------- resumes

create table if not exists public.resumes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null,
  -- Path within the private `resumes` storage bucket. Null until a PDF is
  -- attached; the label is useful on its own.
  file_path  text,
  file_name  text,
  file_size  bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Applications reference a resume by label, so duplicates would be ambiguous.
  unique (user_id, label)
);

create index if not exists resumes_user_idx on public.resumes (user_id, sort_order);

-- ------------------------------------------------------------ updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

drop trigger if exists resumes_touch_updated_at on public.resumes;
create trigger resumes_touch_updated_at
  before update on public.resumes
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------------- RLS

alter table public.applications enable row level security;
alter table public.resumes      enable row level security;

-- `using` governs which rows are visible; `with check` stops a row being
-- written with someone else's user_id. Both are required.
drop policy if exists "own applications" on public.applications;
create policy "own applications" on public.applications
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own resumes" on public.resumes;
create policy "own resumes" on public.resumes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --------------------------------------------------------------------- storage

-- Private bucket for resume PDFs. Objects are keyed <user_id>/<resume_id>.pdf
-- so the policies below can authorise on the leading path segment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own resume files read"   on storage.objects;
drop policy if exists "own resume files write"  on storage.objects;
drop policy if exists "own resume files update" on storage.objects;
drop policy if exists "own resume files delete" on storage.objects;

create policy "own resume files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own resume files write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own resume files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own resume files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
