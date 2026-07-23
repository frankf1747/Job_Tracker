/**
 * The only module that knows applications live in Supabase.
 *
 * Everything above this speaks in `Application`; everything below speaks in
 * snake_case rows. Keeping the translation in one place is what lets the rest
 * of the app stay ignorant of the database.
 */

import { requireSupabase } from '../lib/supabase';
import { normalizeLoc } from '../lib/locations';
import type { Application, Status } from '../lib/schema';

const TABLE = 'applications';

/** Shape as stored. Mirrors supabase/migrations/20260722000000_initial_schema.sql. */
type Row = {
  id: string;
  user_id: string;
  company: string;
  position: string;
  industry: string;
  level: string;
  employment_type: string;
  salary: string;
  status: Status;
  reached: number;
  location_raw: string;
  lat: number | null;
  lng: number | null;
  applied_on: string;
  resume: string;
  notes: string;
  source_url: string;
  skills: string[];
  created_at: string;
};

/** Columns selected everywhere, so list and write paths cannot drift apart. */
const COLUMNS =
  'id,company,position,industry,level,employment_type,salary,status,reached,location_raw,lat,lng,applied_on,resume,notes,source_url,skills,created_at';

export function toApplication(row: Row): Application {
  const loc = normalizeLoc(row.location_raw);
  return {
    id: row.id,
    company: row.company,
    position: row.position,
    industry: row.industry,
    level: row.level,
    employmentType: row.employment_type,
    salary: row.salary,
    skills: row.skills ?? [],
    status: row.status,
    reached: row.reached,
    location: row.location_raw,
    // Stored coordinates win when the built-in city table doesn't know the place.
    loc:
      loc.lat == null && row.lat != null && row.lng != null
        ? { ...loc, lat: row.lat, lng: row.lng }
        : loc,
    applied: row.applied_on,
    appliedTs: Date.parse(row.applied_on + 'T00:00'),
    // Written by the database, so it is UTC; Date.parse keeps the instant and
    // the UI reads local hours off it, which is the "hour of my day" we want.
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.parse(row.applied_on + 'T00:00'),
    resume: row.resume,
    notes: row.notes,
    sourceUrl: row.source_url,
  };
}

/** The writable half of an Application, as database columns. */
function toRow(app: Partial<Application>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (app.company !== undefined) row.company = app.company;
  if (app.position !== undefined) row.position = app.position;
  if (app.industry !== undefined) row.industry = app.industry;
  if (app.level !== undefined) row.level = app.level;
  if (app.employmentType !== undefined) row.employment_type = app.employmentType;
  if (app.salary !== undefined) row.salary = app.salary;
  if (app.status !== undefined) row.status = app.status;
  if (app.reached !== undefined) row.reached = app.reached;
  if (app.location !== undefined) row.location_raw = app.location;
  if (app.applied !== undefined) row.applied_on = app.applied;
  if (app.resume !== undefined) row.resume = app.resume;
  if (app.notes !== undefined) row.notes = app.notes;
  if (app.sourceUrl !== undefined) row.source_url = app.sourceUrl;
  if (app.skills !== undefined) row.skills = app.skills;
  return row;
}

/**
 * Every application for the signed-in user.
 *
 * No pagination: the whole set is filtered, sorted, and aggregated client-side,
 * and at a few hundred rows one round trip beats many.
 */
export async function listApplications(): Promise<Application[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .order('applied_on', { ascending: false });

  if (error) throw error;
  return (data as unknown as Row[]).map(toApplication);
}

/**
 * `createdAt` is omitted: the database stamps it with `now()` on insert, and
 * the inserted row is read back, so the client never guesses the time.
 */
export async function createApplication(
  app: Omit<Application, 'id' | 'loc' | 'appliedTs' | 'createdAt'>,
  userId: string,
): Promise<Application> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .insert({ ...toRow(app), user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return toApplication(data as unknown as Row);
}

export async function updateApplication(id: string, patch: Partial<Application>): Promise<void> {
  const row = toRow(patch);
  // A patch of only derived fields would otherwise issue an empty UPDATE.
  if (!Object.keys(row).length) return;

  const { error } = await requireSupabase().from(TABLE).update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await requireSupabase().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
