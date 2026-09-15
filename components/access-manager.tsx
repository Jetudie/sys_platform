'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, GitBranch, Layers3, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type Role = 'viewer' | 'editor' | 'admin';
type Member = { email: string; displayName: string; role: Role; canViewDetails: boolean; canViewTopics: boolean; canViewSpaces: boolean; canViewFlows: boolean; canEdit: boolean; canManageAccess: boolean; createdAt: string; updatedAt: string };

const roleLabel: Record<Role, string> = { viewer: '檢視者', editor: '編輯者', admin: '管理員' };
const permissionRows = [
  ['canViewDetails', Eye, '模組說明', '責任說明與版本說明'],
  ['canViewTopics', FileText, '討論內容', '討論標題、內容與狀態'],
  ['canViewSpaces', Layers3, '暫存資訊', '實例、容量與資料筆數'],
  ['canViewFlows', GitBranch, '資料流', '節點關係與傳遞內容'],
  ['canEdit', Pencil, '編輯資料', '需要同時開放以上全部資訊'],
] as const;

export function AccessManager({ open, onOpenChange, currentEmail }: { open: boolean; onOpenChange: (open: boolean) => void; currentEmail: string }) {
  const [members, setMembers] = useState<Member[]>([]); const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('viewer'); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await fetch('/api/access', { cache: 'no-store' }); const payload = await response.json() as { members?: Member[]; error?: string }; if (!response.ok) throw new Error(payload.error); setMembers(payload.members ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : '無法讀取帳號權限。'); } finally { setLoading(false); } }, []);
  useEffect(() => { if (open) void load(); }, [load, open]);

  const save = async (member: Member) => {
    setError('');
    try { const response = await fetch('/api/access', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(member) }); const payload = await response.json() as { member?: Member; error?: string }; if (!response.ok || !payload.member) throw new Error(payload.error); setMembers((current) => current.some((item) => item.email === payload.member!.email) ? current.map((item) => item.email === payload.member!.email ? payload.member! : item) : [...current, payload.member!]); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : '無法儲存帳號權限。'); return false; }
  };
  const addMember = async () => {
    const views = role === 'viewer' ? { canViewDetails: true, canViewTopics: false, canViewSpaces: false, canViewFlows: true, canEdit: false } : { canViewDetails: true, canViewTopics: true, canViewSpaces: true, canViewFlows: true, canEdit: role === 'editor' };
    if (await save({ email, displayName: email, role, canManageAccess: role === 'admin', createdAt: '', updatedAt: '', ...views })) { setEmail(''); setRole('viewer'); }
  };
  const updateMember = (member: Member, patch: Partial<Member>) => {
    let next = { ...member, ...patch };
    if (patch.role === 'admin') next = { ...next, canViewDetails: true, canViewTopics: true, canViewSpaces: true, canViewFlows: true, canEdit: true, canManageAccess: true };
    if (patch.role === 'editor') next = { ...next, canViewDetails: true, canViewTopics: true, canViewSpaces: true, canViewFlows: true, canEdit: true, canManageAccess: false };
    if (patch.role === 'viewer') next = { ...next, canEdit: false, canManageAccess: false };
    if (patch.canViewDetails === false || patch.canViewTopics === false || patch.canViewSpaces === false || patch.canViewFlows === false) next.canEdit = false;
    void save(next);
  };
  const remove = async (member: Member) => { const response = await fetch('/api/access', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: member.email }) }); const payload = await response.json() as { error?: string }; if (!response.ok) { setError(payload.error ?? '無法移除帳號權限。'); return; } setMembers((current) => current.filter((item) => item.email !== member.email)); };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="access-dialog"><DialogHeader><DialogTitle>帳號與權限</DialogTitle><DialogDescription>用 Email 預先授權。對方以同一個 ChatGPT 帳號登入後，就會套用這裡的設定。</DialogDescription></DialogHeader>
    <div className="access-add"><label><span>電子郵件</span><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label><label><span>角色</span><Select value={role} onValueChange={(value) => value && setRole(value as Role)}><SelectTrigger aria-label="新帳號角色"><SelectValue>{roleLabel[role]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="viewer">檢視者</SelectItem><SelectItem value="editor">編輯者</SelectItem><SelectItem value="admin">管理員</SelectItem></SelectContent></Select></label><Button type="button" onClick={() => void addMember()} disabled={!email.trim()}><Plus />新增帳號</Button></div>
    {error ? <p className="access-error" role="alert">{error}</p> : null}
    <div className="access-list">{loading ? <div className="access-empty">正在讀取權限…</div> : members.map((member) => <article className="access-member" key={member.email}><div className="access-member-head"><span className="member-avatar"><Users /></span><span><strong>{member.displayName}</strong><small>{member.email}</small></span><Select value={member.role} disabled={member.email === currentEmail} onValueChange={(value) => value && updateMember(member, { role: value as Role })}><SelectTrigger aria-label={`設定 ${member.email} 的角色`}><SelectValue>{roleLabel[member.role]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="viewer">檢視者</SelectItem><SelectItem value="editor">編輯者</SelectItem><SelectItem value="admin">管理員</SelectItem></SelectContent></Select><AlertDialog><AlertDialogTrigger disabled={member.email === currentEmail} render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`移除 ${member.email}`} />}><Trash2 /></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>移除 {member.email}？</AlertDialogTitle><AlertDialogDescription>這個帳號之後只能看到訪客可見的公開資訊。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void remove(member)}>移除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
      <div className="permission-grid">{permissionRows.map(([key, Icon, label, description]) => <label key={key} className={key === 'canEdit' ? 'edit-permission' : ''}><span><Icon /><span><strong>{label}</strong><small>{description}</small></span></span><Switch checked={member[key]} disabled={member.role === 'admin' || key === 'canEdit' && member.role !== 'editor'} onCheckedChange={(checked) => updateMember(member, { [key]: checked })} aria-label={`設定 ${member.email} 的${label}權限`} /></label>)}</div>
    </article>)}{!loading && !members.length ? <div className="access-empty"><ShieldCheck />尚未建立帳號權限</div> : null}</div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>完成</Button></DialogFooter>
  </DialogContent></Dialog>;
}
