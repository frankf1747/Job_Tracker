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
  `frank-resume` skill. This spec only decides _which_ jobs earn that.
- A weekly cap on the `tailor` tier. Deferred until the backlog is scored and
  the real distribution is known — a cap on six jobs solves nothing.

## The model

The rubric is not invented here. `frank-resume` already encodes gates, soft
floors and a two-verdict read, learned across sessions of Frank correcting the
same mistakes. Triage reuses those rules rather than running a parallel system
that can disagree with them.

### Gates come first, and there are five

From `frank-resume` section 0a. Any one sets `fit_decision = 'blocked'` and
records which in `gate`:

| `gate`          | Condition                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `years`         | A flat years floor above ~2 with **no** soft-floor clause                                                                      |
| `system`        | A required system never used — Jira, WMS/Korber, Agile ceremony facilitation, specialty pharmacy file specs, metadata catalogs |
| `salary`        | A band far above the realistic range of roughly $65-110K                                                                       |
| `clearance`     | US citizenship, green card, or an active clearance                                                                             |
| `authorization` | An explicit no-sponsorship requirement                                                                                         |

A blocked job still gets scored. The score is what tells you whether the gate
cost you anything, and `gate` is what tells a human whether the machine was
right — both are needed for a row that can be argued with.

### Soft floors override the years gate

The single highest-value signal, and the one most easily missed. Three forms:

- degree ladder — _"Bachelor's + 3 years, Master's + 1 year"_ (the MSBA is worth
  roughly two years)
- equivalency clause — _"any suitable combination of education, experience or
  training"_, _"or equivalent professional experience"_
- explicit new-grad door — _"2+ years or a recent graduate"_

`frank-resume` is unambiguous about why this matters: postings carrying one of
these are where Frank is genuinely competitive, and postings with a flat "3+
years" and no clause are not. `soft_floor` stores whether one was found, and a
true value suppresses the `years` gate.

**This is detected mechanically, not by the model.** It is a text pattern, and a
pattern list is auditable in a way a judgment call is not.

### Fit — three dimensions

Scored by reading the description against
`frank-resume/references/content-library.md`.

| Column           | Question                                                            | Range |
| ---------------- | ------------------------------------------------------------------- | ----- |
| `fit_problem`    | Do the challenges this team describes resemble ones already solved? | 0-45  |
| `fit_skills`     | Are the named tools and methods ones already held?                  | 0-30  |
| `fit_experience` | Does the work history sit in this function and domain?              | 0-25  |

Problem overlap dominates because `frank-resume` says so directly: _"you should
always understand what is the JD saying. what problem they are trying to solve.
what kind of person they want, really is — what are their pain points."_
Keyword extraction produces a resume that matches the posting and says nothing
about the candidate. Skills outweigh experience because skills are provable and
transferable; years in a function much less so.

### Two verdicts, never averaged

`frank-resume`: _"They reach opposite verdicts and Frank has asked for both. HR
applies hard filters... The hiring manager reads the whole page and forms a
doubt about fit. A resume routinely passes one and fails the other, and saying
so is more useful than averaging them into a single verdict."_

So the fit score is the **hiring-manager** read alone. The HR read is stored
separately and never folded into it:

- `hr_verdict` — `pass`, `drag`, or `fail`
- `hr_note` — which filter, e.g. _"Dec 2026 graduation reads as unavailable"_

The two known standing HR drags, neither fixable by writing: under two years of
experience, and a December 2026 graduation date.

A job can be `tailor` with `hr_verdict = 'fail'`. That is not a contradiction —
it means the page is worth writing and the application needs a referral rather
than a portal.

### Decision

```
blocked   any gate fired
tailor    fit_score >= 70
general   fit_score 45-69   + resume_target
skip      fit_score < 45
```

### Resume routing

`frank-resume` names three general resumes, not the role x industry matrix this
spec first assumed:

