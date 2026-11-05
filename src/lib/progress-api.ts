import { z } from 'zod';
import { progressSchema, type Progress } from '../../shared/progress';
import { accessToken } from './auth';

const rowSchema = z.object({ progress: progressSchema, revision: z.number().int().positive() });
const rowsSchema = z.array(rowSchema).max(1);
export interface RemoteProgress { progress: Progress | null; revision: number }
interface ProgressWrite { progress: Progress; revision: number }

export async function requestProgress(method: 'GET' | 'PUT', body?: ProgressWrite): Promise<{ status: number; data: RemoteProgress }> {
  const endpoint = import.meta.env.VITE_NEON_DATA_API_URL?.replace(/\/$/, '');
  if (!endpoint || !endpoint.startsWith('https://')) throw new Error('Cloud sync is not configured. Set VITE_NEON_DATA_API_URL to the public Neon Data API URL.');
  const token = await accessToken();
  const table = new URL(`${endpoint}/app_progress`);
  table.searchParams.set('select', 'progress,revision');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const readRows = async (response: Response) => {
    if (!response.ok) throw new Error(`Account sync failed (${response.status}). ${(await response.text()).slice(0, 180)}`);
    const parsed = rowsSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Neon returned invalid account progress.');
    return parsed.data;
  };
  const read = async (): Promise<RemoteProgress> => {
    const response = await fetch(table, { headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const rows = await readRows(response);
    return rows[0] ?? { progress: null, revision: 0 };
  };
  if (method === 'GET') return { status: 200, data: await read() };
  if (!body) throw new Error('A progress snapshot and revision are required.');
  const revision = z.number().int().min(0).max(2147483646).parse(body.revision);
  const progress = progressSchema.parse(body.progress);
  const writeUrl = new URL(table);
  if (revision) writeUrl.searchParams.set('revision', `eq.${revision}`);
  else writeUrl.searchParams.set('on_conflict', 'user_id');
  const response = await fetch(writeUrl, {
    method: revision ? 'PATCH' : 'POST',
    headers: {
      ...headers, 'Content-Type': 'application/json',
      Prefer: revision ? 'return=representation' : 'return=representation,resolution=ignore-duplicates',
    },
    body: JSON.stringify({ progress, revision: revision + 1 }),
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (response.status === 409) return { status: 409, data: await read() };
  const rows = await readRows(response);
  return rows[0] ? { status: 200, data: rows[0] } : { status: 409, data: await read() };
}
