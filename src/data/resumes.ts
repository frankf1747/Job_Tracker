/**
 * The only module that knows resumes live in Supabase — a `resumes` row per
 * version, and the PDF behind it in the private `resumes` Storage bucket.
 *
 * Mirrors data/applications.ts: everything above speaks the `Resume` shape,
 * everything here speaks snake_case rows and bucket paths, and the translation
 * stays in this one place. Returned as a `ResumeBackend` so App can swap it for
 * the browser-local one when signed out without touching a single caller.
 */

import { requireSupabase } from '../lib/supabase';
import { makeResume, type Resume, type ResumeBackend } from './resumeStore';

const TABLE = 'resumes';
const BUCKET = 'resumes';
const COLUMNS = 'id,label,tailored,file_name,file_size,storage_path,updated_at';

/** Shape as stored. Mirrors supabase/migrations/20260728000000_resumes.sql. */
type Row = {
  id: string;
  label: string;
  tailored: boolean;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  updated_at: string;
};

function toResume(row: Row): Resume {
  return {
    id: row.id,
    label: row.label,
    tailored: row.tailored,
    fileName: row.file_name ?? undefined,
    fileSize: row.file_size ?? undefined,
    updatedAt: row.updated_at,
  };
}

/** Deterministic: one PDF per resume, under the user's own folder. */
const pathFor = (userId: string, id: string) => `${userId}/${id}.pdf`;

export function supabaseResumeBackend(userId: string): ResumeBackend {
  const db = () => requireSupabase();

  return {
    async list() {
      const { data, error } = await db()
        .from(TABLE)
        .select(COLUMNS)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as Row[]).map(toResume);
    },

    async create({ label, tailored, file }) {
      // Generated here so the file can be uploaded to its final path before the
      // row exists — an id is needed either way.
      const resume = makeResume(label, tailored ?? false);
      let storagePath: string | null = null;
      if (file) {
        storagePath = pathFor(userId, resume.id);
        const up = await db().storage.from(BUCKET).upload(storagePath, file, { upsert: true });
        if (up.error) throw up.error;
        resume.fileName = file.name;
        resume.fileSize = file.size;
      }
      const { error } = await db()
        .from(TABLE)
        .insert({
          id: resume.id,
          user_id: userId,
          label,
          tailored: tailored ?? false,
          file_name: file?.name ?? null,
          file_size: file?.size ?? null,
          storage_path: storagePath,
        });
      if (error) throw error;
      return resume;
    },

    async rename(id, label) {
      const { error } = await db().from(TABLE).update({ label }).eq('id', id);
      if (error) throw error;
    },

    async setTailored(id, tailored) {
      const { error } = await db().from(TABLE).update({ tailored }).eq('id', id);
      if (error) throw error;
    },

    async remove(id) {
      // Best-effort file removal first; the row is the source of truth, so a
      // storage hiccup shouldn't strand the metadata.
      await db()
        .storage.from(BUCKET)
        .remove([pathFor(userId, id)])
        .catch(() => undefined);
      const { error } = await db().from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },

    async attach(id, file) {
      const storagePath = pathFor(userId, id);
      const up = await db().storage.from(BUCKET).upload(storagePath, file, { upsert: true });
      if (up.error) throw up.error;
      const { error } = await db()
        .from(TABLE)
        .update({ file_name: file.name, file_size: file.size, storage_path: storagePath })
        .eq('id', id);
      if (error) throw error;
      return { fileName: file.name, fileSize: file.size };
    },

    async detach(id) {
      await db()
        .storage.from(BUCKET)
        .remove([pathFor(userId, id)])
        .catch(() => undefined);
      const { error } = await db()
        .from(TABLE)
        .update({ file_name: null, file_size: null, storage_path: null })
        .eq('id', id);
      if (error) throw error;
    },

    async getFile(id) {
      const { data, error } = await db().storage.from(BUCKET).download(pathFor(userId, id));
      if (error) return null;
      return data ?? null;
    },
  };
}
