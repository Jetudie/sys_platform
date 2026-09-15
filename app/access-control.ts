import { env } from 'cloudflare:workers';
import { getChatGPTUser, type ChatGPTUser } from './chatgpt-auth';

export type AccessRole = 'unassigned' | 'viewer' | 'editor' | 'admin';
export type AccessPermissions = {
  canViewDetails: boolean;
  canViewTopics: boolean;
  canViewSpaces: boolean;
  canViewFlows: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
};
export type AccessContext = AccessPermissions & {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  displayName: string;
  role: AccessRole | 'guest';
};
export type AccessMember = AccessPermissions & {
  email: string;
  displayName: string;
  role: Exclude<AccessRole, 'unassigned'>;
  createdAt: string;
  updatedAt: string;
};

type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results?: T[] }>; run: () => Promise<{ meta?: { changes?: number } }> };
type Database = { prepare: (sql: string) => Statement };
type MemberRow = { email: string; user_id: string | null; display_name: string | null; role: string; view_details: number; view_topics: number; view_spaces: number; view_flows: number; can_edit: number; created_at: string; updated_at: string };

const guestPermissions: AccessPermissions = { canViewDetails: false, canViewTopics: false, canViewSpaces: false, canViewFlows: false, canEdit: false, canManageAccess: false };
const localMembers = new Map<string, MemberRow>();
const getDatabase = () => (env as unknown as { DB?: Database }).DB;
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isRole = (value: unknown): value is AccessMember['role'] => value === 'viewer' || value === 'editor' || value === 'admin';
const bool = (value: unknown) => value === true || value === 1;
const permissionsFor = (row: MemberRow): AccessPermissions => row.role === 'admin'
  ? { canViewDetails: true, canViewTopics: true, canViewSpaces: true, canViewFlows: true, canEdit: true, canManageAccess: true }
  : { canViewDetails: bool(row.view_details), canViewTopics: bool(row.view_topics), canViewSpaces: bool(row.view_spaces), canViewFlows: bool(row.view_flows), canEdit: row.role === 'editor' && bool(row.can_edit) && bool(row.view_details) && bool(row.view_topics) && bool(row.view_spaces) && bool(row.view_flows), canManageAccess: false };
const memberFromRow = (row: MemberRow): AccessMember => ({ email: row.email, displayName: row.display_name || row.email, role: isRole(row.role) ? row.role : 'viewer', ...permissionsFor(row), createdAt: row.created_at, updatedAt: row.updated_at });

async function ensureFirstAdmin(user: ChatGPTUser, database?: Database) {
  const email = normalizeEmail(user.email); const now = new Date().toISOString();
  if (database) {
    await database.prepare(`INSERT INTO access_members (email, user_id, display_name, role, view_details, view_topics, view_spaces, view_flows, can_edit, created_at, updated_at)
      SELECT ?, ?, ?, 'admin', 1, 1, 1, 1, 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM access_members)`)
      .bind(email, user.userId, user.displayName, now, now).run();
    await database.prepare('UPDATE access_members SET user_id = ?, display_name = ?, updated_at = ? WHERE email = ?')
      .bind(user.userId, user.displayName, now, email).run();
    return;
  }
  if (!localMembers.size) localMembers.set(email, { email, user_id: user.userId, display_name: user.displayName, role: 'admin', view_details: 1, view_topics: 1, view_spaces: 1, view_flows: 1, can_edit: 1, created_at: now, updated_at: now });
  const row = localMembers.get(email); if (row) localMembers.set(email, { ...row, user_id: user.userId, display_name: user.displayName, updated_at: now });
}

async function findMember(email: string, database?: Database): Promise<MemberRow | null> {
  if (database) return database.prepare('SELECT * FROM access_members WHERE email = ?').bind(email).first<MemberRow>();
  return localMembers.get(email) ?? null;
}

export async function getAccessContext(): Promise<AccessContext> {
  const user = await getChatGPTUser();
  if (!user) return { authenticated: false, userId: null, email: null, displayName: '訪客', role: 'guest', ...guestPermissions };
  const database = getDatabase();
  try { await ensureFirstAdmin(user, database); } catch { await ensureFirstAdmin(user); }
  let row: MemberRow | null = null;
  try { row = await findMember(normalizeEmail(user.email), database); } catch { row = await findMember(normalizeEmail(user.email)); }
  if (!row) return { authenticated: true, userId: user.userId, email: user.email, displayName: user.displayName, role: 'unassigned', ...guestPermissions };
  return { authenticated: true, userId: user.userId, email: user.email, displayName: user.displayName, role: isRole(row.role) ? row.role : 'viewer', ...permissionsFor(row) };
}

export async function listAccessMembers(): Promise<AccessMember[]> {
  const database = getDatabase();
  if (database) { const result = await database.prepare('SELECT * FROM access_members ORDER BY CASE role WHEN \'admin\' THEN 0 WHEN \'editor\' THEN 1 ELSE 2 END, email').all<MemberRow>(); return (result.results ?? []).map(memberFromRow); }
  return [...localMembers.values()].sort((a, b) => a.email.localeCompare(b.email)).map(memberFromRow);
}

export async function saveAccessMember(input: { email: string; role: AccessMember['role']; displayName?: string; canViewDetails?: boolean; canViewTopics?: boolean; canViewSpaces?: boolean; canViewFlows?: boolean; canEdit?: boolean }): Promise<AccessMember> {
  const email = normalizeEmail(input.email); if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('請輸入有效的電子郵件。'); if (!isRole(input.role)) throw new Error('權限角色不正確。');
  const existing = await findMember(email, getDatabase()).catch(() => findMember(email)); const now = new Date().toISOString(); const createdAt = existing?.created_at ?? now; const admin = input.role === 'admin';
  const row: MemberRow = { email, user_id: existing?.user_id ?? null, display_name: input.displayName?.trim() || existing?.display_name || email, role: input.role, view_details: admin || input.canViewDetails ? 1 : 0, view_topics: admin || input.canViewTopics ? 1 : 0, view_spaces: admin || input.canViewSpaces ? 1 : 0, view_flows: admin || input.canViewFlows ? 1 : 0, can_edit: admin || input.role === 'editor' && input.canEdit ? 1 : 0, created_at: createdAt, updated_at: now };
  const database = getDatabase();
  if (database) await database.prepare(`INSERT INTO access_members (email, user_id, display_name, role, view_details, view_topics, view_spaces, view_flows, can_edit, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, role = excluded.role, view_details = excluded.view_details, view_topics = excluded.view_topics, view_spaces = excluded.view_spaces, view_flows = excluded.view_flows, can_edit = excluded.can_edit, updated_at = excluded.updated_at`)
    .bind(row.email, row.user_id, row.display_name, row.role, row.view_details, row.view_topics, row.view_spaces, row.view_flows, row.can_edit, row.created_at, row.updated_at).run();
  else localMembers.set(email, row);
  return memberFromRow(row);
}

export async function removeAccessMember(emailValue: string, currentEmail: string) {
  const email = normalizeEmail(emailValue); if (email === normalizeEmail(currentEmail)) throw new Error('不能移除自己的管理員權限。');
  const members = await listAccessMembers(); const target = members.find((member) => member.email === email); if (!target) return;
  if (target.role === 'admin' && members.filter((member) => member.role === 'admin').length <= 1) throw new Error('至少需要保留一位管理員。');
  const database = getDatabase(); if (database) await database.prepare('DELETE FROM access_members WHERE email = ?').bind(email).run(); else localMembers.delete(email);
}
