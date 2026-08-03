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
import { ToolRail, CompanyIcon, HomeIcon, ResumeIcon, SignOutIcon } from './components/ToolRail';
import { CompanyList } from './components/CompanyList';
import {
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
  type Company,
} from './data/companies';
import { ReviewModal } from './components/ReviewModal';
import { section, sectionHeading, sectionHeadingRow } from './components/styles';
import {
  STAGE_DEFS,
  exitStats,
  funnelStages,
  dailyMomentum,
  hourHistogram,
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
import {
  draftFromApplication,
  looksLikePosting,
  parsePosting,
  type Draft,
} from './lib/parsePosting';
import { DAY, MONTHS, reachedFrom, type Application, type Status } from './lib/schema';
import { makeSeedRows } from './data/seed';
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from './data/applications';
import {
  generalResumes,
  loadResumes,
  localResumeBackend,
  type Resume,
  type ResumeBackend,
} from './data/resumeStore';
import { supabaseResumeBackend } from './data/resumes';
import type { NewResume } from './components/ResumeField';
import { supabase } from './lib/supabase';

const PAGE_SIZE = 12;

/** The date the application cycle is counting down to. */
const DEADLINE_MONTH = 11;
const DEADLINE_DAY = 11;

/** Day one of the cycle — the countdown strip draws a tick per day from here. */
const CYCLE_START = new Date(2026, 6, 22);

/** How long the parsing overlay lingers, so the transition doesn't flash. */
const PARSE_MIN_MS = 1050;

/** Example rows for the Company List in sample mode, so the page isn't blank. */
const SAMPLE_COMPANIES: Company[] = [
  {
    id: 'sample-1',
    name: 'Regeneron',
    notes: 'Referral — @Priya Menon (alum). Biostatistics team hiring in spring.',
    reachedOut: false,
    scheduledOn: '',
    createdAt: Date.now(),
  },
  {
    id: 'sample-2',
    name: 'Ramp',
    notes: 'Intro from @Sam Ortiz — watch careers page for data roles.',
    reachedOut: true,
    scheduledOn: '',
    createdAt: Date.now() - 86_400_000,
  },
];

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
  // A resume added in the modal but not yet written: it is persisted only when
  // the application saves, so an abandoned draft leaves no orphan resume behind.
  const [pendingResume, setPendingResume] = useState<NewResume | null>(null);
  // The row being edited, or null when the modal is adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Signed in, resumes load from Supabase (below); in sample mode they stay in
  // this browser, seeded so the picker is never empty.
  const [resumes, setResumes] = useState<Resume[]>(() =>
    source.kind === 'sample' ? loadResumes() : [],
  );
  const [resumesLoad, setResumesLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    source.kind === 'sample' ? 'ready' : 'idle',
  );
  const [panel, setPanel] = useState<'resumes' | null>(null);
  const [view, setView] = useState<'home' | 'companies'>('home');

  // Company List. In sample mode it is seeded local state; signed in it loads
  // from Supabase the first time the page is opened.
  const [companies, setCompanies] = useState<Company[]>(() =>
    source.kind === 'sample' ? SAMPLE_COMPANIES : [],
  );
  const [companiesLoad, setCompaniesLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    source.kind === 'sample' ? 'ready' : 'idle',
  );
  const companiesRef = useRef<Company[]>(companies);
  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  // Where resumes are stored: the account when signed in, this browser when not.
  // Callers below go through this and never learn which one they got.
  const resumeBackend: ResumeBackend = useMemo(
    () => (userId ? supabaseResumeBackend(userId) : localResumeBackend()),
    [userId],
  );

  // Signed in, pull the list once on load. Eager rather than lazy: the review
  // modal's picker needs it the moment a posting is pasted.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    setResumesLoad('loading');
    resumeBackend
      .list()
      .then((rs) => {
        if (!live) return;
        setResumes(rs);
        setResumesLoad('ready');
      })
      .catch(() => live && setResumesLoad('error'));
    return () => {
      live = false;
    };
  }, [userId, resumeBackend]);

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

  // Read inside the paste handler for the default resume, without making the
  // handler re-register every time the resume list changes.
  const resumesRef = useRef<Resume[]>(resumes);
  useEffect(() => {
    resumesRef.current = resumes;
  }, [resumes]);

  /**
   * The resume a new application defaults to. A tailored resume belongs to the
   * application it was written for, so it is never the default for the next one.
   */
  const defaultResume = useCallback(
    () => generalResumes(resumesRef.current)[0]?.label ?? resumesRef.current[0]?.label ?? '',
    [],
  );

  /**
   * Create a resume from inside the review modal, so a role-specific rewrite
   * doesn't force the half-filled application to be abandoned first. Persists
   * through the active backend, then mirrors it into the displayed list.
   */
  const createResume = useCallback(
    async (input: NewResume) => {
      const resume = await resumeBackend.create(input);
      setResumes((prev) => [...prev, resume]);
    },
    [resumeBackend],
  );

  // The Resumes panel's edits, each persisted through the backend and then
  // mirrored into state. Mirrored rather than refetched so a rename or a toggle
  // doesn't cost a round trip to see itself.
  const renameResume = useCallback(
    async (id: string, label: string) => {
      await resumeBackend.rename(id, label);
      setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
    },
    [resumeBackend],
  );

  const setResumeTailored = useCallback(
    async (id: string, tailored: boolean) => {
      await resumeBackend.setTailored(id, tailored);
      setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, tailored } : r)));
    },
    [resumeBackend],
  );

  const addResume = useCallback(
    async (label: string, file?: File) => {
      await createResume({ label, tailored: false, file });
    },
    [createResume],
  );

  const deleteResume = useCallback(
    async (id: string) => {
      await resumeBackend.remove(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    },
    [resumeBackend],
  );

  const attachResume = useCallback(
    async (id: string, file: File) => {
      const { fileName, fileSize } = await resumeBackend.attach(id, file);
      setResumes((prev) => prev.map((r) => (r.id === id ? { ...r, fileName, fileSize } : r)));
    },
    [resumeBackend],
  );

  const detachResume = useCallback(
    async (id: string) => {
      await resumeBackend.detach(id);
      setResumes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, fileName: undefined, fileSize: undefined } : r)),
      );
    },
    [resumeBackend],
  );

  const openResumeFile = useCallback(
    (id: string) => resumeBackend.getFile(id),
    [resumeBackend],
  );

  /**
   * Hold a resume created in the review modal against the draft, selecting it,
   * without writing anything yet. saveReview persists it once the row is saved.
   */
  const stageResume = useCallback((nr: NewResume) => {
    setPendingResume(nr);
    setReview((r) => (r ? { ...r, resume: nr.label } : r));
  }, []);

  // ---------- company list ----------
  const loadCompanies = useCallback(() => {
    if (!userId) return;
    setCompaniesLoad('loading');
    listCompanies()
      .then((cs) => {
        setCompanies(cs);
        setCompaniesLoad('ready');
      })
      .catch(() => setCompaniesLoad('error'));
  }, [userId]);

  // Lazy: the query only runs the first time the page is opened.
  const openCompanies = useCallback(() => {
    setView('companies');
    if (userId && companiesLoad === 'idle') loadCompanies();
  }, [userId, companiesLoad, loadCompanies]);

  const addCompany = useCallback(
    async (name: string, notes: string) => {
      if (!userId) {
        setCompanies((cs) => [
          {
            id: crypto.randomUUID(),
            name,
            notes,
            reachedOut: false,
            scheduledOn: '',
            createdAt: Date.now(),
          },
          ...cs,
        ]);
        return;
      }
      try {
        const saved = await createCompany(name, notes, userId);
        setCompanies((cs) => [saved, ...cs]);
      } catch {
        showToast(`Couldn't save ${name}.`, 'error');
      }
    },
    [userId, showToast],
  );

  const renameCompany = useCallback(
    (id: string, name: string) => {
      const prev = companiesRef.current.find((c) => c.id === id);
      setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
      if (!userId || !prev) return;
      updateCompany(id, { name }).catch(() => {
        setCompanies((cs) => cs.map((c) => (c.id === id ? prev : c)));
        showToast(`Couldn't rename ${prev.name}.`, 'error');
      });
    },
    [userId, showToast],
  );

  // The reached-out toggle and scheduled date are discrete, so they persist
  // immediately (unlike notes), still optimistic with rollback.
  const patchCompany = useCallback(
    (id: string, patch: Partial<Pick<Company, 'reachedOut' | 'scheduledOn'>>) => {
      const prev = companiesRef.current.find((c) => c.id === id);
      setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      if (!userId || !prev) return;
      updateCompany(id, patch).catch(() => {
        setCompanies((cs) => cs.map((c) => (c.id === id ? prev : c)));
        showToast(`Couldn't update ${prev.name}.`, 'error');
      });
    },
    [userId, showToast],
  );

  // Notes fire per keystroke, so persistence is debounced, like the table's.
  const companyNoteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const noteCompany = useCallback(
    (id: string, notes: string) => {
      setCompanies((cs) => cs.map((c) => (c.id === id ? { ...c, notes } : c)));
      if (!userId) return;
      clearTimeout(companyNoteTimers.current[id]);
      companyNoteTimers.current[id] = setTimeout(() => {
        updateCompany(id, { notes }).catch(() => showToast("Couldn't save that note.", 'error'));
      }, 700);
    },
    [userId, showToast],
  );

  useEffect(() => {
    const timers = companyNoteTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  const removeCompany = useCallback(
    (id: string) => {
      const index = companiesRef.current.findIndex((c) => c.id === id);
      if (index < 0) return;
      const prev = companiesRef.current[index];
      setCompanies((cs) => cs.filter((c) => c.id !== id));
      if (!userId) return;
      deleteCompany(id).catch(() => {
        setCompanies((cs) => {
          const next = cs.slice();
          next.splice(Math.min(index, next.length), 0, prev);
          return next;
        });
        showToast(`Couldn't remove ${prev.name}.`, 'error');
      });
    },
    [userId, showToast],
  );

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
      if (review || parsing || view !== 'home') return;

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
            // Default to a resume that actually exists in the user's list,
            // rather than the parser's built-in constant.
            setEditingId(null);
            setReview({ ...draft, resume: defaultResume() || draft.resume });
          }, wait);
        })
        .catch(() => {
          setParsing(false);
          showToast("Couldn't read that posting. Try again or add it manually.", 'error');
        });
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [review, parsing, view, showToast, defaultResume]);

  /** Reopen the review modal on an existing row, to edit it. */
  const startEdit = useCallback((id: string) => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    setEditingId(id);
    setReview(draftFromApplication(row));
  }, []);

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

  // The closed funnel row filters to both terminal statuses at once; toggling
  // clears them if both are already on, matching the individual exit chips.
  const toggleClosed = useCallback(() => {
    setFilter((f) => {
      const both = f.statuses.includes('Rejected') && f.statuses.includes('Ghosted');
      const without = f.statuses.filter((s) => s !== 'Rejected' && s !== 'Ghosted');
      return { ...f, statuses: both ? without : [...without, 'Rejected', 'Ghosted'] };
    });
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
    (id: string, status: Status) => {
      // Preserve how far the row already got, so a terminal status doesn't
      // rewrite its history — a rejection after an interview stays at Interview.
      const current = rowsRef.current.find((r) => r.id === id)?.reached ?? 0;
      updateRow(id, { status, reached: reachedFrom(status, current) });
    },
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

  const closeReview = useCallback(() => {
    setReview(null);
    setEditingId(null);
    setPendingResume(null);
  }, []);

  /**
   * Commit the review modal — creating a new row, or updating the one being
   * edited. Awaited rather than optimistic: the modal shows a "Saving…" state,
   * and a save silently failing is exactly the failure a tracker must not have.
   * On failure the modal stays open with the draft intact, so nothing is retyped.
   */
  const saveReview = useCallback(async () => {
    if (!review) return;
    setSaving(true);

    // Everything the modal can set. Notes are intentionally excluded so editing
    // a row never clears a note typed inline; reached follows status, matching
    // the inline status dropdown — preserving an edited row's prior progress.
    const priorReached = editingId
      ? (rowsRef.current.find((r) => r.id === editingId)?.reached ?? 0)
      : 0;
    const fields = {
      company: review.company,
      position: review.position,
      industry: review.industry,
      level: review.level,
      employmentType: review.employmentType,
      salary: review.salary,
      skills: review.skills.slice(),
      status: review.status,
      reached: reachedFrom(review.status, priorReached),
      location: review.location,
      applied: review.appliedDate,
      resume: review.resume,
      sourceUrl: review.sourceUrl,
    };
    const derived = {
      loc: normalizeLoc(fields.location),
      appliedTs: Date.parse(fields.applied + 'T00:00'),
    };

    try {
      // Persist the modal's staged resume first, so the row's label points at a
      // record that exists. Guarded by the label so a resume that was staged and
      // then replaced by an existing pick is never written.
      if (pendingResume && pendingResume.label === review.resume) {
        await createResume(pendingResume);
        setPendingResume(null);
      }

      if (editingId) {
        if (userId) await updateApplication(editingId, fields);
        setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, ...fields, ...derived } : r)));
        closeReview();
        showToast(`Updated — ${review.company} · ${review.position}`, 'success');
      } else {
        const saved = userId
          ? await createApplication({ ...fields, notes: '' }, userId)
          : // Sample mode has no database to stamp the row, so it stands in.
            { ...fields, notes: '', id: crypto.randomUUID(), createdAt: Date.now(), ...derived };
        setRows((rs) => [saved, ...rs]);
        closeReview();
        setPage(1);
        setSortKey('applied');
        setSortDir('desc');
        showToast(`Added — ${review.company} · ${review.position}`, 'success');
      }
    } catch {
      showToast(`Couldn't save ${review.company}. Your draft is still here.`, 'error');
    } finally {
      setSaving(false);
    }
  }, [review, editingId, userId, showToast, closeReview, pendingResume, createResume]);

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
  const dailyMo = useMemo(() => dailyMomentum(rows, now), [rows, now]);
  const skills = useMemo(() => skillArcs(visible, filter.skills), [visible, filter.skills]);
  const industries = useMemo(
    () => industryArcs(visible, filter.industries),
    [visible, filter.industries],
  );
  const cities = useMemo(() => cityAgg(visible), [visible]);
  // Follows the filters, like the rest of Breakdowns: narrowing to Offer then
  // shows which hours actually produced offers.
  const hours = useMemo(() => hourHistogram(visible), [visible]);

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

      {/* The dashboard stays mounted while the Company List page is open, so
          returning Home doesn't remount the Hero and re-decode its background
          photo. `inert` takes it out of the tab order and the accessibility
          tree — the reason it used to be unmounted — and the opaque Company
          List overlay hides it from view. */}
      <div inert={view !== 'home'}>
        <Hero pasteKey={isMac ? '⌘' : 'Ctrl'} />

        <div className="page" style={{ position: 'relative', maxWidth: 1360, margin: '0 auto' }}>
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
            <path
              d="M60 1520 C120 1502 240 1510 316 1520 C348 1524 340 1542 314 1536"
              opacity=".4"
            />
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
            daily={dailyMo}
            hours={hours}
            onToggleStage={toggleStage}
            onToggleClosed={toggleClosed}
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
            onEdit={startEdit}
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
      </div>

      <ToolRail
        tools={[
          {
            id: 'home',
            label: 'Home',
            icon: <HomeIcon />,
            onClick: () => setView('home'),
            active: view === 'home',
          },
          {
            id: 'companies',
            label: 'Company List',
            icon: <CompanyIcon />,
            onClick: openCompanies,
            active: view === 'companies',
          },
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

      {view === 'companies' && (
        <CompanyList
          companies={companies}
          load={companiesLoad === 'idle' ? 'ready' : companiesLoad}
          onAdd={addCompany}
          onRename={renameCompany}
          onNotes={noteCompany}
          onPatch={patchCompany}
          onDelete={removeCompany}
          onReload={loadCompanies}
        />
      )}

      {panel === 'resumes' && (
        <ResumePanel
          resumes={resumes}
          live={!!userId}
          loading={resumesLoad === 'loading'}
          onAdd={addResume}
          onRename={renameResume}
          onToggleTailored={setResumeTailored}
          onDelete={deleteResume}
          onAttach={attachResume}
          onDetach={detachResume}
          onOpenFile={openResumeFile}
          onClose={() => setPanel(null)}
        />
      )}

      {parsing && <ParsingOverlay />}

      {review && (
        <ReviewModal
          review={review}
          mode={editingId ? 'edit' : 'add'}
          resumes={resumes}
          onStageResume={stageResume}
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
          onDiscard={closeReview}
          onSave={saveReview}
        />
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}
