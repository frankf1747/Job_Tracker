-- Company List, outreach tracking: whether you've reached out, and a date you
-- scheduled something with a contact. The contact names themselves live inline
-- in `notes` as @mentions; only these two structured fields need columns.

alter table public.companies
  add column if not exists reached_out boolean not null default false,
  add column if not exists scheduled_on date;
