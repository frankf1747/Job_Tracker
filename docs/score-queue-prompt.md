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

### 1. The gates are already computed. Do not re-derive them.

`queue.json` carries a `gates` object per job, produced by `scripts/gates.mjs`
and covered by tests:

```json
"gates": {
  "yearsFloor": 5,
  "softFloor": null,
  "salary": { "min": 150000, "max": 175000 },
  "location": "This role is based in San Francisco",
  "authorization": null,
  "systems": [],
  "gate": "salary"
}
```

When `gate` is non-null, set `fit_decision: "blocked"` and copy `gate` through.
Score the job anyway — the score says what the gate cost, and `gate` lets a
human check whether the machine was right.

**Do not look for these facts in the prose yourself.** Every one of them has
been got wrong that way: a 5-year floor read as 2 because a nested "including
2+" looked smaller, a $150K band missed entirely, a company's head office in
the marketing blurb recorded as the job's location. If a computed fact looks
wrong, say so in your summary — do not quietly overrule it.

`softFloor.helps` is the field that matters, not its presence. A `degree-only`
clause ("degree or equivalent relevant experience") lowers the bar for someone
without a diploma and does nothing for Frank, who has one and an MSBA.

### 2. Read the whole description

Not the first screen of it. The location, the salary band, the travel
requirement and the physical requirements all sit near the end, under the
marketing copy. A posting scored from its first half produced a reason line
naming the wrong city.

### 3. Fit — three dimensions, hiring-manager view only

Scored against `frank-resume/references/content-library.md`. Use the anchors.
A free-floating 0-45 drifts upward: an earlier run put three of six jobs in the
top band twice running, by scoring the _shape_ of a match rather than the
distance still to travel.

**`fit_problem` — 0-45. Do the challenges this team describes resemble ones he
has solved?**

|     |                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 45  | The problem they describe is one he has solved end to end, at comparable scale, and you can name the artifact |
| 36  | Same class of problem, but smaller scale or partial ownership                                                 |
| 27  | Adjacent problem; the work transfers, the domain does not                                                     |
| 18  | Same job title, different problem                                                                             |
| 9   | Only the tools overlap                                                                                        |
| 0   | Nothing                                                                                                       |

**Hard rule: you may not score above 27 unless the reason line names the
specific project or bullet from the content library that answers it.** If you
cannot name it, the match is a resemblance and belongs at 27 or below. This is
the single check that stops inflation.

**`fit_skills` — 0-30.** Count the tools and methods the posting _names as
required_. 30 means he holds all of them at the depth stated; subtract
proportionally for each he lacks, and subtract double for one that is central
rather than listed. Sandbox-level exposure (Salesforce) is not possession.

**`fit_experience` — 0-25.**

|     |                                                 |
| --- | ----------------------------------------------- |
| 25  | Same function, same domain, at the level stated |
| 20  | Same function, adjacent domain                  |
| 15  | Adjacent function, same domain                  |
| 10  | Adjacent on both                                |
| 5   | Neither                                         |

### 4. Diagnose before you score

1. **What is broken that made them open this req?** Read for _repetition_, not
   vocabulary. A posting saying the same thing three ways is naming its pain.
2. **What has burned them before?** An unusual _minimum_ qualification is scar
   tissue from the last hire.
3. **What kind of person are they describing?** One sentence.
4. **Which of his assets answers that?** Often not the obvious one.

### 5. Two verdicts. Never average them.

`fit_*` is the hiring-manager read. The HR read is separate:

- `hr_verdict`: `pass` | `drag` | `fail`
- `hr_note`: which filter, e.g. "Must live in Colorado"

`gates.location` feeds this directly: a residency requirement is an HR `fail`,
not a gate, because it is a fact about where he lives rather than what he can
do.

Two standing drags, neither fixable by writing: **under two years of
experience**, and **December 2026 graduation**.

A `tailor` row with `hr_verdict: "fail"` is valid and useful — write the page,
find a referral rather than using the portal.

### 6. Decision

```
blocked   gates.gate is non-null
tailor    fit_problem + fit_skills + fit_experience >= 70
general   45-69, and name resume_target
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
