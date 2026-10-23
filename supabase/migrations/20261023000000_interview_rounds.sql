-- Interview rounds, in the order they happened.
--
-- A list on the application rather than a table of its own: rounds are only
-- ever read and written with their application, there are a handful per row,
-- and the flow map is drawn from the whole set client-side, the way every
-- other chart in the tracker is. Each entry is {type, label?, date?}; the app
-- reads it defensively, so a malformed entry is dropped rather than fatal.

alter table public.applications
  add column if not exists rounds jsonb not null default '[]'::jsonb;
