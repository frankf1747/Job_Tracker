-- Resumes: the resume list and the PDF behind each one, moved off the browser
-- and onto the account. Until now the list lived in localStorage and the files
-- in IndexedDB, so they were stranded on whichever laptop created them. Here
-- the metadata becomes a table and the PDFs a private Storage bucket, both
-- scoped by user_id with the same row-level security as applications/companies.

create table if not exists public.resumes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  label        text not null,
  -- Written for one application and held out of the reusable picker.
  tailored     boolean not null default false,

  -- Set once a PDF is attached. storage_path is {user_id}/{id}.pdf.
  file_name    text,
  file_size    integer,
  storage_path text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists resumes_user_created_idx
  on public.resumes (user_id, created_at desc);

-- Reuse the shared touch_updated_at() from the initial migration.
drop trigger if exists resumes_touch_updated_at on public.resumes;
create trigger resumes_touch_updated_at
  before update on public.resumes
  for each row execute function public.touch_updated_at();

alter table public.resumes enable row level security;

drop policy if exists "own resumes" on public.resumes;
create policy "own resumes" on public.resumes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The PDFs. A private bucket; every object lives under a {user_id}/ prefix so
-- the policies below can gate access by the first path segment.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "own resume files read" on storage.objects;
create policy "own resume files read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own resume files insert" on storage.objects;
create policy "own resume files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own resume files update" on storage.objects;
create policy "own resume files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own resume files delete" on storage.objects;
create policy "own resume files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
