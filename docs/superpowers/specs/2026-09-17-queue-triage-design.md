# Job Tracker — Queue Triage

**Date:** 2026-09-17
**Status:** Approved for planning

## Context

The Chrome extension captures LinkedIn postings into `job_queue` faster than they
can be applied to. The queue now holds enough jobs that reading it top to bottom
is itself the bottleneck, and every job gets the same undifferentiated attention:
either a general resume goes out, or an evening is spent tailoring one, and the
choice is made by whichever posting happens to be on screen.

The triage question is not "is this job good" but "what does this job deserve":

- Some are disqualifying regardless of fit — they refuse visa sponsorship.
- Most are worth one of the 2-3 general resumes and ten minutes.
- A few are worth tailoring, and finding those is the whole point.

### Why not put an API key in the tracker

The obvious implementation — the tracker calls an LLM to score a job — bills
usage to a personal API account. Inverting the arrow avoids that entirely: a
Claude Code session reads the queue, scores it, and writes the result back.
Scoring is then a **stored fact, not a runtime dependency**. The tracker renders
columns out of Postgres and never knows an LLM was involved; if scoring never
runs again, unscored rows simply display as unscored.

## Goals

1. Route every queued job to one of four decisions: `tailor`, `general`, `skip`,
   `blocked`.
2. For `general`, name which of the general resumes to send.
3. Give each decision a one-line reason that is worth reading on its own.
4. Keep every LLM call inside a Claude Code session. No key in the app.

## Non-goals

- Automatic scoring at capture time. There is no server-side worker, by design.
  Scoring is a batch the user triggers.
- Generating resumes. Tailoring continues to happen in chat via the
  `frank-resume` skill. This spec only decides *which* jobs earn that.
- A weekly cap on the `tailor` tier. Deferred until the backlog is scored and
  the real distribution is known — a cap on six jobs solves nothing.

## The model

### Fit — three dimensions

Scored by reading the job description against the canonical history in the
`frank-resume` skill.

| Dimension | Question | Weight |
|---|---|---|
| Problem overlap | Do the challenges this team describes resemble ones already solved? | 45 |
| Skills required | Are the named tools and methods ones already held? | 30 |
| Experience overlap | Does the work history sit in this function and domain? | 25 |

Problem overlap carries the most weight because it is what actually decides
whether a posting is worth an evening, and because it is the dimension no
keyword matcher can reach. Skills outweigh experience deliberately: skills are
provable and transferable, years in a function much less so.

Years-of-experience, location, and clearance are **not** gates. They inform
`fit_experience` and nothing more.

### Sponsorship is a gate, not a dimension

A posting that refuses sponsorship sets `fit_decision = 'blocked'` regardless of
score. The fit score is still computed and stored, so an expanded blocked row
shows what was lost.

The gate **marks, never hides**. `detectSponsorship` in `extension/detect.js` is
a heuristic over posting prose and will misread some. A collapsed `blocked (N)`
section costs nothing and guarantees a regex never silently eats a real
opportunity.

### Decision thresholds

```
blocked   sponsorship refused        (checked first, wins)
tailor    fit_score >= 70
general   fit_score 45-69            + resume_target
skip      fit_score < 45
```

### Resume routing

Two axes, evaluated only for the `general` tier — a job being tailored has no
use for the answer.

- **Role archetype:** Operations / Product (AI) / Data. Classified from the JD.
- **Industry:** Retail / Bio. Already parsed by `src/lib/parsePosting.ts`.

`resume_target` stores the pair as a slug, e.g. `ops-retail`, `data-bio`.

## Schema

Additive columns on `public.job_queue`. Nothing existing changes.

```sql
fit_problem     int,         -- 0-45
fit_skills      int,         -- 0-30
fit_experience  int,         -- 0-25
fit_score       int generated always as
                (fit_problem + fit_skills + fit_experience) stored,
fit_decision    text,        -- tailor | general | skip | blocked
fit_reason      text,        -- the line actually read
resume_target   text,        -- 'data-bio' etc.; null when tailoring
sponsorship     text,        -- refused | offered | unknown
scored_at       timestamptz  -- null means unscored; the batch key
```

`fit_score` is generated rather than written so the total cannot drift from its
parts. `scored_at is null` is the entire batching strategy: cost tracks new
captures, not queue size, and no job is ever paid for twice.

Sub-scores are stored separately rather than rolled up because the breakdown is
what makes a score arguable — a 58 that lost its points on skills means
something different from a 58 that lost them on problem overlap.

## How scoring runs

A `/score-queue` skill in this repo. Per run:

1. Fetch `job_queue` rows where `scored_at is null`.
2. Load canonical history from the `frank-resume` skill.
3. Score the batch in one pass — resume in context once, JDs appended.
4. Write results back over Supabase REST.

Roughly 5k tokens per job description, paid once per job, against a Claude
subscription.

### Where the LLM sits

| Step | Executor |
|---|---|
| Fetch unscored rows | script |
| Sponsorship gate | script — the extension's regex ran at capture |
| Industry | script — `parsePosting.ts` already parses it |
| Read the JD, name the problems the team has | model |
| Compare those against actual project history | model |
| Assign sub-scores, write the reason | model |
| Classify role archetype | model |
| Write back, sort, display | script |

Only judgment over prose is modelled. Everything mechanical stays deterministic,
and therefore testable — which matches the existing rule that `lib/` holds pure,
unit-tested functions.

### Authentication

`job_queue` is protected by row-level security, so the anon key alone returns
nothing. The scoring script signs in with the same username/password flow the
extension uses (`toAccountEmail` in `extension/supabase.js`), reading credentials
from the environment. Credentials are never passed through a chat session.

## Data flow

```
Chrome extension  --writes-->  job_queue            (no LLM)
Tracker web app   --reads--->  job_queue            (no LLM)

Claude Code
  /score-queue    --reads--->  rows where scored_at is null
                  --scores-->  the only LLM step
                  --writes-->  fit_* columns
```

## Queue UI

`src/components/QueueList.tsx` sorts by decision, then `fit_score` descending.

- Each row carries a decision badge and its `fit_reason` line.
- `general` rows show `resume_target`.
- `skip` collapses into a count.
- `blocked` collapses separately, expandable, showing the fit score that was
  forfeited.
- Unscored rows sort last and read "unscored" rather than showing a zero.

## Testing

Pure functions in `src/lib/`, following the existing pattern:

- `decisionFor(parts, sponsorship)` — thresholds and gate precedence. The gate
  beating a high score is the case worth pinning.
- `resumeTargetFor(archetype, industry)` — slug construction.
- Sorting order, including where unscored rows land.

Model judgment is not unit-testable and is not tested. It is validated by a dry
run over real queue rows, reviewed by hand before any write-back.

## Rollout

1. Migration adding the columns.
2. Dry run: score a handful of real rows, print, write nothing. Confirm the
   rubric produces decisions worth acting on before it produces rows.
3. `/score-queue` with write-back.
4. Queue UI.

Step 2 gates the rest. A rubric that reads plausibly in the abstract and
uselessly against real postings is the main risk here, and it is cheap to check.
