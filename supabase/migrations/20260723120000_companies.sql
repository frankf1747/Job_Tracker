-- Company List: a lightweight place to jot target companies and outreach notes,
-- separate from applications — these are places not yet (or never) applied to.
--
-- Same shape and the same row-level security as applications: scoped by
-- user_id, and the publishable key reads nothing without a session.

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  name       text not null,
  notes      text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_user_created_idx
  on public.companies (user_id, created_at desc);

-- Reuse the shared touch_updated_at() from the initial migration.
drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;

drop policy if exists "own companies" on public.companies;
create policy "own companies" on public.companies
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
