import { getAccessContext, listAccessMembers, removeAccessMember, saveAccessMember, type AccessMember } from '@/app/access-control';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function GET() {
  const access = await getAccessContext();
  if (!access.canManageAccess) return json({ error: '只有管理員可以查看帳號權限。' }, 403);
  try { return json({ members: await listAccessMembers() }); } catch { return json({ error: '目前無法讀取帳號權限。' }, 503); }
}

export async function PUT(request: Request) {
  const access = await getAccessContext();
  if (!access.canManageAccess) return json({ error: '只有管理員可以設定帳號權限。' }, 403);
  let body: Partial<AccessMember>;
  try { body = await request.json() as Partial<AccessMember>; } catch { return json({ error: '資料格式不正確。' }, 400); }
  if (body.email?.trim().toLowerCase() === access.email?.trim().toLowerCase() && body.role !== 'admin') return json({ error: '不能變更自己的管理員角色。' }, 400);
  try {
    const member = await saveAccessMember({
      email: body.email ?? '', role: body.role === 'admin' || body.role === 'editor' || body.role === 'viewer' ? body.role : 'viewer', displayName: body.displayName,
      canViewDetails: body.canViewDetails, canViewTopics: body.canViewTopics, canViewSpaces: body.canViewSpaces, canViewFlows: body.canViewFlows, canEdit: body.canEdit,
    });
    return json({ member });
  } catch (error) { return json({ error: error instanceof Error ? error.message : '無法儲存帳號權限。' }, 400); }
}

export async function DELETE(request: Request) {
  const access = await getAccessContext();
  if (!access.canManageAccess || !access.email) return json({ error: '只有管理員可以移除帳號權限。' }, 403);
  let body: { email?: string };
  try { body = await request.json() as { email?: string }; } catch { return json({ error: '資料格式不正確。' }, 400); }
  try { await removeAccessMember(body.email ?? '', access.email); return json({ ok: true }); }
  catch (error) { return json({ error: error instanceof Error ? error.message : '無法移除帳號權限。' }, 400); }
}
