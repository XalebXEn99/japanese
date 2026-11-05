import { neon } from '@neondatabase/serverless';
import { progressSchema, type Progress } from '../shared/progress.js';

export interface ProgressSnapshot {
  progress: Progress | null;
  revision: number;
}

export interface ProgressStore {
  get(subject: string): Promise<ProgressSnapshot>;
  put(subject: string, progress: Progress, revision: number): Promise<{ saved: boolean; snapshot: ProgressSnapshot }>;
}

export function createProgressStore(databaseUrl: string): ProgressStore {
  const sql = neon(databaseUrl);
  const snapshot = (row: Record<string, unknown> | undefined): ProgressSnapshot =>
    row ? { progress: progressSchema.parse(row.progress), revision: Number(row.revision) } : { progress: null, revision: 0 };
  const get = async (subject: string) => {
    const rows = await sql`SELECT progress, revision FROM app_progress WHERE user_id = ${subject}`;
    return snapshot(rows[0]);
  };
  return {
    get,
    async put(subject, progress, revision) {
      // Creation and updates both compare atomically; an absent row only accepts revision zero.
      const rows = revision === 0
        ? await sql`
            INSERT INTO app_progress (user_id, progress, revision)
            VALUES (${subject}, ${JSON.stringify(progress)}::jsonb, 1)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING progress, revision`
        : await sql`
            UPDATE app_progress
            SET progress = ${JSON.stringify(progress)}::jsonb, revision = revision + 1, updated_at = now()
            WHERE user_id = ${subject} AND revision = ${revision}
            RETURNING progress, revision`;
      return rows.length
        ? { saved: true, snapshot: snapshot(rows[0]) }
        : { saved: false, snapshot: await get(subject) };
    },
  };
}
