-- Make the queue's dedupe index usable by ON CONFLICT.
--
-- The first version was partial (`where external_id is not null`), and Postgres
-- will not infer a conflict target from a partial index — every upsert failed
-- with 42P10. The predicate bought nothing: unique indexes treat NULLs as
-- distinct by default, so rows without an external_id still never collide.

drop index if exists public.job_queue_user_external_idx;

create unique index job_queue_user_external_idx
  on public.job_queue (user_id, source, external_id);
