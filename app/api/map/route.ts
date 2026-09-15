import { env } from 'cloudflare:workers';
import { getAccessContext, type AccessPermissions } from '@/app/access-control';

type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; run: () => Promise<{ meta?: { changes?: number } }> };
type Database = { prepare: (sql: string) => Statement };
type StoredRow = { revision: number; data: string; updated_at: string };
let memoryState: { revision: number; data: unknown; updatedAt: string } | null = null;
const getDatabase = () => (env as unknown as { DB?: Database }).DB;
const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const accessVariant = (access: AccessPermissions) => [access.canViewDetails, access.canViewTopics, access.canViewSpaces, access.canViewFlows].map(Number).join('');
const mapEtag = (revision: number, access: AccessPermissions) => `"map-${revision}-${accessVariant(access)}"`;
const etagMatches = (request: Request, etag: string) => request.headers.get('if-none-match')?.split(',').some((candidate) => candidate.trim().replace(/^W\//, '') === etag) ?? false;
const mapJson = (body: unknown, revision: number, access: AccessPermissions, status = 200) => json(body, status, { etag: mapEtag(revision, access) });
const redactMapData = (value: unknown, access: AccessPermissions): unknown => {
  if (!value || typeof value !== 'object') return value;
  const data = value as { systemName?: unknown; versions?: unknown[] };
  const redactModule = (candidate: unknown): unknown => {
    if (!candidate || typeof candidate !== 'object') return candidate;
    const module = candidate as Record<string, unknown>;
    return { ...module, summary: access.canViewDetails ? module.summary : '', spaces: access.canViewSpaces && Array.isArray(module.spaces) ? module.spaces : [], topics: access.canViewTopics && Array.isArray(module.topics) ? module.topics : [], children: Array.isArray(module.children) ? module.children.map(redactModule) : [] };
  };
  return { ...data, versions: Array.isArray(data.versions) ? data.versions.map((candidate) => { const version = candidate as Record<string, unknown>; return { ...version, description: access.canViewDetails ? version.description : '', flows: access.canViewFlows && Array.isArray(version.flows) ? version.flows : [], modules: Array.isArray(version.modules) ? version.modules.map(redactModule) : [] }; }) : [] };
};

export async function GET(request: Request) {
  const access = await getAccessContext();
  const database = getDatabase();
  if (database) try {
    const row = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>();
    const revision = row?.revision ?? 0; const etag = mapEtag(revision, access);
    if (etagMatches(request, etag)) return new Response(null, { status: 304, headers: { etag, 'cache-control': 'private, no-cache' } });
    return mapJson({ data: row ? redactMapData(JSON.parse(row.data), access) : null, revision, updatedAt: row?.updated_at ?? null, mode: 'shared' }, revision, access);
  } catch { /* Fresh local previews can run before the migration. */ }
  const revision = memoryState?.revision ?? 0; const etag = mapEtag(revision, access);
  if (etagMatches(request, etag)) return new Response(null, { status: 304, headers: { etag, 'cache-control': 'private, no-cache' } });
  return mapJson({ data: redactMapData(memoryState?.data ?? null, access), revision, updatedAt: memoryState?.updatedAt ?? null, mode: 'memory' }, revision, access);
}

export async function PUT(request: Request) {
  const access = await getAccessContext();
  if (!access.canEdit) return json({ error: '你的帳號目前沒有編輯權限。' }, 403);
  let body: { data?: unknown; revision?: unknown };
  try { body = await request.json() as { data?: unknown; revision?: unknown }; } catch { return json({ error: '資料格式不正確。' }, 400); }
  if (!body.data || typeof body.data !== 'object' || !Number.isInteger(body.revision)) return json({ error: '需要 data 與 revision。' }, 400);
  const serialized = JSON.stringify(body.data); if (serialized.length > 500_000) return json({ error: '系統地圖內容超過 500 KB。' }, 413);
  const expectedRevision = Number(body.revision); const updatedAt = new Date().toISOString(); const database = getDatabase();
  if (database) try {
    const current = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>();
    if (current && current.revision !== expectedRevision) return mapJson({ data: redactMapData(JSON.parse(current.data), access), revision: current.revision, updatedAt: current.updated_at, mode: 'shared' }, current.revision, access, 409);
    const nextRevision = (current?.revision ?? 0) + 1;
    if (current) { const result = await database.prepare('UPDATE system_map_state SET revision = ?, data = ?, updated_at = ? WHERE id = 1 AND revision = ?').bind(nextRevision, serialized, updatedAt, expectedRevision).run(); if (!result.meta?.changes) { const latest = await database.prepare('SELECT revision, data, updated_at FROM system_map_state WHERE id = 1').first<StoredRow>(); const latestRevision = latest?.revision ?? 0; return mapJson({ data: redactMapData(latest ? JSON.parse(latest.data) : null, access), revision: latestRevision, updatedAt: latest?.updated_at ?? null, mode: 'shared' }, latestRevision, access, 409); } }
    else await database.prepare('INSERT INTO system_map_state (id, revision, data, updated_at) VALUES (1, ?, ?, ?)').bind(nextRevision, serialized, updatedAt).run();
    return mapJson({ revision: nextRevision, updatedAt, mode: 'shared' }, nextRevision, access);
  } catch { /* Use the local fallback if D1 is not ready. */ }
  if (memoryState && memoryState.revision !== expectedRevision) return mapJson({ data: redactMapData(memoryState.data, access), revision: memoryState.revision, updatedAt: memoryState.updatedAt, mode: 'memory' }, memoryState.revision, access, 409);
  memoryState = { revision: (memoryState?.revision ?? 0) + 1, data: body.data, updatedAt };
  return mapJson({ revision: memoryState.revision, updatedAt, mode: 'memory' }, memoryState.revision, access);
}
