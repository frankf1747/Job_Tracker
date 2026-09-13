# 応募記録 — Job Tracker

A personal job-application tracker. Paste a posting and it becomes a row; queue
one from LinkedIn and it lands in the tracker to apply to later.

Live at [frank-job.netlify.app](https://frank-job.netlify.app).

---

## What it does

**Applications** — Paste a job posting anywhere on the page and a parser pulls
out company, title, location, salary, skills, industry, level and employment
type. Nothing is saved until you confirm it in a review modal, because a
confident wrong guess is worse than a blank field.

**Pipeline** — A conversion funnel (Submitted → OA → Interview → Offer), weekly
and hourly momentum, and breakdowns by industry, skill and location. The funnel
reads a `reached` value stored separately from `status`, so a rejection after an
interview still counts as having reached the interview stage.

**Queue** — Jobs captured from LinkedIn by the Chrome extension, waiting to be
applied to. Each shows the employer's real application URL, the job description,
and detected signals (visa sponsorship, years of experience, pay range). Queued
jobs stay out of the funnel until you promote them into applications.

**Resumes** — Versions and their PDFs, stored on your account so they follow you
between machines. A resume written for one role is marked role-specific and kept
out of the reusable picker.

**Company List** — Target companies and outreach notes, separate from
applications: places not yet applied to.

---

## Stack

React 19 · TypeScript · Vite · Supabase (Postgres + Auth + Storage) · Netlify

No component library and no CSS framework — styles are inline, with a small
shared token file in `src/components/styles.ts`.

---

## Running it

```bash
npm install
npm run dev
```

Create a `.env` in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

Without these the app falls back to generated sample data and says so. The anon
key is meant to ship in the browser bundle — **row-level security is the actual
security boundary**, not the key.

### Database

Apply everything in `supabase/migrations/` in filename order, either with
`supabase db push` or by pasting each file into the Supabase SQL editor.

Every table is scoped by `user_id` with RLS. Sign-in uses a username, expanded
to `username@jobtracker.local` — a domain that receives no mail — so there is no
mailbox to own.

### Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck and build |
| `npm test` | run tests (164) |
| `npm run lint` | oxlint |
| `npm run format` | prettier |

---

## Chrome extension

`extension/` holds an unpacked MV3 extension that adds a **Queue** button to
LinkedIn job postings.

**Install:** copy `extension/config.example.js` to `extension/config.js` and fill
in the same two Supabase values. Then `chrome://extensions` → enable Developer
mode → **Load unpacked** → select `extension/`. Sign in from the toolbar popup
with your tracker credentials.

`config.js` is gitignored.

It writes straight to Supabase over the REST API — no backend, no build step,
and the same RLS applies. A few things worth knowing:

- **The employer's real apply URL** is recovered by decoding the `url` parameter
  out of LinkedIn's `/safety/go/` redirect. No clicking, so LinkedIn never
  records a "clicked apply".
- **Nothing keys off a CSS class.** LinkedIn ships hashed class names, so the
  posting card is found by measurement and the description by link density —
  both survive a redesign.
- **Easy Apply postings have no external URL.** The queue falls back to the
  LinkedIn posting.

---

## Layout

```
src/
  components/    UI, one file per surface
  data/          the only modules that know about Supabase
  lib/           parsing, deriving, charting — pure and unit-tested
extension/       the Chrome extension
supabase/        migrations
```

The rule the codebase follows: anything above `data/` speaks in domain types;
only `data/` speaks in database rows. Tests live beside the `lib/` modules they
cover, which is where the logic worth testing lives.