| `resume_target` | Use for                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `operations`    | Manufacturing, supply chain, S&OP, demand planning, technical/business operations                |
| `data`          | Data analyst, BA, BI, analytics engineering, reporting, data quality. **Default when ambiguous** |
| `insights`      | Commercial analytics, brand and marketing insights, field and sales analytics. **Not yet built** |

And a warning worth honouring: Operations and Data are _"one page with a project
swap, not two positionings."_ Do not manufacture a distinction between them.

`resume_target` is null for `tailor` rows, where the answer is irrelevant.

## Schema

Additive columns on `public.job_queue`. Nothing existing changes.

```sql
fit_problem     int,          -- 0-45
fit_skills      int,          -- 0-30
fit_experience  int,          -- 0-25
fit_score       int generated always as
                (fit_problem + fit_skills + fit_experience) stored,
fit_decision    text,         -- tailor | general | skip | blocked
fit_reason      text,         -- the hiring-manager read, one line
hr_verdict      text,         -- pass | drag | fail
hr_note         text,         -- which filter, when not a pass
gate            text,         -- years | system | salary | clearance | authorization
soft_floor      boolean,      -- an equivalency clause was found
resume_target   text,         -- operations | data | insights; null when tailoring
scored_at       timestamptz   -- null means unscored; the batch key
```

`fit_score` is generated rather than written so the total cannot drift from its
parts. `scored_at is null` is the entire batching strategy: cost tracks new
captures, not queue size, and no job is paid for twice.

Sub-scores are stored separately because the breakdown is what makes a score
arguable — a 58 that lost its points on skills means something different from a
58 that lost them on problem overlap.

## How scoring runs

A `/score-queue` skill in this repo. Per run:

1. Fetch `job_queue` rows where `scored_at is null`.
2. Load canonical history from the `frank-resume` skill.
3. Score the batch in one pass — resume in context once, JDs appended.
4. Write results back over Supabase REST.

Roughly 5k tokens per job description, paid once per job, against a Claude
subscription.

### Where the LLM sits

| Step                                         | Executor                                     |
| -------------------------------------------- | -------------------------------------------- |
| Fetch unscored rows                          | script                                       |
| Soft-floor and years detection               | script — text patterns, auditable            |
| Industry                                     | script — `parsePosting.ts` already parses it |
| Read the JD, name the problems the team has  | model                                        |
| Compare those against actual project history | model                                        |
| Assign sub-scores, write the reason          | model                                        |
| Classify role archetype                      | model                                        |
| Write back, sort, display                    | script                                       |

Only judgment over prose is modelled. Everything mechanical stays deterministic,
and therefore testable — which matches the existing rule that `lib/` holds pure,
unit-tested functions.

### What the extension does not give us

The bento signals in `extension/detect.js` are computed in the page for display
and **never persisted** — `background.js` sends only company, position,
description and posted note. Gate detection therefore runs over the stored
`description` at scoring time. This is the better arrangement anyway: it works
retroactively over every row already captured, and a change to the pattern list
can be re-run rather than requiring a re-capture.

Two fields are worse off than that. `salary` and `workplace_type` are empty on
all 48 rows — never captured at all. The salary gate cannot be evaluated from
structured data and must be read out of the description.

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

Bands render in order: `tailor`, `general`, unscored, then `skip` and `blocked`
collapsed behind their counts.

- Each row carries its score, the three sub-scores, and the `fit_reason` line.
- The HR verdict sits beside the score as its own chip, never merged into it.
  A `tailor` row with `hr_verdict = 'fail'` is a legitimate and informative
  state: write the page, find a referral.
- `general` rows name their `resume_target`.
- `blocked` rows name the gate that fired and still show the forfeited score.
- Unscored rows read "unscored" rather than showing a zero.

## Testing

Pure functions in `src/lib/`, following the existing pattern:

- `groupOf(job)` — which band a row belongs to, including the precedence of a
  gate over a high score. A job scoring 88 behind a `years` gate must land in
  `blocked`, and that is the case worth pinning.
- `sortQueue(jobs)` — band order, then score descending, then capture date.
- `groupQueue(jobs)` — the counts the collapsed sections display.

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
