-- Keep the job description on the application.
--
-- A posting is most useful after applying, when there is an interview to
-- prepare for, and by then it has often been taken down. Until now the
-- description was used once, to infer skills and industry in the review modal,
-- and then thrown away; promoting a queued job deleted the only copy.
--
-- fit_reason carries the queue's one-line triage verdict across with it, since
-- that is the record of why the job was worth applying to.

alter table public.applications
  add column if not exists description text not null default '',
  add column if not exists fit_reason  text not null default '';
