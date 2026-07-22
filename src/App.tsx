import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApplicationsTable } from './components/ApplicationsTable';
import { Donut } from './components/Donut';
import { FilterStrip, type Chip } from './components/FilterStrip';
import { Grain, Hero, VerticalMotto } from './components/Hero';
import { LocationMap, type MapScope } from './components/LocationMap';
import { Overview } from './components/Overview';
import { ParsingOverlay } from './components/ParsingOverlay';
import { Pipeline } from './components/Pipeline';
import { ResumePanel } from './components/ResumePanel';
import { Toast, type ToastState } from './components/Toast';
import { ToolRail, ResumeIcon, SignOutIcon } from './components/ToolRail';
import { ReviewModal } from './components/ReviewModal';
import { section, sectionHeading, sectionHeadingRow } from './components/styles';
import {
  STAGE_DEFS,
  exitStats,
  funnelStages,
  industryArcs,
  mapCaption,
  momentum,
  skillArcs,
} from './lib/charts';
import {
  EMPTY_FILTER,
  derive,
  filterRows,
  hasFilter,
  parseMMDD,
  sortRows,
  type Filter,
  type SortDir,
  type SortKey,
} from './lib/derive';
import { cityAgg, normalizeLoc, type CityAggregate } from './lib/locations';
import { looksLikePosting, parsePosting, type Draft } from './lib/parsePosting';
import { DAY, MONTHS, reachedFor, type Application, type Status } from './lib/schema';
import { makeSeedRows } from './data/seed';
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from './data/applications';
import { loadResumes, saveResumes, type Resume } from './data/resumeStore';
import { supabase } from './lib/supabase';

const PAGE_SIZE = 12;

/** The date the application cycle is counting down to. */
const DEADLINE_MONTH = 11;
const DEADLINE_DAY = 11;

/** Day one of the cycle — the countdown strip draws a tick per day from here. */
const CYCLE_START = new Date(2026, 6, 22);

/** How long the parsing overlay lingers, so the transition doesn't flash. */
const PARSE_MIN_MS = 1050;

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f7f5f0',
      }}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        border: '2.5px solid #ddd6c8',
        borderTopColor: '#41678a',
        borderRadius: '50%',
        animation: 'spin .8s linear infinite',
      }}
    />
  );
}

/**
 * Where the rows come from.
 *
 * `sample` exists so the UI can be worked on without a database. It is never
 * reachable once Supabase is configured — and it is always labelled, because
 * generated rows are indistinguishable from real ones at a glance.
 */
export type DataSource = { kind: 'sample' } | { kind: 'live'; userId: string };

