/**
 * The only module that knows the Company List lives in Supabase.
 *
 * Mirrors data/applications.ts: the app speaks in `Company`, this file speaks
 * in snake_case rows, and row-level security scopes everything to the user.
 */

import { requireSupabase } from '../lib/supabase';

const TABLE = 'companies';
const COLUMNS = 'id,name,notes,reached_out,scheduled_on,created_at';

export type Company = {
  id: string;
  name: string;
  notes: string;
  /** Whether you've reached out yet. */
  reachedOut: boolean;
  /** ISO date (YYYY-MM-DD) you scheduled something, or '' for none. */
  scheduledOn: string;
  /** Epoch ms, set by the database on insert. Orders the list, newest first. */
  createdAt: number;
};

/** The user-editable half of a Company, for update patches. */
export type CompanyPatch = Partial<Pick<Company, 'name' | 'notes' | 'reachedOut' | 'scheduledOn'>>;

type Row = {
  id: string;
  name: string;
  notes: string;
  reached_out: boolean;
  scheduled_on: string | null;
  created_at: string;
};

function toCompany(row: Row): Company {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? '',
    reachedOut: row.reached_out ?? false,
    scheduledOn: row.scheduled_on ?? '',
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

/** Translate a patch to database columns; an empty ISO date clears the column. */
function toRow(patch: CompanyPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.reachedOut !== undefined) row.reached_out = patch.reachedOut;
  if (patch.scheduledOn !== undefined) row.scheduled_on = patch.scheduledOn || null;
  return row;
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .select(COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Row[]).map(toCompany);
}

export async function createCompany(name: string, notes: string, userId: string): Promise<Company> {
  const { data, error } = await requireSupabase()
    .from(TABLE)
    .insert({ name, notes, user_id: userId })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return toCompany(data as unknown as Row);
}

export async function updateCompany(id: string, patch: CompanyPatch): Promise<void> {
  const row = toRow(patch);
  if (!Object.keys(row).length) return;
  const { error } = await requireSupabase().from(TABLE).update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await requireSupabase().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
