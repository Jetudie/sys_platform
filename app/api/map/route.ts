import { env } from 'cloudflare:workers';

type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; run: () => Promise<{ meta?: { changes?: number } }> };
type Database = { prepare: (sql: string) => Statement };
type StoredRow = { revision: number; data: string; updated_at: string };
let memoryState: { revision: number; data: unknown; updatedAt: string } | null = null;
const getDatabase = () => (env as unknown as { DB?: Database }).DB;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  const database = getDatabase();
  if (database) try { const row = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>(); if (row) return json({ data: JSON.parse(row.data), revision: row.revision, updatedAt: row.updated_at, mode: 'shared' }); return json({ data: null, revision: 0, updatedAt: null, mode: 'shared' }); } catch { /* Fresh local previews can run before the migration. */ }
  return json({ data: memoryState?.data ?? null, revision: memoryState?.revision ?? 0, updatedAt: memoryState?.updatedAt ?? null, mode: 'memory' });
}

export async function PUT(request: Request) {
  let body: { data?: unknown; revision?: unknown };
  try { body = await request.json() as { data?: unknown; revision?: unknown }; } catch { return json({ error: '資料格式不正確。' }, 400); }
  if (!body.data || typeof body.data !== 'object' || !Number.isInteger(body.revision)) return json({ error: '需要 data 與 revision。' }, 400);
  const serialized = JSON.stringify(body.data); if (serialized.length > 500_000) return json({ error: '系統地圖內容超過 500 KB。' }, 413);
  const expectedRevision = Number(body.revision); const updatedAt = new Date().toISOString(); const database = getDatabase();
  if (database) try {
    const current = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>();
    if (current && current.revision !== expectedRevision) return json({ data: JSON.parse(current.data), revision: current.revision, updatedAt: current.updated_at, mode: 'shared' }, 409);
    const nextRevision = (current?.revision ?? 0) + 1;
    if (current) { const result = await database.prepare('UPDATE system_map_state SET revision = ?, data = ?, updated_at = ? WHERE id = 1 AND revision = ?').bind(nextRevision, serialized, updatedAt, expectedRevision).run(); if (!result.meta?.changes) { const latest = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>(); return json({ data: latest ? JSON.parse(latest.data) : null, revision: latest?.revision ?? 0, updatedAt: latest?.updated_at ?? null, mode: 'shared' }, 409); } }
    else await database.prepare('INSERT INTO system_map_state (id, revision, data, updated_at) VALUES (1, ?, ?, ?)').bind(nextRevision, serialized, updatedAt).run();
    return json({ revision: nextRevision, updatedAt, mode: 'shared' });
  } catch { /* Use the local fallback if D1 is not ready. */ }
  if (memoryState && memoryState.revision !== expectedRevision) return json({ data: memoryState.data, revision: memoryState.revision, updatedAt: memoryState.updatedAt, mode: 'memory' }, 409);
  memoryState = { revision: (memoryState?.revision ?? 0) + 1, data: body.data, updatedAt };
  return json({ revision: memoryState.revision, updatedAt, mode: 'memory' });
}
