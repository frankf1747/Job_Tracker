# Handoff: score the job queue

A prompt for a model session that triages Frank's job queue. Self-contained:
everything needed is either inline or at a path named below.

---

## Task

Every job in `job_queue` is waiting for one decision: **tailor a resume, send a
general one, skip it, or record that a gate makes it unreachable.** Produce that
decision for each unscored job, with a one-line reason worth reading, and write
the results back.

You are the only model in this system. The tracker renders stored columns and
never calls a model, so your output is a durable fact, not a suggestion.

## Setup

```bash
node scripts/queue-dump.mjs queue.json      # all rows, credentials from the macOS keychain
```

Read, in this order:

| Path                                                       | What it gives you                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-09-17-queue-triage-design.md` | The rubric and why each weight is what it is                                                                      |
| `frank-resume/references/content-library.md`               | **Canonical history. The only source for what Frank has actually done.** Locked figures; do not invent or inflate |
| `queue.json`                                               | `id`, `company`, `position`, `description` per job                                                                |

`salary` and `workplace_type` are empty on every row — never captured. Read pay
out of the description or treat it as unknown.

## Rules

### 1. Gates first. Five of them.

Any one sets `fit_decision: "blocked"` and records which in `gate`:

| `gate`          | Fires when                                               |
| --------------- | -------------------------------------------------------- |
| `years`         | A flat years floor above ~2 **and no soft-floor clause** |
| `system`        | A required system Frank has never used                   |
| `salary`        | A band far above roughly $65–110K                        |
| `clearance`     | US citizenship, green card, or active clearance required |
| `authorization` | An explicit no-sponsorship requirement                   |

Systems Frank has **never used** — a _required_ mention fires `system`:
Jira/Confluence, WMS (HighJump/Korber), Agile ceremony facilitation
(standups, sprint planning, retros), specialty-pharmacy file specs, metadata
catalog tools, claims data / provider performance measurement / clinical
groupers, deep learning or RL model building.

Score a blocked job anyway. The score says what the gate cost; `gate` lets a
human check whether the machine was right. Both are required.

### 2. Soft floors override the years gate

The highest-value signal in the whole rubric. Set `soft_floor: true` when the
posting carries any of:

- **degree ladder** — "Bachelor's + 3 years, Master's + 1 year" (his MSBA is
  worth roughly two years)
- **equivalency clause** — "or equivalent professional experience", "any
  suitable combination of education, experience or training", "in lieu of"
- **new-grad door** — "2+ years or a recent graduate"

`frank-resume` is explicit: postings with one of these are where Frank is
genuinely competitive; postings with a flat "3+ years" and no clause are not.
`soft_floor: true` and `gate: "years"` cannot both hold.

### 3. Fit — three dimensions, hiring-manager view only

| Field            | Question                                                           | Range |
| ---------------- | ------------------------------------------------------------------ | ----- |
| `fit_problem`    | Do the challenges this team describes resemble ones he has solved? | 0–45  |
| `fit_skills`     | Are the named tools and methods ones he holds?                     | 0–30  |
| `fit_experience` | Does his history sit in this function and domain?                  | 0–25  |

Problem overlap dominates. Diagnose before scoring, in this order:

1. **What is broken that made them open this req?** Read for _repetition_, not
   vocabulary. A posting saying the same thing three ways is naming its pain.
2. **What has burned them before?** An unusual _minimum_ qualification is scar
   tissue from the last hire.
3. **What kind of person are they describing?** One sentence.
4. **Which of his assets answers that?** Often not the obvious one.

### 4. Two verdicts. Never average them.

`fit_*` is the hiring-manager read. The HR read is separate:

- `hr_verdict`: `pass` | `drag` | `fail`
- `hr_note`: which filter, e.g. "6 years required, no equivalency clause"

Two standing drags, neither fixable by writing: **under two years of
experience**, and **December 2026 graduation** (reads as unavailable).

A `tailor` row with `hr_verdict: "fail"` is valid and useful — it means write
the page and find a referral rather than using the portal.

### 5. Decision

```
blocked   any gate fired
tailor    fit_problem + fit_skills + fit_experience >= 70
general   45–69, and name resume_target
skip      < 45
```

`resume_target` is `operations` | `data` | `insights`, null when tailoring.
Data is the default when ambiguous. Operations and Data are _"one page with a
project swap, not two positionings"_ — do not invent a distinction.

## Two traps that cost a previous run

- **Do not take the lowest years figure.** "5+ years of strategy, including 2+
  in consulting" has a floor of **5**, not 2. Read the floor of the _primary_
  requirement.
- **Equivalency clauses hide in unusual wording.** "Will accept any suitable
  combination of education, experience or training" is a soft floor and was
  missed by a pattern list that only looked for "or equivalent".

## Two things to report rather than score

- **Thin captures.** ~10 of 48 rows hold employer boilerplate instead of the
  job description — the extension's link-density heuristic lost. If a
  description has no requirements or responsibilities in it, **do not score
  it**: leave it out of the output and list it separately. A confident score
  over the wrong text is worse than no score.
- **Practical blockers the rubric cannot see** — an on-site factory role with a
  50 lb lifting requirement scores well on data work and may still be wrong.
  Note these in `fit_reason`.

## Output

A JSON array. One object per scored job:

```json
[
  {
    "id": "uuid-from-queue.json",
    "fit_problem": 43,
    "fit_skills": 29,
    "fit_experience": 21,
    "fit_decision": "tailor",
    "fit_reason": "Rebuilding QC reporting off instrument telemetry — the shape of his BioMarin batch work — and they name Databricks.",
    "hr_verdict": "drag",
    "hr_note": "Dec 2026 graduation reads as unavailable",
    "gate": null,
    "soft_floor": false,
    "resume_target": null
  }
]
```

**`fit_reason` is the deliverable.** One sentence, naming the specific thing
that decided it — a concrete overlap with real work, or the concrete gap. It
must tell Frank something the job title did not. _"Strong analytical role
matching your background"_ is a failure; _"they're rebuilding forecasting off
dirty POS data, which is the Tapestry work"_ is the bar.

## Write back

```bash
node scripts/queue-score.mjs scores.json --dry-run   # validate, write nothing
node scripts/queue-score.mjs scores.json             # write
```

The script validates every row before writing anything: ranges, vocabularies,
and cross-field rules (a gate must pair with `blocked`, `general` must name a
resume, `soft_floor` cannot coexist with a `years` gate). It reports every
problem at once and exits without writing if there are any. Run `--dry-run`
first.

Results appear in the tracker's Queue page immediately, banded and sorted.
