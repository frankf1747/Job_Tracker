/**
 * The only module that knows the Company List lives in Supabase.
 *
 * Mirrors data/applications.ts: the app speaks in `Company`, this file speaks
 * in snake_case rows, and row-level security scopes everything to the user.
 */

import { requireSupabase } from '../lib/supabase';

const TABLE = 'companies';
const COLUMNS = 'id,name,notes,created_at';

export type Company = {
  id: string;
  name: string;
  notes: string;
  /** Epoch ms, set by the database on insert. Orders the list, newest first. */
  createdAt: number;
};

type Row = {
  id: string;
  name: string;
  notes: string;
  created_at: string;
};

function toCompany(row: Row): Company {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? '',
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
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

export async function updateCompany(
  id: string,
  patch: Partial<Pick<Company, 'name' | 'notes'>>,
): Promise<void> {
  if (patch.name === undefined && patch.notes === undefined) return;
  const { error } = await requireSupabase().from(TABLE).update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await requireSupabase().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