export default function App({ source }: { source: DataSource }) {
  const userId = source.kind === 'live' ? source.userId : null;

  const [rows, setRows] = useState<Application[]>(() =>
    source.kind === 'sample' ? makeSeedRows(442, new Date()) : [],
  );
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>(
    source.kind === 'sample' ? 'ready' : 'loading',
  );
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('applied');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dateEdit, setDateEdit] = useState<Record<string, string>>({});
  const [mapScope, setMapScope] = useState<MapScope>('all');
  const [parsing, setParsing] = useState(false);
  const [review, setReview] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [resumes, setResumes] = useState<Resume[]>(() => loadResumes());
  const [panel, setPanel] = useState<'resumes' | null>(null);

  const updateResumes = useCallback((next: Resume[]) => {
    setResumes(next);
    saveResumes(next);
  }, []);

  // The countdown and "this week" figures go stale if the tab is left open.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg: string, kind: ToastState['kind']) => {
    setToast({ msg, kind });
  }, []);

  // Optimistic writes need the pre-change row to roll back to. A ref rather
  // than the closed-over `rows`, which is a render behind by the time a
  // rejected request comes back.
  const rowsRef = useRef<Application[]>(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const reload = useCallback(() => {
    if (!userId) return;
    setLoad('loading');
    listApplications()
      .then((rs) => {
        setRows(rs);
        setLoad('ready');
      })
      .catch(() => setLoad('error'));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoad('loading');
    listApplications()
      .then((rs) => {
        if (!live) return;
        setRows(rs);
        setLoad('ready');
      })
      .catch(() => {
        if (live) setLoad('error');
      });
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- paste to add ----------
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (review || parsing) return;

      // Never hijack a paste the user aimed at a field.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }

      const text = e.clipboardData?.getData('text') ?? '';
      if (!text.trim()) return;
      e.preventDefault();

      if (!looksLikePosting(text)) {
        showToast("That didn't look like a job posting — try copying the full posting.", 'warn');
        return;
      }

      setParsing(true);
      const started = Date.now();
      parsePosting(text.trim(), new Date())
        .then((draft) => {
          const wait = Math.max(0, PARSE_MIN_MS - (Date.now() - started));
          setTimeout(() => {
            setParsing(false);
            setReview(draft);
          }, wait);
        })
        .catch(() => {
          setParsing(false);
          showToast("Couldn't read that posting. Try again or add it manually.", 'error');
        });
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [review, parsing, showToast]);

  // ---------- filtering ----------
  const toggleFilter = useCallback(
    (cat: 'skills' | 'industries' | 'statuses' | 'locations', val: string) => {
      setFilter((f) => {
        const arr = (f[cat] as string[]).slice();
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(val);
        return { ...f, [cat]: arr };
      });
      setPage(1);
    },
    [],
  );

  const toggleStage = useCallback((idx: number) => {
    setFilter((f) => ({ ...f, stage: f.stage === idx ? null : idx }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilter(EMPTY_FILTER);
    setSearch('');
    setPage(1);
  }, []);

  const onSort = useCallback(
    (key: SortKey) => {
      setSortDir((d) =>
        sortKey === key ? (d === 'asc' ? 'desc' : 'asc') : key === 'applied' ? 'desc' : 'asc',
      );
      setSortKey(key);
      setPage(1);
    },
    [sortKey],
  );

  // ---------- row mutations ----------
  /**
   * Apply a change locally at once, then persist it. The table stays as
   * responsive as it was in the prototype; a rejected write puts the old value
   * back rather than leaving the screen disagreeing with the database.
   */
  const updateRow = useCallback(
    (id: string, patch: Partial<Application>) => {
      const previous = rowsRef.current.find((r) => r.id === id);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

      if (!userId || !previous) return;
      updateApplication(id, patch).catch(() => {
        setRows((rs) => rs.map((r) => (r.id === id ? previous : r)));
        showToast(`Couldn't save that change to ${previous.company}.`, 'error');
      });
    },
    [userId, showToast],
  );

  const onStatusChange = useCallback(
    (id: string, status: Status) => updateRow(id, { status, reached: reachedFor(status) }),
    [updateRow],
  );

  /**
   * Remove a row optimistically, restoring it to its original position if the
   * delete is rejected — appending it would silently reorder ties in the table.
   */
  const deleteRow = useCallback(
    (id: string) => {
      const index = rowsRef.current.findIndex((r) => r.id === id);
      if (index < 0) return;
      const previous = rowsRef.current[index];

      setRows((rs) => rs.filter((r) => r.id !== id));
      setExpanded((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });

      const describe = `${previous.company} · ${previous.position}`;
      if (!userId) {
        showToast(`Deleted — ${describe}`, 'success');
        return;
      }

      deleteApplication(id)
        .then(() => showToast(`Deleted — ${describe}`, 'success'))
        .catch(() => {
          setRows((rs) => {
            const next = rs.slice();
            next.splice(Math.min(index, next.length), 0, previous);
            return next;
          });
          showToast(`Couldn't delete ${previous.company}. It's still here.`, 'error');
        });
    },
    [userId, showToast],
  );

  /**
   * Notes persist on a delay, unlike the other fields.
   *
   * The input fires per keystroke, so writing straight through would be one
   * request per character. A failure here also only warns — silently reverting
   * a sentence someone is mid-way through typing would be worse than the
   * mismatch it fixes.
   */
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const onNotesChange = useCallback(
    (id: string, notes: string) => {
      const previous = rowsRef.current.find((r) => r.id === id);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, notes } : r)));

      if (!userId || !previous) return;
      clearTimeout(notesTimers.current[id]);
      notesTimers.current[id] = setTimeout(() => {
        updateApplication(id, { notes }).catch(() =>
          showToast(`Couldn't save the note on ${previous.company}.`, 'error'),
        );
      }, 700);
    },
    [userId, showToast],
  );

  useEffect(() => {
    const timers = notesTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  const onDateCommit = useCallback(
    (id: string, text: string) => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (row) {
        const iso = parseMMDD(text, row.applied);
        if (iso) updateRow(id, { applied: iso, appliedTs: Date.parse(iso + 'T00:00') });
      }
      setDateEdit((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    },
    [updateRow],
  );

  /**
   * Saving is awaited rather than optimistic: the modal already shows a
   * "Saving…" state, and a new application silently failing to persist is
   * exactly the failure a tracker must not have.
   */
  const addToTracker = useCallback(async () => {
    if (!review) return;
    setSaving(true);

    const draft = {
      company: review.company,
      position: review.position,
      industry: review.industry,
      level: review.level,
      employmentType: review.employmentType,
      salary: review.salary,
      skills: review.skills.slice(),
      status: review.status,
      reached: reachedFor(review.status),
      location: review.location,
      applied: review.appliedDate,
      resume: review.resume,
      notes: '',
      sourceUrl: review.sourceUrl,
    };

    try {
      const saved = userId
        ? await createApplication(draft, userId)
        : {
            ...draft,
            id: crypto.randomUUID(),
            loc: normalizeLoc(draft.location),
            appliedTs: Date.parse(draft.applied + 'T00:00'),
          };

      setRows((rs) => [saved, ...rs]);
      setReview(null);
      setPage(1);
      setSortKey('applied');
      setSortDir('desc');
      showToast(`Added — ${review.company} · ${review.position}`, 'success');
    } catch {
      // The modal stays open with the draft intact, so nothing is retyped.
      showToast(`Couldn't save ${review.company}. Your draft is still here.`, 'error');
    } finally {
      setSaving(false);
    }
  }, [review, userId, showToast]);

  // ---------- derived ----------
  const visible = useMemo(() => filterRows(rows, filter, search), [rows, filter, search]);
  const d = useMemo(() => derive(visible, now), [visible, now]);
  const sorted = useMemo(() => sortRows(visible, sortKey, sortDir), [visible, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  const stages = useMemo(() => funnelStages(d, filter), [d, filter]);
  const exits = useMemo(() => exitStats(d, filter), [d, filter]);
  const mo = useMemo(() => momentum(rows, now), [rows, now]);
  const skills = useMemo(() => skillArcs(visible, filter.skills), [visible, filter.skills]);
  const industries = useMemo(
    () => industryArcs(visible, filter.industries),
    [visible, filter.industries],
  );
  const cities = useMemo(() => cityAgg(visible), [visible]);

  // The map's selected-city banner is derived from the filter rather than held
  // as its own state, so dismissing it and clearing the filter cannot disagree.
  const picked = useMemo(() => {
    if (filter.locations.length !== 1) return null;
    const key = filter.locations[0];
    return { key, count: cities.find((c) => c.key === key)?.count ?? 0 };
  }, [filter.locations, cities]);

  const clearPickedCity = useCallback(() => {
    setFilter((f) => ({ ...f, locations: [] }));
    setMapScope('all');
    setPage(1);
  }, []);

  // Countdown to the cycle deadline, rolling to next year once it passes.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), DEADLINE_MONTH, DEADLINE_DAY);
  if (target < midnight) target = new Date(now.getFullYear() + 1, DEADLINE_MONTH, DEADLINE_DAY);
  const cdDays = Math.max(0, Math.round((target.getTime() - midnight.getTime()) / DAY));

  // One tick per day of the cycle, counting the start day itself. PipStrip caps
  // how many it draws to whatever fits its row.
  const pipCount = Math.max(1, Math.floor((midnight.getTime() - CYCLE_START.getTime()) / DAY) + 1);

  const chips: Chip[] = [
    ...filter.skills.map((s) => ({
      kind: 'skill',
      label: s,
      remove: () => toggleFilter('skills', s),
    })),
    ...filter.industries.map((s) => ({
      kind: 'ind',
      label: s,
      remove: () => toggleFilter('industries', s),
    })),
    ...filter.statuses.map((s) => ({
      kind: 'status',
      label: s,
      remove: () => toggleFilter('statuses', s),
    })),
    ...filter.locations.map((s) => ({
      kind: 'loc',
      label: s,
      remove: () => toggleFilter('locations', s),
    })),
    ...(filter.stage != null
      ? [
          {
            kind: 'stage',
            label: 'reached ' + STAGE_DEFS[filter.stage][0],
            remove: () => toggleStage(filter.stage!),
          },
        ]
      : []),
  ];

  const filtered = hasFilter(filter);
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent || '');

  // Clicking a pin filters to that city; clicking it again clears the filter.
  const onPickCity = (c: CityAggregate) => toggleFilter('locations', c.key);

  if (load === 'loading') return <FullPage>{<Spinner />}</FullPage>;

  if (load === 'error') {
    return (
      <FullPage>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2c3640' }}>
            Couldn't load your applications
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#5f6a75', lineHeight: 1.6 }}>
            The database didn't answer. If the project has been idle for a while it may have been
            paused — opening the Supabase dashboard wakes it.
          </p>
          <button
            onClick={reload}
            style={{
              marginTop: 16,
              background: '#41678a',
              border: '1px solid #41678a',
              borderRadius: 7,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: '#f4f2ec',
            }}
          >
            Try again
          </button>
        </div>
      </FullPage>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#f7f5f0',
        backgroundImage:
          'linear-gradient(rgba(44,54,64,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(44,54,64,.022) 1px,transparent 1px)',
        backgroundSize: '44px 44px',
      }}
    >
      <VerticalMotto />
      <Grain />
      <Hero pasteKey={isMac ? '⌘' : 'Ctrl'} />

      <div
        style={{ position: 'relative', maxWidth: 1360, margin: '0 auto', padding: '0 34px 90px' }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 1360 2400"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            pointerEvents: 'none',
          }}
          fill="none"
          stroke="#8a9db0"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M40 360 C260 344 620 372 880 356 C1030 347 1200 366 1320 354" opacity=".4" />
          <path
            d="M980 760 C1080 748 1180 762 1240 800 C1272 820 1252 836 1236 822"
            opacity=".42"
          />
          <path d="M60 1520 C120 1502 240 1510 316 1520 C348 1524 340 1542 314 1536" opacity=".4" />
          <path
            d="M1180 1980 C1260 1996 1300 2024 1272 2050 C1252 2068 1238 2050 1250 2038"
            opacity=".38"
          />
        </svg>

        {filtered && (
          <FilterStrip
            chips={chips}
            shownCount={d.total}
            totalCount={rows.length}
            onReset={resetFilters}
          />
        )}

        <Overview
          totalApps={rows.length.toLocaleString()}
          totalAppsSub={
            filtered ? `${d.total.toLocaleString()} match current filter` : '- keep going'
          }
          cdWeeks={Math.floor(cdDays / 7)}
          cdDays={cdDays}
          cdDaysExtra={cdDays % 7}
          cdTargetLabel={`${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}`}
          dayNumber={pipCount}
        />

        <Pipeline
          stages={stages}
          exits={exits}
          momentum={mo}
          onToggleStage={toggleStage}
          onToggleStatus={(s) => toggleFilter('statuses', s)}
        />

        <ApplicationsTable
          rows={pageRows}
          total={sorted.length}
          unfilteredTotal={rows.length}
          pasteKey={isMac ? '⌘' : 'Ctrl'}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          expanded={expanded}
          onToggleExpand={(id) =>
            setExpanded((e) => {
              const next = { ...e };
              if (next[id]) delete next[id];
              else next[id] = true;
              return next;
            })
          }
          dateEdit={dateEdit}
          onDateFocus={(id, current) => setDateEdit((e) => ({ ...e, [id]: current }))}
          onDateInput={(id, v) => setDateEdit((e) => ({ ...e, [id]: v }))}
          onDateCommit={onDateCommit}
          onStatusChange={onStatusChange}
          onNotesChange={onNotesChange}
          onDelete={deleteRow}
          onPickSkill={(s) => toggleFilter('skills', s)}
          pageInfo={
            sorted.length
              ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, sorted.length)} of ${sorted.length}`
              : '0 results'
          }
          page={currentPage}
          totalPages={totalPages}
          onPrev={() => setPage((x) => Math.max(1, x - 1))}
          onNext={() => setPage((x) => Math.min(totalPages, x + 1))}
        />

        <section style={section}>
          <div style={sectionHeadingRow}>
            <h2 style={sectionHeading}>Breakdowns</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Donut
              title="BY INDUSTRY"
              subtitle="share of applications"
              arcs={industries}
              onPick={(n) => toggleFilter('industries', n)}
            />
            <Donut
              title="TOP SKILLS"
              subtitle="share of mentions"
              arcs={skills}
              onPick={(n) => toggleFilter('skills', n)}
            />
            <LocationMap
              cities={cities}
              scope={mapScope}
              onScope={setMapScope}
              selectedLocations={filter.locations}
              onPick={onPickCity}
              picked={picked}
              onClearPick={clearPickedCity}
              caption={mapCaption(visible)}
            />
          </div>
        </section>
      </div>

      <ToolRail
        tools={[
          {
            id: 'resumes',
            label: 'Resumes',
            icon: <ResumeIcon />,
            onClick: () => setPanel('resumes'),
          },
          ...(userId
            ? [
                {
                  id: 'sign-out',
                  label: 'Sign out',
                  icon: <SignOutIcon />,
                  onClick: () => void supabase?.auth.signOut(),
                },
              ]
            : []),
        ]}
      />

      {panel === 'resumes' && (
        <ResumePanel resumes={resumes} onChange={updateResumes} onClose={() => setPanel(null)} />
      )}

      {parsing && <ParsingOverlay />}

      {review && (
        <ReviewModal
          review={review}
          resumes={resumes.map((r) => r.label)}
          saving={saving}
          onPatch={(patch) => setReview((r) => (r ? { ...r, ...patch } : r))}
          onAddSkill={() =>
            setReview((r) => {
              if (!r) return r;
              const d = r.draft.trim();
              if (!d || r.skills.indexOf(d) >= 0) return { ...r, draft: '' };
              return { ...r, skills: [...r.skills, d], draft: '' };
            })
          }
          onRemoveSkill={(i) =>
            setReview((r) => (r ? { ...r, skills: r.skills.filter((_, j) => j !== i) } : r))
          }
          onDiscard={() => setReview(null)}
          onSave={addToTracker}
        />
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}
