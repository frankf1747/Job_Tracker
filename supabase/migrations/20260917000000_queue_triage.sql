-- Triage: what each queued job deserves — tailor a resume, send a general one,
-- skip it, or drop it on a gate.
--
-- Scoring happens in a Claude Code session, not in the app. These columns hold
-- a stored result; nothing in the tracker calls a model, and an unscored row is
-- a normal state rather than an error. The rubric lives in
-- docs/superpowers/specs/2026-09-17-queue-triage-design.md and mirrors the
-- gates already encoded in the frank-resume skill.

alter table public.job_queue
  -- The three fit dimensions, weighted as the rubric defines. Problem overlap
  -- dominates because it is what decides whether a posting is worth an evening,
  -- and it is the dimension no keyword matcher can reach.
  add column if not exists fit_problem    int,
  add column if not exists fit_skills     int,
  add column if not exists fit_experience int,

  -- Generated, so the total can never drift from its parts.
  add column if not exists fit_score      int generated always as
    (coalesce(fit_problem, 0) + coalesce(fit_skills, 0) + coalesce(fit_experience, 0)) stored,

  add column if not exists fit_decision   text,
  -- The hiring-manager read, one line, naming the actual deciding factor.
  add column if not exists fit_reason     text,

  -- The HR read, kept separate and never averaged into the score. HR applies
  -- hard filters; a hiring manager reads the whole page. They routinely
  -- disagree, and saying so is more useful than splitting the difference.
  add column if not exists hr_verdict     text,
  add column if not exists hr_note        text,

  -- Which gate fired, when one did. Null means the job was judged on fit.
  add column if not exists gate           text,
  -- An equivalency / degree-ladder / new-grad clause was found. True suppresses
  -- the years gate — per frank-resume, the only thing that overrides it.
  add column if not exists soft_floor     boolean,

  -- Which general resume to send. Null when tailoring, where it is irrelevant.
  add column if not exists resume_target  text,

  add column if not exists scored_at      timestamptz;

-- Constrain the small vocabularies. A typo in a write-back should fail loudly
-- rather than render as a row the UI silently drops into no band at all.
alter table public.job_queue
  drop constraint if exists job_queue_fit_decision_check;
alter table public.job_queue
  add constraint job_queue_fit_decision_check
  check (fit_decision is null or fit_decision in ('tailor', 'general', 'skip', 'blocked'));

alter table public.job_queue
  drop constraint if exists job_queue_hr_verdict_check;
alter table public.job_queue
  add constraint job_queue_hr_verdict_check
  check (hr_verdict is null or hr_verdict in ('pass', 'drag', 'fail'));

alter table public.job_queue
  drop constraint if exists job_queue_gate_check;
alter table public.job_queue
  add constraint job_queue_gate_check
  check (gate is null or gate in ('years', 'system', 'salary', 'clearance', 'authorization'));

alter table public.job_queue
  drop constraint if exists job_queue_resume_target_check;
alter table public.job_queue
  add constraint job_queue_resume_target_check
  check (resume_target is null or resume_target in ('operations', 'data', 'insights'));

-- Unscored rows are the batch key, and the only thing ever selected in bulk.
create index if not exists job_queue_unscored_idx
  on public.job_queue (user_id)
  where scored_at is null;
