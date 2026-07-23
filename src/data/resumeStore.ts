/**
 * Local persistence for the resume list and the PDFs attached to it.
 *
 * Metadata lives in localStorage — it is small and needs to be read
 * synchronously on first render. The PDFs live in IndexedDB, because blobs
 * blow past localStorage's ~5 MB budget after two or three files.
 *
 * This is a placeholder for Phase 3: the list becomes a Supabase table and the
 * files a Storage bucket. Everything goes through this module so that swap
 * stays contained, and `exportAll` exists so nothing is stranded when it happens.
 */

import { RESUMES } from '../lib/schema';

export type Resume = {
  id: string;
  label: string;
  /** Set once a PDF is attached. */
  fileName?: string;
  fileSize?: number;
  /**
   * Written for one application and not meant for reuse.
   *
   * Kept so the application's record stays complete, but held out of the resume
   * dropdown — otherwise a year of per-role rewrites buries the two or three
   * resumes actually picked from a list.
   */
  tailored?: boolean;
  updatedAt: string;
};

const META_KEY = 'jobtracker.resumes.v1';
const DB_NAME = 'jobtracker';
const DB_VERSION = 1;
const STORE = 'resumeFiles';

/** Seeded on first run so the resume dropdown is never empty. */
const STARTER_LABELS = RESUMES;

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

function starter(): Resume[] {
  const now = new Date().toISOString();
  return STARTER_LABELS.map((label) => ({ id: newId(), label, updatedAt: now }));
}

export function loadResumes(): Resume[] {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      const seeded = starter();
      saveResumes(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    // Anything malformed is replaced rather than allowed to crash the app.
    if (!Array.isArray(parsed)) return starter();
    return parsed.filter((r) => r && typeof r.id === 'string' && typeof r.label === 'string');
  } catch {
    return starter();
  }
}

export function saveResumes(list: Resume[]): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked (private browsing). The in-memory list still
    // works for this session; nothing here is worth interrupting the user for.
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function putResumeFile(id: string, file: Blob): Promise<void> {
  return tx('readwrite', (s) => s.put(file, id)).then(() => undefined);
}

export function getResumeFile(id: string): Promise<Blob | null> {
  return tx<Blob | undefined>('readonly', (s) => s.get(id))
    .then((b) => b ?? null)
    .catch(() => null);
}

export function deleteResumeFile(id: string): Promise<void> {
  return tx('readwrite', (s) => s.delete(id))
    .then(() => undefined)
    .catch(() => undefined);
}

/** Everything needed to migrate this store to Supabase without data loss. */
export async function exportAll(): Promise<{ resumes: Resume[]; files: Record<string, Blob> }> {
  const resumes = loadResumes();
  const files: Record<string, Blob> = {};
  for (const r of resumes) {
    if (!r.fileName) continue;
    const blob = await getResumeFile(r.id);
    if (blob) files[r.id] = blob;
  }
  return { resumes, files };
}

export function makeResume(label: string, tailored = false): Resume {
  return { id: newId(), label, tailored, updatedAt: new Date().toISOString() };
}

/** The resumes offered for reuse — everything not written for a single role. */
export function generalResumes(list: Resume[]): Resume[] {
  return list.filter((r) => !r.tailored);
}
