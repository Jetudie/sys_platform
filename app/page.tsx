'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronRight, CircleDot, Clock3, Code2, Database, Download, FileJson, FileText, GitBranch, Layers3, LockKeyhole, LogIn, LogOut, MessageCircle, Plus, Search, Settings2, ShieldCheck, Trash2, Upload, UserRound, Waypoints } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AccessManager } from '@/components/access-manager';

type TopicStatus = 'draft' | 'discussion' | 'reviewed';
type ModuleHealth = 'healthy' | 'watch' | 'risk';
type Topic = { id: string; title: string; content: string; status: TopicStatus; updatedAt: string };
type TempSpace = { id: string; name: string; kind: string; detail: string; quantity?: number; instanceCounts?: number[] };
type DataFlow = { id: string; sourceId: string; targetId: string; label: string };
type FlowLayout = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
type SearchScope = 'all' | 'modules' | 'topics';
type SystemModule = { id: string; name: string; code: string; summary: string; health: ModuleHealth; color: string; spaces: TempSpace[]; topics: Topic[]; children?: SystemModule[] };
type SystemVersion = { id: string; label: string; release: string; state: '現行' | '候選' | '封存'; description: string; modules: SystemModule[]; flows?: DataFlow[] };
type SystemMapData = { systemName: string; versions: SystemVersion[] };
type AccessSession = { authenticated: boolean; userId: string | null; email: string | null; displayName: string; role: 'guest' | 'unassigned' | 'viewer' | 'editor' | 'admin'; canViewDetails: boolean; canViewTopics: boolean; canViewSpaces: boolean; canViewFlows: boolean; canEdit: boolean; canManageAccess: boolean; signInPath: string; signOutPath: string };
const guestAccess: AccessSession = { authenticated: false, userId: null, email: null, displayName: '訪客', role: 'guest', canViewDetails: false, canViewTopics: false, canViewSpaces: false, canViewFlows: false, canEdit: false, canManageAccess: false, signInPath: '/signin-with-chatgpt?return_to=%2F', signOutPath: '/signout-with-chatgpt?return_to=%2F' };
const accessRoleLabel: Record<AccessSession['role'], string> = { guest: '訪客', unassigned: '待授權', viewer: '檢視者', editor: '編輯者', admin: '管理員' };
const restrictMapForAccess = (data: SystemMapData, access: AccessSession): SystemMapData => ({ ...data, versions: data.versions.map((version) => ({ ...version, description: access.canViewDetails ? version.description : '', flows: access.canViewFlows ? version.flows : [], modules: version.modules.map(function restrictModule(module): SystemModule { return { ...module, summary: access.canViewDetails ? module.summary : '', topics: access.canViewTopics ? module.topics : [], spaces: access.canViewSpaces ? module.spaces : [], children: (module.children ?? []).map(restrictModule) }; }) })) });

const nowLabel = () => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const initialData: SystemMapData = {
  systemName: 'Atlas Commerce Platform',
  versions: [
    {
      id: 'v3-2', label: 'v3.2', release: '2026 Q3', state: '現行', description: '訂單流程拆分完成，快取責任回到各領域模組。',
      flows: [{ id: 'flow-gateway-order', sourceId: 'gateway', targetId: 'order', label: '建立訂單' }, { id: 'flow-order-payment', sourceId: 'order', targetId: 'payment', label: '付款授權' }, { id: 'flow-order-fulfillment', sourceId: 'order', targetId: 'fulfillment', label: '履約指令' }, { id: 'flow-gateway-catalog', sourceId: 'gateway', targetId: 'catalog', label: '商品查詢' }],
      modules: [
        { id: 'gateway', name: 'API Gateway', code: 'EDGE-01', health: 'healthy', color: '#63d8c7', summary: '統一入口，負責驗證、限流與請求路由。', spaces: [{ id: 'gw-session', name: 'Session Cache', kind: 'Redis', detail: 'TTL 30 min · 8.2 GB' }, { id: 'gw-rate', name: 'Rate Window', kind: 'Memory', detail: 'TTL 60 sec · 12 shards' }], topics: [{ id: 'gw-topic-1', title: '企業客戶限流例外', content: '需確認 partner tier 是否沿用獨立 quota。', status: 'discussion', updatedAt: '9/12 14:20' }, { id: 'gw-topic-2', title: 'JWT key rotation', content: '雙 key 過渡期已在 staging 驗證。', status: 'reviewed', updatedAt: '9/11 17:05' }], children: [{ id: 'auth-guard', name: '身分驗證器', code: 'EDGE-01-A', health: 'healthy', color: '#63d8c7', summary: '解析 access token 並提供一致的授權上下文。', spaces: [{ id: 'auth-key', name: 'Signing Keys', kind: 'LRU', detail: 'TTL 15 min' }], topics: [{ id: 'auth-topic-1', title: '服務帳號權限', content: '待整理跨服務 scope 對照表。', status: 'draft', updatedAt: '9/12 10:15' }], children: [{ id: 'claim-normalizer', name: 'Claim 正規化', code: 'EDGE-01-A-1', health: 'healthy', color: '#63d8c7', summary: '將不同 issuer 的 claims 轉為內部格式。', spaces: [{ id: 'claim-rules', name: 'Rule Snapshot', kind: 'Memory', detail: 'Versioned rules' }], topics: [] }] }] },
        { id: 'catalog', name: '商品目錄', code: 'CAT-07', health: 'healthy', color: '#6f9cff', summary: '提供商品、價格與可售狀態的統一查詢介面。', spaces: [{ id: 'cat-query', name: 'Query Cache', kind: 'Redis', detail: 'TTL 5 min · 22 GB' }, { id: 'cat-image', name: 'Image Metadata', kind: 'LRU', detail: '50k entries' }], topics: [{ id: 'cat-topic-1', title: '價格失效策略', content: '促銷價更新改為 event-driven invalidation。', status: 'reviewed', updatedAt: '9/10 10:40' }] },
        { id: 'order', name: '訂單核心', code: 'ORD-12', health: 'watch', color: '#ffbf69', summary: '管理購物車結帳後的訂單生命週期與狀態機。', spaces: [{ id: 'ord-draft', name: 'Draft Order', kind: 'Redis', detail: 'TTL 24 hr · 14 GB', quantity: 5, instanceCounts: [3, 0, 0, 9, 0] }, { id: 'ord-idem', name: 'Idempotency Keys', kind: 'KV', detail: 'TTL 48 hr' }, { id: 'ord-outbox', name: 'Event Outbox', kind: 'SQL', detail: '15 min rolling window' }], topics: [{ id: 'ord-topic-1', title: '跨區重送的冪等性', content: '需要補上切區期間的衝突案例與回復順序。', status: 'discussion', updatedAt: '9/12 16:42' }, { id: 'ord-topic-2', title: 'Outbox 清理批次', content: '目前尖峰時段延後 30 分鐘執行。', status: 'draft', updatedAt: '9/12 11:18' }] },
        { id: 'payment', name: '支付協調器', code: 'PAY-04', health: 'risk', color: '#ff7e79', summary: '協調授權、請款、退款與第三方支付狀態。', spaces: [{ id: 'pay-token', name: 'Token Vault Proxy', kind: 'Encrypted', detail: 'TTL 10 min' }, { id: 'pay-retry', name: 'Retry Queue', kind: 'Queue', detail: '1.3k pending' }], topics: [{ id: 'pay-topic-1', title: '重試佇列積壓', content: '供應商 B 的 429 增加；暫時將 backoff 上限調至 20 分鐘。', status: 'discussion', updatedAt: '9/12 17:02' }] },
        { id: 'fulfillment', name: '履約中心', code: 'FUL-09', health: 'healthy', color: '#b68cff', summary: '整合庫存保留、出貨批次與物流狀態。', spaces: [{ id: 'ful-stock', name: 'Stock Snapshot', kind: 'Redis', detail: 'TTL 90 sec · 18 GB' }, { id: 'ful-batch', name: 'Wave Buffer', kind: 'Memory', detail: '2k orders / wave' }], topics: [{ id: 'ful-topic-1', title: '缺貨補償流程', content: '客服與倉儲的責任邊界已確認。', status: 'reviewed', updatedAt: '9/9 09:30' }] },
      ],
    },
    {
      id: 'v3-3-rc', label: 'v3.3 RC', release: '2026 Q4', state: '候選', description: '加入風險引擎與區域化支付路由，正進行容量驗證。',
      flows: [{ id: 'flow-rc-gateway-order', sourceId: 'gateway-rc', targetId: 'order-rc', label: '訂單流量' }, { id: 'flow-rc-order-risk', sourceId: 'order-rc', targetId: 'risk-rc', label: '風險檢查' }, { id: 'flow-rc-risk-payment', sourceId: 'risk-rc', targetId: 'payment-rc', label: '付款放行' }],
      modules: [
        { id: 'gateway-rc', name: 'API Gateway', code: 'EDGE-02', health: 'healthy', color: '#63d8c7', summary: '新增區域感知路由與流量鏡像。', spaces: [{ id: 'gw-rc-session', name: 'Session Cache', kind: 'Redis', detail: 'Regional · TTL 30 min' }, { id: 'gw-rc-mirror', name: 'Traffic Mirror', kind: 'Buffer', detail: '5% sampled' }], topics: [{ id: 'gw-rc-t1', title: '鏡像流量的敏感欄位', content: '遮罩規則待資安 review。', status: 'discussion', updatedAt: '9/12 13:10' }] },
        { id: 'order-rc', name: '訂單核心', code: 'ORD-13', health: 'watch', color: '#ffbf69', summary: '狀態機改為 append-only event stream。', spaces: [{ id: 'ord-rc-state', name: 'State Projection', kind: 'Redis', detail: 'TTL 7 days' }, { id: 'ord-rc-outbox', name: 'Event Stream', kind: 'Kafka', detail: '12 partitions' }], topics: [{ id: 'ord-rc-t1', title: '回放時間目標', content: '百萬筆事件需在 8 分鐘內完成。', status: 'draft', updatedAt: '9/12 09:05' }] },
        { id: 'risk-rc', name: '風險引擎', code: 'RSK-01', health: 'risk', color: '#ff7e79', summary: '在付款前計算交易風險與阻擋策略。', spaces: [{ id: 'risk-feature', name: 'Feature Store', kind: 'Redis', detail: 'TTL 15 min · 31 GB' }, { id: 'risk-decision', name: 'Decision Cache', kind: 'KV', detail: 'TTL 6 hr' }], topics: [{ id: 'risk-rc-t1', title: '模型降級條件', content: '超過 180ms 時切換規則模式；門檻仍待壓測。', status: 'discussion', updatedAt: '9/12 16:30' }] },
        { id: 'payment-rc', name: '支付路由', code: 'PAY-05', health: 'watch', color: '#6f9cff', summary: '依區域、幣別與健康度選擇支付供應商。', spaces: [{ id: 'pay-rc-health', name: 'Provider Health', kind: 'Memory', detail: 'TTL 10 sec' }, { id: 'pay-rc-idem', name: 'Payment Keys', kind: 'KV', detail: 'TTL 72 hr' }], topics: [{ id: 'pay-rc-t1', title: '供應商切換觀測', content: '需要統一切換原因碼，供客服查詢。', status: 'draft', updatedAt: '9/11 15:22' }] },
      ],
    },
    {
      id: 'v2-8', label: 'v2.8', release: '2025 Q4', state: '封存', description: '單體訂單服務時期的基準版本，僅供事件追溯。',
      flows: [{ id: 'flow-legacy-web-commerce', sourceId: 'web-legacy', targetId: 'commerce-legacy', label: '商務請求' }, { id: 'flow-legacy-commerce-warehouse', sourceId: 'commerce-legacy', targetId: 'warehouse-legacy', label: '庫存批次' }],
      modules: [
        { id: 'web-legacy', name: 'Web API', code: 'WEB-08', health: 'healthy', color: '#63d8c7', summary: '舊版單一 API 入口。', spaces: [{ id: 'web-cache', name: 'Response Cache', kind: 'Redis', detail: 'TTL 10 min' }], topics: [{ id: 'web-t1', title: '封存範圍', content: '保留介面契約與事故記錄。', status: 'reviewed', updatedAt: '8/28 14:00' }] },
        { id: 'commerce-legacy', name: 'Commerce Monolith', code: 'MON-01', health: 'watch', color: '#ffbf69', summary: '商品、訂單與付款共用部署單元。', spaces: [{ id: 'mon-session', name: 'Shared Session', kind: 'Redis', detail: 'TTL 60 min' }, { id: 'mon-job', name: 'Job Buffer', kind: 'SQL', detail: 'Shared table' }, { id: 'mon-price', name: 'Price Cache', kind: 'Memory', detail: 'Local process' }], topics: [{ id: 'mon-t1', title: '歷史事故索引', content: '已連結 2025 年四次重大事故。', status: 'reviewed', updatedAt: '8/30 11:00' }] },
        { id: 'warehouse-legacy', name: 'Warehouse Bridge', code: 'WH-03', health: 'healthy', color: '#b68cff', summary: '批次同步庫存與出貨單。', spaces: [{ id: 'wh-stage', name: 'Staging Table', kind: 'SQL', detail: 'Nightly truncate' }], topics: [] },
      ],
    },
  ],
};

const topicMeta: Record<TopicStatus, { label: string; icon: typeof Clock3 }> = { draft: { label: '草稿', icon: Clock3 }, discussion: { label: '討論中', icon: MessageCircle }, reviewed: { label: '已 Review', icon: CheckCircle2 } };
const healthMeta: Record<ModuleHealth, { label: string; tone: string }> = { healthy: { label: '穩定', tone: 'ok' }, watch: { label: '留意', tone: 'watch' }, risk: { label: '風險', tone: 'risk' } };

const flattenModules = (modules: SystemModule[]): SystemModule[] => modules.flatMap((module) => [module, ...flattenModules(module.children ?? [])]);
const findModule = (modules: SystemModule[], id: string): SystemModule | undefined => {
  for (const module of modules) {
    if (module.id === id) return module;
    const nested = findModule(module.children ?? [], id);
    if (nested) return nested;
  }
};
const findModulePath = (modules: SystemModule[], id: string, path: SystemModule[] = []): SystemModule[] => {
  for (const module of modules) {
    const nextPath = [...path, module];
    if (module.id === id) return nextPath;
    const nested = findModulePath(module.children ?? [], id, nextPath);
    if (nested.length) return nested;
  }
  return [];
};
const updateModuleTree = (modules: SystemModule[], id: string, patch: Partial<SystemModule>): SystemModule[] => modules.map((module) => module.id === id ? { ...module, ...patch } : { ...module, children: updateModuleTree(module.children ?? [], id, patch) });
const removeModuleTree = (modules: SystemModule[], id: string): SystemModule[] => modules.filter((module) => module.id !== id).map((module) => ({ ...module, children: removeModuleTree(module.children ?? [], id) }));
const spaceQuantity = (space: TempSpace) => Math.max(1, Math.floor(Number(space.quantity ?? 1)) || 1);
const expandedSpaceNames = (space: TempSpace) => {
  const quantity = spaceQuantity(space);
  return Array.from({ length: quantity }, (_, index) => quantity === 1 ? space.name : `${space.name}${index + 1}`);
};
const instanceCount = (space: TempSpace, index: number) => Math.max(0, Math.floor(Number(space.instanceCounts?.[index] ?? 0)) || 0);
const moduleSpaceCount = (module: SystemModule) => module.spaces.reduce((sum, space) => sum + spaceQuantity(space), 0);
const ownRecordCount = (module: SystemModule) => module.spaces.reduce((total, space) => total + expandedSpaceNames(space).reduce((sum, _, index) => sum + instanceCount(space, index), 0), 0);
const moduleRecordCount = (module: SystemModule): number => module.spaces.reduce((sum, space) => sum + expandedSpaceNames(space).reduce((spaceSum, _, index) => spaceSum + instanceCount(space, index), 0), 0) + (module.children ?? []).reduce((sum, child) => sum + moduleRecordCount(child), 0);
const filterModuleTree = (modules: SystemModule[], query: string, healthFilter: 'all' | ModuleHealth, scope: SearchScope): SystemModule[] => modules.flatMap((module) => {
  const moduleText = `${module.name} ${module.code} ${module.summary} ${module.spaces.map((space) => `${space.name} ${expandedSpaceNames(space).join(' ')} ${space.kind} ${space.detail}`).join(' ')}`.toLowerCase();
  const topicText = module.topics.map((topic) => `${topic.title} ${topic.content} ${topicMeta[topic.status].label}`).join(' ').toLowerCase();
  const hasScopedContent = scope === 'modules' ? (!query || moduleText.includes(query)) : scope === 'topics' ? Boolean(module.topics.length) && (!query || topicText.includes(query)) : !query || `${moduleText} ${topicText}`.includes(query);
  const ownMatch = hasScopedContent && (healthFilter === 'all' || module.health === healthFilter);
  const children = filterModuleTree(module.children ?? [], query, healthFilter, scope);
  return ownMatch || children.length ? [{ ...module, children }] : [];
});

type SpaceEndpoint = { space: TempSpace; owner: SystemModule; path: SystemModule[] };
type FlowEndpoint = { id: string; type: 'module' | 'space'; name: string; code: string; path: string; recordCount: number; ownerId: string };

const flattenSpaceEndpoints = (modules: SystemModule[]): SpaceEndpoint[] => flattenModules(modules).flatMap((owner) => owner.spaces.map((space) => ({ space, owner, path: findModulePath(modules, owner.id) })));
const findSpaceEndpoint = (modules: SystemModule[], id: string) => flattenSpaceEndpoints(modules).find((entry) => entry.space.id === id);
const resolveFlowEndpoint = (modules: SystemModule[], id: string): FlowEndpoint | null => {
  const module = findModule(modules, id);
  if (module) return { id, type: 'module', name: module.name, code: module.code, path: modulePathLabel(modules, id), recordCount: moduleRecordCount(module), ownerId: module.id };
  const entry = findSpaceEndpoint(modules, id);
  if (!entry) return null;
  const total = expandedSpaceNames(entry.space).reduce((sum, _, index) => sum + instanceCount(entry.space, index), 0);
  return { id, type: 'space', name: entry.space.name, code: `${entry.space.kind} · ${spaceQuantity(entry.space)} 個實例`, path: `${entry.path.map((part) => part.name).join(' / ')} / ${entry.space.name}`, recordCount: total, ownerId: entry.owner.id };
};
const rootModuleIdForEndpoint = (modules: SystemModule[], id: string) => {
  const modulePath = findModulePath(modules, id);
  if (modulePath.length) return modulePath[0].id;
  return findSpaceEndpoint(modules, id)?.path[0]?.id ?? '';
};
const layoutMeta: Record<FlowLayout, { label: string; shortLabel: string; horizontal: boolean; reverse: boolean }> = {
  'left-to-right': { label: '從左到右', shortLabel: '左 → 右', horizontal: true, reverse: false },
  'right-to-left': { label: '從右到左', shortLabel: '右 → 左', horizontal: true, reverse: true },
  'top-to-bottom': { label: '從上到下', shortLabel: '上 ↓ 下', horizontal: false, reverse: false },
  'bottom-to-top': { label: '從下到上', shortLabel: '下 ↑ 上', horizontal: false, reverse: true },
};

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.hidden = true; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
const safeFileName = (value: string) => value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[.\s]+$/g, '').slice(0, 120) || 'system-map';
const modulePathLabel = (modules: SystemModule[], id: string) => findModulePath(modules, id).map((part) => part.name).join(' / ');
const versionSummary = (version: SystemVersion) => {
  const modules = flattenModules(version.modules);
  return {
    rootModuleCount: version.modules.length,
    moduleCount: modules.length,
    spaceCount: modules.reduce((sum, module) => sum + moduleSpaceCount(module), 0),
    recordCount: version.modules.reduce((sum, module) => sum + moduleRecordCount(module), 0),
    topicCount: modules.reduce((sum, module) => sum + module.topics.length, 0),
    flowCount: (version.flows ?? []).length,
    health: modules.reduce((counts, module) => ({ ...counts, [module.health]: counts[module.health] + 1 }), { healthy: 0, watch: 0, risk: 0 } as Record<ModuleHealth, number>),
  };
};
function moduleMarkdown(module: SystemModule, path: string[] = [], depth = 2): string {
  const heading = '#'.repeat(Math.min(depth, 6));
  const sectionHeading = '#'.repeat(Math.min(depth + 1, 6));
  const nextPath = [...path, module.name];
  const childSection = (module.children ?? []).map((child) => moduleMarkdown(child, nextPath, depth + 1)).join('\n\n');
  const spaces = module.spaces.length ? module.spaces.map((space) => {
    const names = expandedSpaceNames(space); const total = names.reduce((sum, _, index) => sum + instanceCount(space, index), 0);
    return `- **${space.name}** · ${space.kind} · ${names.length} 個實例 · 共 ${total} 筆 — ${space.detail}\n${names.map((name, index) => `  - ${name}：${instanceCount(space, index)} 筆`).join('\n')}`;
  }).join('\n') : '- 無';
  return `${heading} ${module.name} (${module.code})\n\n${module.summary}\n\n- **層級：** ${nextPath.join(' / ')}\n- **狀態：** ${healthMeta[module.health].label}\n- **資料筆數：** 本模組 ${ownRecordCount(module)} 筆；含子模組 ${moduleRecordCount(module)} 筆\n- **暫存實例：** ${moduleSpaceCount(module)} 個\n- **主題：** ${module.topics.length} 項\n\n${sectionHeading} 暫存空間\n\n${spaces}\n\n${sectionHeading} 主題與決議\n\n${module.topics.length ? module.topics.map((topic) => `- **${topic.title}** · ${topicMeta[topic.status].label} · ${topic.updatedAt}\n  ${topic.content}`).join('\n') : '- 目前沒有主題。'}${childSection ? `\n\n${sectionHeading} 子模組\n\n${childSection}` : ''}`;
}
function versionMarkdown(version: SystemVersion, systemName: string, exportedAt: string) {
  const summary = versionSummary(version);
  const flows = (version.flows ?? []).map((flow) => {
    const source = resolveFlowEndpoint(version.modules, flow.sourceId); const target = resolveFlowEndpoint(version.modules, flow.targetId);
    return `- **${source?.path ?? flow.sourceId}**${source ? ` (${source.code}，${source.recordCount} 筆)` : ''} → **${target?.path ?? flow.targetId}**${target ? ` (${target.code}，${target.recordCount} 筆)` : ''}${flow.label ? ` · ${flow.label}` : ''}`;
  }).join('\n') || '- 尚未設定資料流。';
  return `# ${systemName} — ${version.label}\n\n> ${version.release} · ${version.state}\n\n${version.description}\n\n- **匯出時間：** ${exportedAt}\n- **模組：** ${summary.moduleCount} 個（${summary.rootModuleCount} 個根模組）\n- **暫存實例：** ${summary.spaceCount} 個\n- **資料筆數：** ${summary.recordCount} 筆\n- **資料流：** ${summary.flowCount} 條\n- **主題：** ${summary.topicCount} 項\n- **健康狀態：** 穩定 ${summary.health.healthy}、留意 ${summary.health.watch}、風險 ${summary.health.risk}\n\n## 模組資料流\n\n${flows}\n\n## 模組明細\n\n${version.modules.map((module) => moduleMarkdown(module)).join('\n\n---\n\n')}\n`;
}
function versionHtml(version: SystemVersion, systemName: string, exportedAt: string, flowLayout: FlowLayout) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  const summary = versionSummary(version);
  const renderModule = (module: SystemModule, path: string[] = [], depth = 0): string => {
    const nextPath = [...path, module.name];
    const spaceRows = module.spaces.flatMap((space) => expandedSpaceNames(space).map((name, index) => `<tr><td>${escape(space.name)}</td><td>${escape(name)}</td><td>${escape(space.kind)}</td><td>${instanceCount(space, index)}</td><td>${escape(space.detail)}</td></tr>`)).join('') || '<tr><td colspan="5">無</td></tr>';
    const topics = module.topics.map((topic) => `<section class="topic"><div><strong>${escape(topic.title)}</strong><span class="tag">${escape(topicMeta[topic.status].label)}</span></div><p>${escape(topic.content)}</p><small>${escape(topic.updatedAt)}</small></section>`).join('') || '<p>目前沒有主題。</p>';
    return `<article class="module-detail" style="margin-left:${Math.min(depth, 3) * 18}px"><h2>${escape(module.name)} <small>${escape(module.code)}</small></h2><p class="path">${escape(nextPath.join(' / '))}</p><p>${escape(module.summary)}</p><dl><div><dt>狀態</dt><dd>${escape(healthMeta[module.health].label)}</dd></div><div><dt>本模組資料</dt><dd>${ownRecordCount(module)} 筆</dd></div><div><dt>含子模組</dt><dd>${moduleRecordCount(module)} 筆</dd></div><div><dt>暫存實例</dt><dd>${moduleSpaceCount(module)} 個</dd></div><div><dt>主題</dt><dd>${module.topics.length} 項</dd></div></dl><h3>暫存空間</h3><div class="table-wrap"><table><thead><tr><th>基礎名稱</th><th>實例</th><th>類型</th><th>資料筆數</th><th>容量、TTL 或用途</th></tr></thead><tbody>${spaceRows}</tbody></table></div><h3>主題與決議</h3>${topics}${(module.children ?? []).map((child) => renderModule(child, nextPath, depth + 1)).join('')}</article>`;
  };
  const flowRows = (version.flows ?? []).map((flow) => {
    const source = resolveFlowEndpoint(version.modules, flow.sourceId); const target = resolveFlowEndpoint(version.modules, flow.targetId);
    return `<tr><td>${escape(source?.path ?? flow.sourceId)}${source ? `<small>${escape(source.code)}</small>` : ''}</td><td>${escape(target?.path ?? flow.targetId)}${target ? `<small>${escape(target.code)}</small>` : ''}</td><td>${escape(flow.label || '—')}</td><td>${source?.recordCount ?? '—'} → ${target?.recordCount ?? '—'} 筆</td></tr>`;
  }).join('') || '<tr><td colspan="4">尚未設定資料流。</td></tr>';
  const collapsedFlows = (version.flows ?? []).flatMap((flow) => { const sourceId = rootModuleIdForEndpoint(version.modules, flow.sourceId); const targetId = rootModuleIdForEndpoint(version.modules, flow.targetId); return sourceId && targetId && sourceId !== targetId ? [{ ...flow, sourceId, targetId }] : []; });
  const rootLevels = buildFlowLevels(version.modules, collapsedFlows); const rootLevelCount = Math.max(...version.modules.map((module) => rootLevels.get(module.id) ?? 0), 0) + 1;
  const rootColumns = Array.from({ length: rootLevelCount }, (_, level) => version.modules.filter((module) => (rootLevels.get(module.id) ?? 0) === level));
  if (layoutMeta[flowLayout].reverse) rootColumns.reverse();
  const renderMapModule = (module: SystemModule, depth = 0): string => {
    const spaces = module.spaces.map((space) => `<div class="map-cache-group" data-endpoint-id="${escape(space.id)}"><div><strong>${escape(space.name)}</strong><small>${escape(space.kind)} · ${spaceQuantity(space)} 個實例 · ${expandedSpaceNames(space).reduce((sum, _, index) => sum + instanceCount(space, index), 0)} 筆</small></div><div class="map-cache-instances">${expandedSpaceNames(space).map((name, index) => `<span>${escape(name)} <b>${instanceCount(space, index)}</b></span>`).join('')}</div></div>`).join('');
    const children = (module.children ?? []).map((child) => renderMapModule(child, depth + 1)).join('');
    return `<section class="map-module-shell" style="--module-color:${escape(module.color)}"><div class="map-module-anchor" data-endpoint-id="${escape(module.id)}"><div class="map-module-title"><span>${escape(module.code)}</span><em>${escape(healthMeta[module.health].label)}</em></div><strong>${escape(module.name)}</strong><small>${depth ? `第 ${depth + 1} 層子模組` : '根層模組'} · ${ownRecordCount(module)} 筆資料</small></div>${spaces ? `<div class="map-cache-rack">${spaces}</div>` : ''}${children ? `<div class="map-children"><span>子模組</span>${children}</div>` : ''}</section>`;
  };
  const mapColumns = rootColumns.map((column, level) => `<div class="map-stage"><div class="map-stage-title"><span>階段 ${String(level + 1).padStart(2, '0')}</span><b>${column.reduce((sum, module) => sum + moduleRecordCount(module), 0)} 筆</b></div>${column.map((module) => renderMapModule(module)).join('')}</div>`).join('');
  const flowData = JSON.stringify((version.flows ?? []).map((flow) => ({ id: flow.id, sourceId: flow.sourceId, targetId: flow.targetId, label: flow.label || '資料流' }))).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(systemName)} ${escape(version.label)}</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{max-width:1180px;margin:48px auto;padding:0 24px 64px;font:16px/1.65 system-ui;color:#172035;background:#f7f9fc}.doc-card,.module-detail{background:#fff;border:1px solid #d8dde8;border-radius:14px;padding:24px;margin:0 0 20px}h1,h2,h3{line-height:1.25}h1{margin:0 0 8px}h2 small,.path,small{display:block;color:#68748a;font-weight:500}.summary,dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px}.summary div,dl div{background:#f1f4f8;border-radius:8px;padding:10px 12px}.summary strong,dd{display:block;font-size:1.15rem;margin:0}dt{color:#68748a;font-size:.82rem}.table-wrap,.map-scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:9px 10px;border-bottom:1px solid #e2e6ee;text-align:left;vertical-align:top}th{font-size:.78rem;color:#5c687d;background:#f4f6f9}.topic{border-left:3px solid #6f9cff;padding:8px 12px;margin:10px 0}.topic p{margin:5px 0}.tag{display:inline-block;margin-left:8px;padding:2px 8px;background:#e8eefc;border-radius:999px;font-size:13px}.architecture-map{margin:22px 0;padding:20px;color:#e9eef6;background:#0e192a;border-radius:14px}.architecture-map>header{display:flex;justify-content:space-between;gap:16px;margin-bottom:14px}.architecture-map h2{margin:0}.architecture-map header small{color:#8da0b9}.map-scene{position:relative;isolation:isolate;display:flex;align-items:flex-start;gap:68px;min-width:max-content;padding:14px;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:24px 24px}.map-scene.vertical{flex-direction:column;min-width:760px}.map-stage{width:290px;display:grid;gap:14px}.map-scene.vertical .map-stage{width:100%;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.map-stage-title{display:flex;justify-content:space-between;grid-column:1/-1;padding:0 3px 7px;color:#8fa0b8;border-bottom:1px solid #304159;font:700 12px ui-monospace,monospace}.map-stage-title b{color:#63d8c7}.map-module-shell{position:relative;z-index:1;padding:10px;background:#142238;border:1px solid #40516a;border-top:3px solid var(--module-color);border-radius:9px}.map-module-anchor{display:grid;gap:4px;padding:4px}.map-module-title{display:flex;justify-content:space-between;gap:8px}.map-module-title span,.map-module-title em{color:var(--module-color);font:700 11px ui-monospace,monospace}.map-module-title em{font-style:normal}.map-module-anchor>strong{font-size:15px}.map-module-anchor>small{color:#8fa0b8;font-size:11px}.map-cache-rack{display:grid;gap:7px;margin-top:9px}.map-cache-group{padding:7px;border:1px solid #65738a;border-radius:6px;background:#0d192a}.map-cache-group>div:first-child{display:flex;justify-content:space-between;gap:8px}.map-cache-group strong{font-size:11px}.map-cache-group small{color:#91a1b7;font-size:10px}.map-cache-instances{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.map-cache-instances span{padding:2px 5px;color:#b9c7d9;background:#1c2d46;border-radius:3px;font-size:10px}.map-cache-instances b{color:var(--module-color)}.map-children{display:grid;gap:8px;margin-top:10px;padding:9px;border:1px solid #ffffff26;border-radius:7px}.map-children>span{color:#93a4bb;font:700 10px ui-monospace,monospace;letter-spacing:.08em}.map-children .map-module-shell{background:#101d30}.map-lines{position:absolute;z-index:0;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.map-lines path{fill:none;stroke:#63d8c7;stroke-width:2;opacity:.8}.map-lines text{fill:#c9d5e4;stroke:#0e192a;stroke-width:5;paint-order:stroke fill;font:700 11px system-ui}.flow-fallback{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.flow-fallback span{padding:5px 8px;color:#c5d2e2;background:#17263d;border:1px solid #33455f;border-radius:5px;font-size:12px}@media print{body{max-width:none;margin:0;background:#fff}.doc-card,.module-detail{break-inside:avoid}.architecture-map{break-inside:avoid}}@media(max-width:640px){body{margin:20px auto;padding:0 12px 40px}.doc-card,.module-detail{padding:18px}.module-detail{margin-left:0!important}.architecture-map{padding:14px}.architecture-map>header{display:block}.map-scene.vertical{min-width:620px}}</style></head><body><header class="doc-card"><h1>${escape(systemName)} — ${escape(version.label)}</h1><p>${escape(version.release)} · ${escape(version.state)}</p><p>${escape(version.description)}</p><small>匯出時間：${escape(exportedAt)}</small><div class="summary"><div><span>模組</span><strong>${summary.moduleCount}</strong></div><div><span>暫存實例</span><strong>${summary.spaceCount}</strong></div><div><span>資料筆數</span><strong>${summary.recordCount}</strong></div><div><span>資料流</span><strong>${summary.flowCount}</strong></div><div><span>主題</span><strong>${summary.topicCount}</strong></div><div><span>健康狀態</span><strong>${summary.health.healthy} / ${summary.health.watch} / ${summary.health.risk}</strong><small>穩定 / 留意 / 風險</small></div></div></header><section class="architecture-map"><header><div><h2>系統架構靜態圖</h2><small>子模組置於父模組內；暫存空間以群組表示</small></div><small>顯示方向：${escape(layoutMeta[flowLayout].label)}</small></header><div class="map-scroll"><div id="export-map-scene" class="map-scene ${layoutMeta[flowLayout].horizontal ? 'horizontal' : 'vertical'}" data-direction="${flowLayout}"><svg class="map-lines" aria-hidden="true"><defs><marker id="export-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#63d8c7"/></marker></defs><g id="export-map-paths"></g></svg>${mapColumns}</div></div><div class="flow-fallback">${(version.flows ?? []).map((flow) => { const source = resolveFlowEndpoint(version.modules, flow.sourceId); const target = resolveFlowEndpoint(version.modules, flow.targetId); return `<span>${escape(source?.path ?? flow.sourceId)} → ${escape(target?.path ?? flow.targetId)}${flow.label ? ` · ${escape(flow.label)}` : ''}</span>`; }).join('') || '<span>尚未設定資料流</span>'}</div></section><section class="doc-card"><h2>模組資料流</h2><div class="table-wrap"><table><thead><tr><th>來源節點</th><th>目標節點</th><th>資料流名稱</th><th>節點資料筆數</th></tr></thead><tbody>${flowRows}</tbody></table></div></section><h1>模組明細</h1>${version.modules.map((module) => renderModule(module)).join('')}<script type="application/json" id="export-flow-data">${flowData}</script><script>(()=>{const scene=document.getElementById('export-map-scene'),layer=document.getElementById('export-map-paths'),dataNode=document.getElementById('export-flow-data');if(!scene||!layer||!dataNode)return;const flows=JSON.parse(dataNode.textContent||'[]');function draw(){const bounds=scene.getBoundingClientRect(),nodes=new Map;scene.querySelectorAll('[data-endpoint-id]').forEach(node=>nodes.set(node.dataset.endpointId,node.getBoundingClientRect()));layer.innerHTML='';flows.forEach(flow=>{const source=nodes.get(flow.sourceId),target=nodes.get(flow.targetId);if(!source||!target)return;const dx=target.left+target.width/2-source.left-source.width/2,dy=target.top+target.height/2-source.top-source.height/2,horizontal=Math.abs(dx)>Math.abs(dy);let sx,sy,tx,ty,d;if(horizontal){const forward=dx>=0;sx=(forward?source.right:source.left)-bounds.left;tx=(forward?target.left:target.right)-bounds.left;sy=source.top+source.height/2-bounds.top;ty=target.top+target.height/2-bounds.top;const bend=Math.max(42,Math.abs(tx-sx)*.45);d='M '+sx+' '+sy+' C '+(sx+(forward?bend:-bend))+' '+sy+', '+(tx+(forward?-bend:bend))+' '+ty+', '+tx+' '+ty}else{const forward=dy>=0;sx=source.left+source.width/2-bounds.left;tx=target.left+target.width/2-bounds.left;sy=(forward?source.bottom:source.top)-bounds.top;ty=(forward?target.top:target.bottom)-bounds.top;const bend=Math.max(36,Math.abs(ty-sy)*.45);d='M '+sx+' '+sy+' C '+sx+' '+(sy+(forward?bend:-bend))+', '+tx+' '+(ty+(forward?-bend:bend))+', '+tx+' '+ty}const ns='http://www.w3.org/2000/svg',path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('marker-end','url(#export-arrow)');layer.appendChild(path);const text=document.createElementNS(ns,'text');text.setAttribute('x',String((sx+tx)/2));text.setAttribute('y',String((sy+ty)/2-6));text.setAttribute('text-anchor','middle');text.textContent=flow.label;layer.appendChild(text)})}requestAnimationFrame(draw);addEventListener('resize',draw)})();</script></body></html>`;
}

function fullSystemJson(data: SystemMapData, exportedAt: string) {
  const enrichModule = (module: SystemModule, path: string[]): object => {
    const nextPath = [...path, module.name];
    return { ...module, path: nextPath, healthLabel: healthMeta[module.health].label, ownRecordCount: ownRecordCount(module), totalRecordCount: moduleRecordCount(module), spaceInstanceCount: moduleSpaceCount(module), spaces: module.spaces.map((space) => { const names = expandedSpaceNames(space); return { ...space, quantity: names.length, totalRecordCount: names.reduce((sum, _, index) => sum + instanceCount(space, index), 0), instances: names.map((name, index) => ({ name, recordCount: instanceCount(space, index) })) }; }), topics: module.topics.map((topic) => ({ ...topic, statusLabel: topicMeta[topic.status].label })), children: (module.children ?? []).map((child) => enrichModule(child, nextPath)) };
  };
  return JSON.stringify({ schemaVersion: 'system-map-export/v2', exportedAt, systemName: data.systemName, versionCount: data.versions.length, versions: data.versions.map((version) => ({ ...version, summary: versionSummary(version), flows: (version.flows ?? []).map((flow) => { const source = resolveFlowEndpoint(version.modules, flow.sourceId); const target = resolveFlowEndpoint(version.modules, flow.targetId); return { ...flow, source: { id: flow.sourceId, type: source?.type ?? 'unknown', path: source?.path ?? flow.sourceId }, target: { id: flow.targetId, type: target?.type ?? 'unknown', path: target?.path ?? flow.targetId } }; }), modules: version.modules.map((module) => enrichModule(module, [])) })) }, null, 2);
}

function databaseBackupJson(data: SystemMapData, exportedAt: string) {
  return JSON.stringify({ schemaVersion: 'system-map-backup/v1', exportedAt, data }, null, 2);
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const requiredText = (value: unknown, label: string) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}缺少必要文字。`); return value; };
const optionalText = (value: unknown) => typeof value === 'string' ? value : '';
const importedCount = (value: unknown) => Math.max(0, Math.floor(Number(value)) || 0);

function parseSystemBackup(payload: unknown): SystemMapData {
  if (!isObject(payload)) throw new Error('備份檔案不是有效的 JSON 物件。');
  const candidate = payload.schemaVersion === 'system-map-backup/v1' ? payload.data : payload;
  if (!isObject(candidate) || !Array.isArray(candidate.versions) || !candidate.versions.length) throw new Error('備份中找不到任何系統版本。');
  const parseModule = (value: unknown, seenIds: Set<string>): SystemModule => {
    if (!isObject(value)) throw new Error('模組資料格式不正確。');
    const id = requiredText(value.id, '模組 ID'); if (seenIds.has(id)) throw new Error(`備份中有重複的節點 ID：${id}`); seenIds.add(id);
    const spaces = Array.isArray(value.spaces) ? value.spaces.map((spaceValue) => {
      if (!isObject(spaceValue)) throw new Error('暫存空間資料格式不正確。');
      const spaceId = requiredText(spaceValue.id, '暫存空間 ID'); if (seenIds.has(spaceId)) throw new Error(`備份中有重複的節點 ID：${spaceId}`); seenIds.add(spaceId);
      const quantity = Math.max(1, Math.floor(Number(spaceValue.quantity)) || 1);
      const counts = Array.isArray(spaceValue.instanceCounts) ? spaceValue.instanceCounts : [];
      return { id: spaceId, name: requiredText(spaceValue.name, '暫存空間名稱'), kind: optionalText(spaceValue.kind), detail: optionalText(spaceValue.detail), quantity, instanceCounts: Array.from({ length: quantity }, (_, index) => importedCount(counts[index])) };
    }) : [];
    const topics = Array.isArray(value.topics) ? value.topics.map((topicValue) => {
      if (!isObject(topicValue)) throw new Error('主題資料格式不正確。');
      const statusValue = topicValue.status; if (statusValue !== 'draft' && statusValue !== 'discussion' && statusValue !== 'reviewed') throw new Error('主題狀態不正確。'); const status: TopicStatus = statusValue;
      return { id: requiredText(topicValue.id, '主題 ID'), title: requiredText(topicValue.title, '主題名稱'), content: optionalText(topicValue.content), status, updatedAt: optionalText(topicValue.updatedAt) };
    }) : [];
    const health = value.health; if (health !== 'healthy' && health !== 'watch' && health !== 'risk') throw new Error('模組健康狀態不正確。');
    return { id, name: requiredText(value.name, '模組名稱'), code: optionalText(value.code), summary: optionalText(value.summary), health, color: typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) ? value.color : '#63d8c7', spaces, topics, children: Array.isArray(value.children) ? value.children.map((child) => parseModule(child, seenIds)) : [] };
  };
  const versions = candidate.versions.map((versionValue) => {
    if (!isObject(versionValue)) throw new Error('系統版本資料格式不正確。');
    const seenIds = new Set<string>(); const modules = Array.isArray(versionValue.modules) ? versionValue.modules.map((module) => parseModule(module, seenIds)) : [];
    const stateValue = versionValue.state; if (stateValue !== '現行' && stateValue !== '候選' && stateValue !== '封存') throw new Error('系統版本狀態不正確。'); const state: SystemVersion['state'] = stateValue;
    const flows = Array.isArray(versionValue.flows) ? versionValue.flows.map((flowValue) => {
      if (!isObject(flowValue)) throw new Error('資料流格式不正確。');
      const sourceId = requiredText(flowValue.sourceId, '資料流來源'); const targetId = requiredText(flowValue.targetId, '資料流目標');
      if (!seenIds.has(sourceId) || !seenIds.has(targetId)) throw new Error('資料流連到不存在的模組或暫存空間。');
      return { id: requiredText(flowValue.id, '資料流 ID'), sourceId, targetId, label: optionalText(flowValue.label) };
    }) : [];
    return { id: requiredText(versionValue.id, '系統版本 ID'), label: requiredText(versionValue.label, '系統版本名稱'), release: optionalText(versionValue.release), state, description: optionalText(versionValue.description), modules, flows };
  });
  return { systemName: requiredText(candidate.systemName, '系統名稱'), versions };
}

function cloneImportedVersion(source: SystemVersion, label: string): SystemVersion {
  const idMap = new Map<string, string>();
  const cloneModule = (module: SystemModule): SystemModule => {
    const id = makeId('module'); idMap.set(module.id, id);
    const spaces = module.spaces.map((space) => { const spaceId = makeId('space'); idMap.set(space.id, spaceId); return { ...space, id: spaceId, instanceCounts: [...(space.instanceCounts ?? [])] }; });
    return { ...module, id, spaces, topics: module.topics.map((topic) => ({ ...topic, id: makeId('topic') })), children: (module.children ?? []).map(cloneModule) };
  };
  const modules = source.modules.map(cloneModule);
  const flows = (source.flows ?? []).flatMap((flow) => { const sourceId = idMap.get(flow.sourceId); const targetId = idMap.get(flow.targetId); return sourceId && targetId ? [{ ...flow, id: makeId('flow'), sourceId, targetId }] : []; });
  return { ...source, id: makeId('version'), label: label.trim(), modules, flows };
}

function CacheVessel({ name, count, compact = false }: { name: string; count: number; compact?: boolean }) {
  const visibleBalls = Math.min(count, compact ? 6 : 12);
  return <span className={`cache-vessel ${count ? 'occupied' : 'empty'} ${compact ? 'compact' : ''}`} aria-label={`${name}，${count} 筆資料`}>
    <span className="vessel-label"><b>{name}</b><small>{count ? `${count} 筆` : '空'}</small></span>
    <span className="vessel-cup" aria-hidden="true"><span className="vessel-balls">{Array.from({ length: visibleBalls }, (_, index) => <i key={index} />)}</span>{count > visibleBalls ? <em>+{count - visibleBalls}</em> : null}</span>
  </span>;
}

function buildFlowLevels(modules: SystemModule[], flows: DataFlow[]) {
  const flat = flattenModules(modules); const ids = new Set(flat.map((module) => module.id));
  const incoming = new Map(flat.map((module) => [module.id, 0])); const outgoing = new Map(flat.map((module) => [module.id, [] as string[]]));
  flows.forEach((flow) => { if (!ids.has(flow.sourceId) || !ids.has(flow.targetId)) return; incoming.set(flow.targetId, (incoming.get(flow.targetId) ?? 0) + 1); outgoing.get(flow.sourceId)?.push(flow.targetId); });
  const queue = flat.filter((module) => incoming.get(module.id) === 0).map((module) => module.id); const levels = new Map(flat.map((module) => [module.id, 0]));
  while (queue.length) { const current = queue.shift()!; (outgoing.get(current) ?? []).forEach((target) => { levels.set(target, Math.max(levels.get(target) ?? 0, (levels.get(current) ?? 0) + 1)); incoming.set(target, (incoming.get(target) ?? 1) - 1); if (incoming.get(target) === 0) queue.push(target); }); }
  flat.forEach((module) => { if ((incoming.get(module.id) ?? 0) > 0) levels.set(module.id, Math.max(...levels.values(), 0) + 1); });
  return levels;
}

function DeleteAction({ name, description, onConfirm, label, className, disabled = false }: { name: string; description: string; onConfirm: () => void; label?: string; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogTrigger disabled={disabled} render={<Button type="button" variant="ghost" size={label ? 'sm' : 'icon-sm'} className={className} aria-label={`刪除${name}`} disabled={disabled} />}><Trash2 />{label}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>刪除{name}？</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setOpen(false); onConfirm(); }}>刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

type FlowPath = { id: string; label: string; d: string; labelX: number; labelY: number };

function UnifiedFlowMap({ modules, flows, selectedId, layout, canEdit, onLayoutChange, onSelect, onHealthChange, onAddRoot }: { modules: SystemModule[]; flows: DataFlow[]; selectedId: string; layout: FlowLayout; canEdit: boolean; onLayoutChange: (layout: FlowLayout) => void; onSelect: (module: SystemModule) => void; onHealthChange: (moduleId: string, health: ModuleHealth) => void; onAddRoot: () => void }) {
  const sceneRef = useRef<HTMLDivElement>(null); const endpointRefs = useRef(new Map<string, HTMLElement>()); const [paths, setPaths] = useState<FlowPath[]>([]);
  const [expandedCacheModules, setExpandedCacheModules] = useState<Set<string>>(() => new Set());
  const [expandedCacheGroups, setExpandedCacheGroups] = useState<Set<string>>(() => new Set());
  const flat = useMemo(() => flattenModules(modules), [modules]); const spaces = useMemo(() => flattenSpaceEndpoints(modules), [modules]);
  const visibleIds = useMemo(() => new Set([...flat.map((module) => module.id), ...spaces.map((entry) => entry.space.id)]), [flat, spaces]);
  const visibleFlows = useMemo(() => flows.filter((flow) => visibleIds.has(flow.sourceId) && visibleIds.has(flow.targetId)), [flows, visibleIds]);
  const collapsedFlows = useMemo(() => visibleFlows.flatMap((flow) => { const sourceId = rootModuleIdForEndpoint(modules, flow.sourceId); const targetId = rootModuleIdForEndpoint(modules, flow.targetId); return sourceId && targetId && sourceId !== targetId ? [{ ...flow, sourceId, targetId }] : []; }), [modules, visibleFlows]);
  const levels = useMemo(() => buildFlowLevels(modules, collapsedFlows), [collapsedFlows, modules]);
  const levelCount = Math.max(...modules.map((module) => levels.get(module.id) ?? 0), 0) + 1;
  const columns = useMemo(() => { const next = Array.from({ length: levelCount }, (_, level) => modules.filter((module) => (levels.get(module.id) ?? 0) === level)); return layoutMeta[layout].reverse ? next.reverse() : next; }, [layout, levelCount, levels, modules]);
  const setEndpointRef = (id: string, node: HTMLElement | null) => { if (node) endpointRefs.current.set(id, node); else endpointRefs.current.delete(id); };
  const measurePaths = useCallback(() => {
    const scene = sceneRef.current; if (!scene) return; const bounds = scene.getBoundingClientRect();
    const outgoingByEndpoint = new Map<string, DataFlow[]>(); const incomingByEndpoint = new Map<string, DataFlow[]>();
    visibleFlows.forEach((flow) => { outgoingByEndpoint.set(flow.sourceId, [...(outgoingByEndpoint.get(flow.sourceId) ?? []), flow]); incomingByEndpoint.set(flow.targetId, [...(incomingByEndpoint.get(flow.targetId) ?? []), flow]); });
    const portOffset = (items: DataFlow[], flowId: string, size: number) => items.length <= 1 ? 0 : ((items.findIndex((item) => item.id === flowId) + 1) / (items.length + 1) - .5) * Math.min(size * .7, 72);
    setPaths(visibleFlows.flatMap((flow) => { const source = endpointRefs.current.get(flow.sourceId)?.getBoundingClientRect(); const target = endpointRefs.current.get(flow.targetId)?.getBoundingClientRect(); if (!source || !target) return [];
      const dx = target.left + target.width / 2 - source.left - source.width / 2; const dy = target.top + target.height / 2 - source.top - source.height / 2;
      const crossFamily = rootModuleIdForEndpoint(modules, flow.sourceId) !== rootModuleIdForEndpoint(modules, flow.targetId); const horizontal = crossFamily ? layoutMeta[layout].horizontal : Math.abs(dx) > Math.abs(dy);
      const hasReverse = visibleFlows.some((candidate) => candidate.sourceId === flow.targetId && candidate.targetId === flow.sourceId);
      const lane = hasReverse ? (flow.sourceId.localeCompare(flow.targetId) < 0 ? -18 : 18) : 0;
      let startX: number; let startY: number; let endX: number; let endY: number; let d: string;
      if (horizontal) { const forward = dx >= 0; startX = (forward ? source.right : source.left) - bounds.left; endX = (forward ? target.left : target.right) - bounds.left; startY = source.top + source.height / 2 - bounds.top + portOffset(outgoingByEndpoint.get(flow.sourceId) ?? [], flow.id, source.height); endY = target.top + target.height / 2 - bounds.top + portOffset(incomingByEndpoint.get(flow.targetId) ?? [], flow.id, target.height); const bend = Math.max(42, Math.abs(endX - startX) * .45); d = `M ${startX} ${startY} C ${startX + (forward ? bend : -bend)} ${startY + lane}, ${endX + (forward ? -bend : bend)} ${endY + lane}, ${endX} ${endY}`; }
      else { const forward = dy >= 0; startX = source.left + source.width / 2 - bounds.left + portOffset(outgoingByEndpoint.get(flow.sourceId) ?? [], flow.id, source.width); endX = target.left + target.width / 2 - bounds.left + portOffset(incomingByEndpoint.get(flow.targetId) ?? [], flow.id, target.width); startY = (forward ? source.bottom : source.top) - bounds.top; endY = (forward ? target.top : target.bottom) - bounds.top; const bend = Math.max(36, Math.abs(endY - startY) * .45); d = `M ${startX} ${startY} C ${startX + lane} ${startY + (forward ? bend : -bend)}, ${endX + lane} ${endY + (forward ? -bend : bend)}, ${endX} ${endY}`; }
      return [{ id: flow.id, label: flow.label || (resolveFlowEndpoint(modules, flow.targetId)?.type === 'space' ? '寫入暫存' : '資料流'), d, labelX: (startX + endX) / 2 + (horizontal ? 0 : lane), labelY: (startY + endY) / 2 + (horizontal ? lane : 0) - 7 }]; }));
  }, [layout, modules, visibleFlows]);
  useEffect(() => { const frame = requestAnimationFrame(measurePaths); const observer = new ResizeObserver(measurePaths); if (sceneRef.current) observer.observe(sceneRef.current); endpointRefs.current.forEach((node) => observer.observe(node)); return () => { cancelAnimationFrame(frame); observer.disconnect(); }; }, [expandedCacheGroups, expandedCacheModules, flat, layout, measurePaths, spaces]);

  const renderModule = (module: SystemModule, depth = 0): React.ReactNode => {
    const incomingCount = visibleFlows.filter((flow) => flow.targetId === module.id || findSpaceEndpoint(modules, flow.targetId)?.owner.id === module.id).length;
    const outgoingCount = visibleFlows.filter((flow) => flow.sourceId === module.id).length;
    const cacheExpanded = expandedCacheModules.has(module.id);
    const cacheRecordCount = ownRecordCount(module);
    const setCacheSummaryRef = (node: HTMLButtonElement | null) => module.spaces.forEach((space) => setEndpointRef(space.id, node));
    return <article className={`graph-module-shell ${selectedId === module.id ? 'selected' : ''}`} style={{ '--module-color': module.color } as React.CSSProperties} key={module.id}>
      <Select value={module.health} disabled={!canEdit} onValueChange={(value) => value && onHealthChange(module.id, value as ModuleHealth)}><SelectTrigger className="graph-health-select" aria-label={`修改 ${module.name} 狀態`}><SelectValue>{healthMeta[module.health].label}</SelectValue></SelectTrigger><SelectContent align="end" alignItemWithTrigger={false} sideOffset={6}><SelectItem value="healthy">穩定</SelectItem><SelectItem value="watch">留意</SelectItem><SelectItem value="risk">風險</SelectItem></SelectContent></Select>
      <button ref={(node) => setEndpointRef(module.id, node)} type="button" className="graph-module-node" onClick={() => onSelect(module)}>
        <span className="graph-module-top"><small>{module.code}</small></span>
        <strong>{module.name}</strong><span className="graph-module-path">{depth ? `第 ${depth + 1} 層子模組` : '根層模組'}</span>
        <span className="graph-record-total"><Database /><b>{ownRecordCount(module)}</b><small>筆資料</small>{(module.children ?? []).length ? <em>含子模組 {moduleRecordCount(module)} 筆</em> : null}</span>
        <span className="graph-flow-count"><span><ArrowLeft />{incomingCount} 輸入</span><span>{outgoingCount} 輸出<ArrowRight /></span></span>
      </button>
      {module.spaces.length ? <div className="graph-cache-section"><button ref={cacheExpanded ? undefined : setCacheSummaryRef} type="button" className="graph-cache-toggle" aria-expanded={cacheExpanded} onClick={() => setExpandedCacheModules((current) => { const next = new Set(current); if (next.has(module.id)) next.delete(module.id); else next.add(module.id); return next; })}><span><Archive /><b>暫存空間</b></span><small>{module.spaces.length} 區 · {moduleSpaceCount(module)} 個實例 · {cacheRecordCount} 筆</small><ChevronRight /></button>{cacheExpanded ? <div className="graph-cache-groups">{module.spaces.map((space) => { const groupExpanded = expandedCacheGroups.has(space.id); const total = expandedSpaceNames(space).reduce((sum, _, index) => sum + instanceCount(space, index), 0); return <div className="graph-cache-group" key={space.id}><button ref={(node) => setEndpointRef(space.id, node)} type="button" className="graph-cache-group-toggle" aria-expanded={groupExpanded} onClick={() => setExpandedCacheGroups((current) => { const next = new Set(current); if (next.has(space.id)) next.delete(space.id); else next.add(space.id); return next; })}><span className="graph-cache-group-head"><span><Archive /><b>{space.name}</b></span><small>{space.kind} · {spaceQuantity(space)} 個 · {total} 筆</small></span><ChevronRight /></button>{groupExpanded ? <span className="graph-cache-rack">{expandedSpaceNames(space).map((name, index) => <CacheVessel compact key={`${space.id}-${index}`} name={name} count={instanceCount(space, index)} />)}</span> : null}</div>; })}</div> : null}</div> : null}
      {(module.children ?? []).length ? <div className="graph-children"><span className="graph-children-label"><GitBranch />{module.name} 的子模組</span>{(module.children ?? []).map((child) => renderModule(child, depth + 1))}</div> : null}
    </article>;
  };

  return <section className="unified-flow" aria-label="完整模組資料流與資料筆數">
    <div className="unified-flow-head"><div><span><Waypoints />完整資料流</span><strong>子模組位於父模組內，暫存群組也可成為資料流目標</strong></div><div className="flow-head-actions"><label className="flow-layout-picker"><span>顯示方向</span><Select value={layout} onValueChange={(value) => value && onLayoutChange(value as FlowLayout)}><SelectTrigger aria-label="切換資料流顯示方向"><SelectValue>{layoutMeta[layout].shortLabel}</SelectValue></SelectTrigger><SelectContent align="end" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="left-to-right"><ArrowRight />從左到右</SelectItem><SelectItem value="right-to-left"><ArrowLeft />從右到左</SelectItem><SelectItem value="top-to-bottom"><ArrowDown />從上到下</SelectItem><SelectItem value="bottom-to-top"><ArrowUp />從下到上</SelectItem></SelectContent></Select></label>{canEdit ? <Button type="button" size="sm" onClick={onAddRoot}><Plus />新增根模組</Button> : null}</div></div>
    <div className="flow-scroll"><div ref={sceneRef} className={`flow-scene ${layoutMeta[layout].horizontal ? 'horizontal' : 'vertical'} ${layoutMeta[layout].reverse ? 'reverse' : ''}`} style={{ '--flow-columns': levelCount } as React.CSSProperties}>
      <svg className="flow-lines" aria-hidden="true"><defs><marker id="flow-arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{paths.map((path) => <g key={path.id}><path className="flow-line" d={path.d} markerEnd="url(#flow-arrow-head)" /><text x={path.labelX} y={path.labelY} textAnchor="middle">{path.label}</text></g>)}</svg>
      {columns.map((column, level) => <div className="flow-column" key={level}><div className="flow-column-head"><span>階段 {String(level + 1).padStart(2, '0')}</span><b>{column.reduce((sum, module) => sum + moduleRecordCount(module), 0)} 筆</b></div>{column.map((module) => renderModule(module))}</div>)}
      {!flat.length ? <div className="flow-scene-empty"><Layers3 /><strong>目前沒有模組</strong><Button type="button" size="sm" onClick={onAddRoot}><Plus />建立第一個模組</Button></div> : null}
    </div></div>
  </section>;
}

export default function Home() {
  const [data, setData] = useState<SystemMapData>(initialData);
  const [versionId, setVersionId] = useState(initialData.versions[0].id);
  const [selectedModuleId, setSelectedModuleId] = useState(initialData.versions[0].modules[2].id);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialData.versions[0].modules[2].topics[0].id);
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | ModuleHealth>('all');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [expandedSpaceEditors, setExpandedSpaceEditors] = useState<Set<string>>(() => new Set());
  const [flowDirection, setFlowDirection] = useState<'upstream' | 'downstream'>('downstream');
  const [flowPeerId, setFlowPeerId] = useState('');
  const [flowLayout, setFlowLayout] = useState<FlowLayout>('left-to-right');
  const [syncState, setSyncState] = useState<'loading' | 'saved' | 'saving' | 'local' | 'conflict'>('loading');
  const [revision, setRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importedBackup, setImportedBackup] = useState<SystemMapData | null>(null);
  const [importSourceVersionId, setImportSourceVersionId] = useState('');
  const [importVersionName, setImportVersionName] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [access, setAccess] = useState<AccessSession>(guestAccess);
  const [accessReady, setAccessReady] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const hydratedRef = useRef(false); const localChangeRef = useRef(false); const mapEtagRef = useRef<string | null>(null); const syncingRef = useRef(false);
  const version = useMemo(() => data.versions.find((item) => item.id === versionId) ?? data.versions[0], [data, versionId]);
  const selectedModule = useMemo(() => findModule(version.modules, selectedModuleId) ?? version.modules[0] ?? null, [version, selectedModuleId]);
  const selectedPath = useMemo(() => findModulePath(version.modules, selectedModuleId), [version, selectedModuleId]);

  useEffect(() => { const saved = window.localStorage.getItem('system-map-flow-layout'); if (saved && saved in layoutMeta) setFlowLayout(saved as FlowLayout); }, []);
  const chooseFlowLayout = (next: FlowLayout) => { setFlowLayout(next); window.localStorage.setItem('system-map-flow-layout', next); };

  const loadAccess = useCallback(async () => { try { const response = await fetch('/api/access/me', { cache: 'no-store' }); if (!response.ok) throw new Error('access'); const nextAccess = await response.json() as AccessSession; setAccess(nextAccess); setData((current) => restrictMapForAccess(current, nextAccess)); } catch { setAccess(guestAccess); setData((current) => restrictMapForAccess(current, guestAccess)); } finally { setAccessReady(true); } }, []);
  useEffect(() => { void loadAccess(); }, [loadAccess]);

  const loadShared = useCallback(async (quiet = false) => {
    if (document.visibilityState !== 'visible' || localChangeRef.current || syncingRef.current) return; if (!quiet) setSyncState('loading'); syncingRef.current = true;
    try { const response = await fetch('/api/map', { cache: 'no-store', headers: mapEtagRef.current ? { 'if-none-match': mapEtagRef.current } : undefined }); if (response.status === 304) return; if (!response.ok) throw new Error('sync'); const payload = await response.json() as { data: SystemMapData | null; revision: number; mode?: string }; mapEtagRef.current = response.headers.get('etag'); if (payload.data?.versions?.length) setData(payload.data); setRevision(payload.revision ?? 0); setSyncState(payload.mode === 'memory' ? 'local' : 'saved'); }
    catch { setSyncState('local'); } finally { syncingRef.current = false; hydratedRef.current = true; }
  }, []);
  useEffect(() => { const syncWhenVisible = () => { if (document.visibilityState === 'visible') void loadShared(true); }; void loadShared(); document.addEventListener('visibilitychange', syncWhenVisible); return () => document.removeEventListener('visibilitychange', syncWhenVisible); }, [loadShared]);
  useEffect(() => {
    if (!hydratedRef.current || !localChangeRef.current) return;
    const timer = window.setTimeout(async () => {
      setSyncState('saving');
      try { const response = await fetch('/api/map', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, revision }) }); const payload = await response.json() as { data?: SystemMapData; revision?: number; mode?: string }; const nextEtag = response.headers.get('etag'); if (nextEtag) mapEtagRef.current = nextEtag; if (response.status === 409) { if (payload.data) setData(payload.data); setRevision(payload.revision ?? revision); setSyncState('conflict'); } else if (!response.ok) throw new Error('save'); else { setRevision(payload.revision ?? revision + 1); setSyncState(payload.mode === 'memory' ? 'local' : 'saved'); } } catch { setSyncState('local'); } finally { localChangeRef.current = false; }
    }, 550); return () => window.clearTimeout(timer);
  }, [data, revision]);

  const mutate = (updater: (current: SystemMapData) => SystemMapData) => { if (!access.canEdit) return; localChangeRef.current = true; setData(updater); };
  const updateSystemName = (systemName: string) => mutate((current) => ({ ...current, systemName }));
  const updateVersion = (patch: Partial<SystemVersion>) => mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, ...patch } : item) }));
  const addVersion = () => {
    const module: SystemModule = { id: makeId('module'), name: '新根模組', code: 'MOD-01', summary: '補上這個模組的責任範圍。', health: 'healthy', color: '#63d8c7', spaces: [], topics: [], children: [] };
    const next: SystemVersion = { id: makeId('version'), label: '新版本', release: '待定', state: '候選', description: '補上這個版本的變更重點。', modules: [module], flows: [] };
    mutate((current) => ({ ...current, versions: [...current.versions, next] })); setVersionId(next.id); setSelectedModuleId(module.id); setSelectedTopicId(null); setFlowPeerId('');
  };
  const removeVersion = () => {
    if (data.versions.length <= 1) return; const nextVersions = data.versions.filter((item) => item.id !== version.id); const next = nextVersions[0];
    mutate((current) => ({ ...current, versions: current.versions.filter((item) => item.id !== version.id) })); setVersionId(next.id); setSelectedModuleId(next.modules[0]?.id ?? ''); setSelectedTopicId(next.modules[0]?.topics[0]?.id ?? null); setFlowPeerId('');
  };
  const updateModule = (patch: Partial<SystemModule>) => { if (!selectedModule) return; mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, modules: updateModuleTree(item.modules, selectedModule.id, patch) } : item) })); };
  const updateModuleById = (moduleId: string, patch: Partial<SystemModule>) => mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, modules: updateModuleTree(item.modules, moduleId, patch) } : item) }));
  const addRootModule = () => { const module: SystemModule = { id: makeId('module'), name: '新根模組', code: 'MOD-NEW', summary: '補上這個模組的責任範圍。', health: 'healthy', color: '#63d8c7', spaces: [], topics: [], children: [] }; updateVersion({ modules: [...version.modules, module] }); setSelectedModuleId(module.id); setSelectedTopicId(null); };
  const removeSelectedModule = () => {
    if (!selectedModule) return; const removedModules = [selectedModule, ...flattenModules(selectedModule.children ?? [])]; const removedIds = new Set(removedModules.flatMap((item) => [item.id, ...item.spaces.map((space) => space.id)])); const nextModules = removeModuleTree(version.modules, selectedModule.id); const nextSelection = selectedPath.at(-2) ?? flattenModules(nextModules)[0] ?? null;
    mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, modules: nextModules, flows: (item.flows ?? []).filter((flow) => !removedIds.has(flow.sourceId) && !removedIds.has(flow.targetId)) } : item) })); setSelectedModuleId(nextSelection?.id ?? ''); setSelectedTopicId(nextSelection?.topics[0]?.id ?? null); setFlowPeerId('');
  };
  const updateTopic = (topicId: string, patch: Partial<Topic>) => { if (selectedModule) updateModule({ topics: selectedModule.topics.map((topic) => topic.id === topicId ? { ...topic, ...patch, updatedAt: nowLabel() } : topic) }); };
  const addTopic = () => { if (!selectedModule) return; const topic: Topic = { id: makeId('topic'), title: '未命名主題', content: '在這裡補上背景、決定或待確認事項。', status: 'draft', updatedAt: nowLabel() }; updateModule({ topics: [...selectedModule.topics, topic] }); setSelectedTopicId(topic.id); };
  const removeTopic = (topicId: string) => { if (!selectedModule) return; const topics = selectedModule.topics.filter((topic) => topic.id !== topicId); updateModule({ topics }); setSelectedTopicId(topics[0]?.id ?? null); };
  const updateSpace = (spaceId: string, patch: Partial<TempSpace>) => { if (selectedModule) updateModule({ spaces: selectedModule.spaces.map((space) => space.id === spaceId ? { ...space, ...patch } : space) }); };
  const updateSpaceQuantity = (spaceId: string, quantity: number) => {
    const space = selectedModule?.spaces.find((item) => item.id === spaceId); if (!space) return;
    const normalized = Math.max(1, Math.floor(quantity) || 1);
    updateSpace(spaceId, { quantity: normalized, instanceCounts: Array.from({ length: normalized }, (_, index) => instanceCount(space, index)) });
  };
  const updateInstanceCount = (spaceId: string, instanceIndex: number, count: number) => {
    const space = selectedModule?.spaces.find((item) => item.id === spaceId); if (!space) return;
    const counts = Array.from({ length: spaceQuantity(space) }, (_, index) => instanceCount(space, index));
    counts[instanceIndex] = Math.max(0, Math.floor(count) || 0); updateSpace(spaceId, { instanceCounts: counts });
  };
  const addSpace = () => { if (!selectedModule) return; const space = { id: makeId('space'), name: '新暫存空間', kind: 'Redis', detail: '補上容量、TTL 或用途。', quantity: 1, instanceCounts: [0] }; updateModule({ spaces: [...selectedModule.spaces, space] }); setExpandedSpaceEditors((current) => new Set(current).add(space.id)); };
  const removeSpace = (spaceId: string) => { if (!selectedModule) return; mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, modules: updateModuleTree(item.modules, selectedModule.id, { spaces: selectedModule.spaces.filter((space) => space.id !== spaceId) }), flows: (item.flows ?? []).filter((flow) => flow.sourceId !== spaceId && flow.targetId !== spaceId) } : item) })); };
  const addChildModule = () => {
    if (!selectedModule) return;
    const child: SystemModule = { id: makeId('module'), name: '新子模組', code: `${selectedModule.code}-SUB`, summary: '補上這個子模組的責任範圍。', health: 'healthy', color: selectedModule.color, spaces: [], topics: [], children: [] };
    updateModule({ children: [...(selectedModule.children ?? []), child] });
    setSelectedModuleId(child.id); setSelectedTopicId(null);
  };
  const addPeerModule = () => {
    if (!selectedModule) return;
    const parent = selectedPath.at(-2);
    const peer: SystemModule = { id: makeId('module'), name: '新同層模組', code: `${selectedModule.code}-PEER`, summary: '補上這個模組的責任範圍。', health: 'healthy', color: selectedModule.color, spaces: [], topics: [], children: [] };
    mutate((current) => ({
      ...current,
      versions: current.versions.map((item) => {
        if (item.id !== version.id) return item;
        if (!parent) return { ...item, modules: [...item.modules, peer] };
        const currentParent = findModule(item.modules, parent.id);
        return currentParent ? { ...item, modules: updateModuleTree(item.modules, parent.id, { children: [...(currentParent.children ?? []), peer] }) } : item;
      }),
    }));
    setSelectedModuleId(peer.id); setSelectedTopicId(null);
  };
  const moveModule = (nextParentId: string) => {
    if (!selectedModule) return;
    const currentParentId = selectedPath.at(-2)?.id ?? 'root';
    if (nextParentId === currentParentId) return;
    mutate((current) => ({
      ...current,
      versions: current.versions.map((item) => {
        if (item.id !== version.id) return item;
        const moving = findModule(item.modules, selectedModule.id);
        if (!moving) return item;
        const withoutMoving = removeModuleTree(item.modules, moving.id);
        if (nextParentId === 'root') return { ...item, modules: [...withoutMoving, moving] };
        const nextParent = findModule(withoutMoving, nextParentId);
        if (!nextParent) return item;
        return { ...item, modules: updateModuleTree(withoutMoving, nextParent.id, { children: [...(nextParent.children ?? []), moving] }) };
      }),
    }));
  };
  const updateFlow = (flowId: string, patch: Partial<DataFlow>) => updateVersion({ flows: (version.flows ?? []).map((flow) => flow.id === flowId ? { ...flow, ...patch } : flow) });
  const removeFlow = (flowId: string) => updateVersion({ flows: (version.flows ?? []).filter((flow) => flow.id !== flowId) });
  const addFlow = () => {
    if (!selectedModule || !flowPeerId) return;
    const peerModule = findModule(version.modules, flowPeerId); const peerSpace = findSpaceEndpoint(version.modules, flowPeerId);
    if (flowDirection === 'upstream' && (!peerModule || peerModule.id === selectedModule.id)) return;
    if (flowDirection === 'downstream' && (!peerModule && !peerSpace || peerModule?.id === selectedModule.id)) return;
    const sourceId = flowDirection === 'upstream' ? flowPeerId : selectedModule.id;
    const targetId = flowDirection === 'upstream' ? selectedModule.id : flowPeerId;
    if ((version.flows ?? []).some((flow) => flow.sourceId === sourceId && flow.targetId === targetId)) return;
    updateVersion({ flows: [...(version.flows ?? []), { id: makeId('flow'), sourceId, targetId, label: '' }] }); setFlowPeerId('');
  };
  const chooseVersion = (id: string) => { const next = data.versions.find((item) => item.id === id); if (!next) return; setVersionId(id); setSelectedModuleId(next.modules[0]?.id ?? ''); setSelectedTopicId(next.modules[0]?.topics[0]?.id ?? null); setFlowPeerId(''); };
  const allModules = useMemo(() => flattenModules(version.modules), [version]);
  const parentOptions = useMemo(() => {
    if (!selectedModule) return [];
    const invalidIds = new Set([selectedModule.id, ...flattenModules(selectedModule.children ?? []).map((item) => item.id)]);
    return allModules.filter((item) => !invalidIds.has(item.id)).map((item) => ({ id: item.id, label: findModulePath(version.modules, item.id).map((part) => part.name).join(' / ') }));
  }, [allModules, selectedModule, version.modules]);
  const currentParentId = selectedPath.at(-2)?.id ?? 'root';
  const moduleFlowCandidates = useMemo(() => allModules.filter((item) => item.id !== selectedModule?.id).map((item) => ({ id: item.id, type: 'module' as const, label: findModulePath(version.modules, item.id).map((part) => part.name).join(' / ') })), [allModules, selectedModule?.id, version.modules]);
  const spaceFlowCandidates = useMemo(() => flattenSpaceEndpoints(version.modules).map((entry) => ({ id: entry.space.id, type: 'space' as const, label: `${entry.path.map((part) => part.name).join(' / ')} / ${entry.space.name}（暫存群組）` })), [version.modules]);
  const flowBuilderCandidates = flowDirection === 'upstream' ? moduleFlowCandidates : [...moduleFlowCandidates, ...spaceFlowCandidates];
  const selectedFlows = useMemo(() => (version.flows ?? []).filter((flow) => flow.sourceId === selectedModule?.id || flow.targetId === selectedModule?.id || findSpaceEndpoint(version.modules, flow.targetId)?.owner.id === selectedModule?.id), [selectedModule?.id, version.flows, version.modules]);
  const visibleModules = useMemo(() => filterModuleTree(version.modules, query.trim().toLowerCase(), healthFilter, searchScope), [healthFilter, query, searchScope, version.modules]);
  const healthCounts = useMemo(() => allModules.reduce((counts, module) => ({ ...counts, [module.health]: counts[module.health] + 1 }), { healthy: 0, watch: 0, risk: 0 } as Record<ModuleHealth, number>), [allModules]);
  const totalRecords = useMemo(() => version.modules.reduce((sum, module) => sum + moduleRecordCount(module), 0), [version.modules]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext; if (!modelContext?.registerTool) return; const lifecycle = new AbortController();
    const registration = modelContext.registerTool({ name: 'open_system_module', title: '開啟系統模組', description: '切換到指定系統版本，並在視覺化地圖中開啟任意層級的模組文件面板。', inputSchema: { type: 'object', properties: { versionId: { type: 'string' }, moduleId: { type: 'string' } }, required: ['versionId', 'moduleId'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, async execute(input: unknown) { const value = input as { versionId?: string; moduleId?: string }; const targetVersion = data.versions.find((item) => item.id === value.versionId); const targetModule = targetVersion ? findModule(targetVersion.modules, value.moduleId ?? '') : undefined; if (!targetVersion || !targetModule) throw new Error('找不到指定的版本或模組。'); setVersionId(targetVersion.id); setSelectedModuleId(targetModule.id); setSelectedTopicId(targetModule.topics[0]?.id ?? null); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); return { version: targetVersion.label, module: targetModule.name, topics: targetModule.topics.length }; } }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined); return () => lifecycle.abort();
  }, [data.versions]);

  const exportVersion = (format: 'md' | 'html' | 'json' | 'backup') => { const exportedAt = new Date().toISOString(); const versionBase = safeFileName(`${data.systemName}-${version.label}`); if (format === 'md') downloadFile(`${versionBase}.md`, versionMarkdown(version, data.systemName, exportedAt), 'text/markdown;charset=utf-8'); if (format === 'html') downloadFile(`${versionBase}.html`, versionHtml(version, data.systemName, exportedAt, flowLayout), 'text/html;charset=utf-8'); if (format === 'json') downloadFile(`${safeFileName(data.systemName)}-完整系統報表.json`, fullSystemJson(data, exportedAt), 'application/json;charset=utf-8'); if (format === 'backup') downloadFile(`${safeFileName(data.systemName)}-資料庫備份.json`, databaseBackupJson(data, exportedAt), 'application/json;charset=utf-8'); };
  const selectImportFile = async (file: File | undefined) => {
    setImportedBackup(null); setImportError(''); setImportFileName(file?.name ?? '');
    if (!file) return;
    if (file.size > 1_000_000) { setImportError('備份檔案超過 1 MB，無法匯入。'); return; }
    try {
      const parsed = parseSystemBackup(JSON.parse(await file.text()));
      if (JSON.stringify(parsed).length > 500_000) throw new Error('備份內容超過資料庫可儲存的 500 KB。');
      setImportedBackup(parsed); const source = parsed.versions[0]; setImportSourceVersionId(source.id); setImportVersionName(source.label);
    } catch (error) { setImportError(error instanceof Error ? error.message : '無法讀取備份檔案。'); }
  };
  const applyImport = () => {
    if (!importedBackup) return;
    if (importMode === 'replace') {
      const first = importedBackup.versions[0]; mutate(() => importedBackup); setVersionId(first.id); setSelectedModuleId(first.modules[0]?.id ?? ''); setSelectedTopicId(first.modules[0]?.topics[0]?.id ?? null);
    } else {
      const source = importedBackup.versions.find((item) => item.id === importSourceVersionId); if (!source || !importVersionName.trim()) { setImportError('請選擇來源版本並填寫匯入後的版本名稱。'); return; }
      const imported = cloneImportedVersion(source, importVersionName); const nextData = { ...data, versions: [...data.versions, imported] };
      if (JSON.stringify(nextData).length > 500_000) { setImportError('加入這個版本後會超過資料庫 500 KB 上限。'); return; }
      mutate(() => nextData); setVersionId(imported.id); setSelectedModuleId(imported.modules[0]?.id ?? ''); setSelectedTopicId(imported.modules[0]?.topics[0]?.id ?? null);
    }
    setFlowPeerId(''); setImportOpen(false); setImportedBackup(null); setImportFileName(''); setImportError('');
  };
  const syncLabel = syncState === 'saving' ? '儲存中…' : syncState === 'saved' ? '共同編輯 · 已同步' : syncState === 'conflict' ? '已載入其他人的更新' : syncState === 'loading' ? '連線中…' : '本機預覽模式';

  return <main className="system-shell" data-can-edit={access.canEdit} aria-busy={!accessReady}>
    {access.canManageAccess && access.email ? <AccessManager open={accessOpen} onOpenChange={setAccessOpen} currentEmail={access.email.toLowerCase()} /> : null}
    <header className="topbar"><div className="brand-block"><div className="brand-symbol" aria-hidden="true"><Layers3 /></div><div><p className="eyebrow">SYSTEM MAP</p><h1>{data.systemName}</h1></div></div><div className="topbar-actions"><span className={`sync-state ${syncState}`}><i />{syncLabel}</span><span className={`account-state ${access.role}`}><UserRound /><span><strong>{access.displayName}</strong><small>{accessRoleLabel[access.role]}</small></span></span>{access.canManageAccess ? <Button type="button" variant="outline" className="export-button" onClick={() => setAccessOpen(true)}><ShieldCheck />權限管理</Button> : null}{access.authenticated ? <a className="account-link" href={access.signOutPath} target="_top"><LogOut />登出</a> : <a className="account-link primary" href={access.signInPath} target="_top"><LogIn />登入</a>}{access.canEdit ? <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogTrigger render={<Button variant="outline" className="export-button" />}><Upload />匯入備份</DialogTrigger><DialogContent className="backup-dialog"><DialogHeader><DialogTitle>匯入資料庫備份</DialogTitle><DialogDescription>可完整還原整個資料庫，或挑選一個備份版本，以新名稱加入目前系統。</DialogDescription></DialogHeader><div className="backup-form"><label className="backup-file"><span>備份檔案</span><input type="file" accept="application/json,.json" onChange={(event) => void selectImportFile(event.target.files?.[0])} /><strong>{importFileName || '選擇 JSON 備份檔'}</strong></label>{importedBackup ? <><div className="backup-summary"><Database /><span><strong>{importedBackup.systemName}</strong><small>{importedBackup.versions.length} 個系統版本 · {importedBackup.versions.reduce((sum, item) => sum + flattenModules(item.modules).length, 0)} 個模組</small></span></div><div className="backup-field"><span>匯入方式</span><Select value={importMode} onValueChange={(value) => value && setImportMode(value as 'append' | 'replace')}><SelectTrigger aria-label="選擇匯入方式"><SelectValue>{importMode === 'append' ? '新增為系統版本' : '完整取代目前資料庫'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false}><SelectItem value="append">新增為系統版本</SelectItem><SelectItem value="replace">完整取代目前資料庫</SelectItem></SelectContent></Select></div>{importMode === 'append' ? <><div className="backup-field"><span>來源版本</span><Select value={importSourceVersionId} onValueChange={(value) => { if (!value) return; setImportSourceVersionId(value); const source = importedBackup.versions.find((item) => item.id === value); if (source) setImportVersionName(source.label); }}><SelectTrigger aria-label="選擇備份中的系統版本"><SelectValue>{importedBackup.versions.find((item) => item.id === importSourceVersionId)?.label ?? '選擇版本'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false}>{importedBackup.versions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.state}</SelectItem>)}</SelectContent></Select></div><label htmlFor="import-version-name"><span>匯入後的版本名稱</span><Input id="import-version-name" value={importVersionName} onChange={(event) => setImportVersionName(event.target.value)} /></label></> : <p className="backup-warning">目前所有版本會被備份內容取代。執行前請先匯出一份最新資料庫備份。</p>}</> : null}{importError ? <p className="backup-error" role="alert">{importError}</p> : null}</div><DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>取消</DialogClose><Button type="button" variant={importMode === 'replace' ? 'destructive' : 'default'} disabled={!importedBackup || importMode === 'append' && !importVersionName.trim()} onClick={applyImport}>{importMode === 'replace' ? '完整還原' : '匯入版本'}</Button></DialogFooter></DialogContent></Dialog> : null}<DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" className="export-button" />}><Download />匯出</DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => exportVersion('md')}><FileText />目前版本 Markdown</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('html')}><Code2 />目前版本 HTML</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('json')}><FileJson />完整系統 JSON 報表</DropdownMenuItem>{access.canEdit ? <DropdownMenuItem onClick={() => exportVersion('backup')}><Database />完整資料庫備份</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu></div></header>
    <div className={`access-banner ${access.authenticated ? 'signed-in' : 'guest'}`}><LockKeyhole /><span><strong>{access.authenticated ? access.role === 'unassigned' ? '帳號尚未取得授權' : `目前為${accessRoleLabel[access.role]}` : '目前以訪客瀏覽'}</strong><small>{access.authenticated ? access.canEdit ? '可查看並編輯已授權的全部資訊。' : '僅顯示管理員開放給你的資訊。' : '登入後可依帳號權限查看更多內容。'}</small></span>{!access.authenticated ? <a href={access.signInPath} target="_top">登入查看權限內容</a> : null}</div>
    {accessReady && syncState !== 'loading' ? <>
    <section className="version-strip" aria-label="系統版本">
      <div className="version-selector"><span className="field-label">系統版本</span><Select value={version.id} onValueChange={(value) => value && chooseVersion(value)}><SelectTrigger aria-label="選擇系統版本"><SelectValue>{version.label} · {version.state}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{data.versions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.state}</SelectItem>)}</SelectContent></Select>{access.canEdit ? <><Button type="button" variant="outline" size="sm" className="version-add-button" onClick={addVersion}><Plus />新增</Button>
        <Dialog><DialogTrigger render={<Button type="button" variant="outline" size="sm" className="version-edit-button" />}><Settings2 />編輯</DialogTrigger><DialogContent className="version-edit-dialog"><DialogHeader><DialogTitle>編輯系統與版本</DialogTitle><DialogDescription>這些名稱與說明會同步顯示在地圖及匯出文件。</DialogDescription></DialogHeader><div className="version-form">
          <label htmlFor="system-name"><span>系統名稱</span><Input id="system-name" value={data.systemName} onChange={(event) => updateSystemName(event.target.value)} /></label>
          <label htmlFor={`version-label-${version.id}`}><span>版本名稱</span><Input id={`version-label-${version.id}`} value={version.label} onChange={(event) => updateVersion({ label: event.target.value })} /></label>
          <label htmlFor={`version-release-${version.id}`}><span>發布時間</span><Input id={`version-release-${version.id}`} value={version.release} onChange={(event) => updateVersion({ release: event.target.value })} /></label>
          <label><span>版本狀態</span><Select value={version.state} onValueChange={(value) => value && updateVersion({ state: value as SystemVersion['state'] })}><SelectTrigger aria-label="版本狀態"><SelectValue>{version.state}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="現行">現行</SelectItem><SelectItem value="候選">候選</SelectItem><SelectItem value="封存">封存</SelectItem></SelectContent></Select></label>
          <label className="version-description-field" htmlFor={`version-description-${version.id}`}><span>版本說明</span><Textarea id={`version-description-${version.id}`} value={version.description} onChange={(event) => updateVersion({ description: event.target.value })} /></label>
        </div><div className="version-danger"><DeleteAction name={`版本「${version.label}」`} label="刪除版本" description="這個版本內的模組、資料流、暫存空間與主題都會一起刪除。" onConfirm={removeVersion} className="danger-button" disabled={data.versions.length <= 1} /><small>{data.versions.length <= 1 ? '至少需要保留一個版本。' : '刪除後無法復原。'}</small></div></DialogContent></Dialog></> : null}
      </div>
      <div className="version-note"><Badge variant="outline">{version.release}</Badge><span>{version.description}</span></div><div className="version-metrics" aria-label="版本摘要"><span><strong>{allModules.length}</strong> 模組</span><span><strong>{allModules.reduce((sum, module) => sum + moduleSpaceCount(module), 0)}</strong> 暫存實例</span><span><strong>{totalRecords}</strong> 筆資料</span></div>
    </section>
    <div className="workspace">
      <section className="map-panel" aria-label="系統模組視覺化"><div className="map-toolbar"><div className="search-box"><Search aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchScope === 'topics' ? '搜尋討論標題或內容…' : searchScope === 'modules' ? '搜尋模組或暫存實例…' : access.canViewTopics ? '搜尋模組、暫存或討論…' : '搜尋公開模組資訊…'} aria-label="搜尋系統狀態" /></div><div className="toolbar-filters"><div className="filter-set scope-filter" aria-label="搜尋內容範圍">{([['all', '全部內容'], ['modules', '模組'], ...(access.canViewTopics ? [['topics', '討論'] as const] : [])] as const).map(([scope, label]) => <button key={scope} type="button" className={searchScope === scope ? 'active' : ''} onClick={() => setSearchScope(scope)}>{label}</button>)}</div><div className="filter-set" aria-label="模組健康狀態篩選">{(['all', 'healthy', 'watch', 'risk'] as const).map((filter) => <button key={filter} type="button" className={healthFilter === filter ? 'active' : ''} onClick={() => setHealthFilter(filter)}>{filter === 'all' ? '全部狀態' : healthMeta[filter].label}{filter !== 'all' ? <b>{healthCounts[filter]}</b> : null}</button>)}</div></div></div>
        <div className="system-canvas"><div className="canvas-header"><div><span className="canvas-kicker">LIVE ARCHITECTURE / {version.label}</span><h2>模組、資料流與暫存狀態</h2></div><span className="canvas-hint"><CircleDot />{access.canEdit ? '點擊模組編輯狀態' : '點擊模組查看已開放資訊'}</span></div>
          <UnifiedFlowMap modules={visibleModules} flows={version.flows ?? []} selectedId={selectedModule?.id ?? ''} layout={flowLayout} canEdit={access.canEdit} onLayoutChange={chooseFlowLayout} onHealthChange={(moduleId, health) => updateModuleById(moduleId, { health })} onAddRoot={addRootModule} onSelect={(target) => { setSelectedModuleId(target.id); setSelectedTopicId(target.topics[0]?.id ?? null); setFlowPeerId(''); }} />
          {visibleModules.length === 0 ? <div className="map-empty"><Search /><strong>沒有符合的內容</strong><span>試著清除搜尋、切換內容範圍或狀態。</span></div> : null}</div>
        <footer className="attention-bar"><div><Database /><span><strong>{allModules.reduce((sum, module) => sum + moduleSpaceCount(module), 0)} 個暫存實例</strong>，目前共 {totalRecords} 筆資料；空杯代表 0 筆。</span></div><button type="button" onClick={() => setHealthFilter('risk')}>只看風險模組 <ChevronRight /></button></footer></section>
      {selectedModule ? <aside className="detail-panel" aria-label={`${selectedModule.name} 詳細資訊`}>
        <div className="module-breadcrumb" aria-label="模組層級">{selectedPath.map((item, index) => <span key={item.id}>{index ? <ChevronRight /> : null}<button type="button" onClick={() => { setSelectedModuleId(item.id); setSelectedTopicId(item.topics[0]?.id ?? null); }}>{item.name}</button></span>)}</div>
        <div className="detail-head" style={{ '--module-color': selectedModule.color } as React.CSSProperties}>
          <div className="detail-level"><span className="detail-code">第 {selectedPath.length} 層</span><span className="detail-head-actions"><span className={`health-mark ${healthMeta[selectedModule.health].tone}`}>{healthMeta[selectedModule.health].label}</span>{access.canEdit ? <DeleteAction name={`模組「${selectedModule.name}」`} description={`將一併刪除它的 ${(selectedModule.children ?? []).length} 個直接子模組、暫存空間、主題，以及所有相連的資料流。`} onConfirm={removeSelectedModule} className="module-delete" /> : null}</span></div>
          <label className="detail-field" htmlFor={`module-name-${selectedModule.id}`}><span>模組名稱</span><Input id={`module-name-${selectedModule.id}`} disabled={!access.canEdit} className="module-name-input" value={selectedModule.name} onChange={(event) => updateModule({ name: event.target.value })} /></label>
          <div className="detail-compact-fields">
            <label className="detail-field" htmlFor={`module-code-${selectedModule.id}`}><span>模組代碼</span><Input id={`module-code-${selectedModule.id}`} disabled={!access.canEdit} value={selectedModule.code} onChange={(event) => updateModule({ code: event.target.value })} /></label>
            <label className="detail-field"><span>健康狀態</span><Select value={selectedModule.health} disabled={!access.canEdit} onValueChange={(value) => value && updateModule({ health: value as ModuleHealth })}><SelectTrigger aria-label="模組健康狀態"><SelectValue>{healthMeta[selectedModule.health].label}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="healthy">穩定</SelectItem><SelectItem value="watch">留意</SelectItem><SelectItem value="risk">風險</SelectItem></SelectContent></Select></label>
            <label className="detail-field color-field" htmlFor={`module-color-${selectedModule.id}`}><span>識別色</span><input id={`module-color-${selectedModule.id}`} type="color" disabled={!access.canEdit} value={selectedModule.color} onChange={(event) => updateModule({ color: event.target.value })} /></label>
          </div>
          {access.canViewDetails ? <label className="detail-field" htmlFor={`module-summary-${selectedModule.id}`}><span>責任與說明</span><Textarea id={`module-summary-${selectedModule.id}`} disabled={!access.canEdit} value={selectedModule.summary} onChange={(event) => updateModule({ summary: event.target.value })} /></label> : <div className="restricted-field"><LockKeyhole /><span><strong>模組說明未開放</strong><small>請登入或聯絡管理員調整權限。</small></span></div>}
        </div>
        <Tabs key={`${version.id}-${access.role}-${access.canViewTopics}-${access.canViewSpaces}-${access.canViewFlows}`} defaultValue={access.canViewTopics ? 'topics' : access.canViewSpaces ? 'spaces' : access.canViewFlows ? 'flows' : 'children'} className="detail-tabs">
          <TabsList>{access.canViewTopics ? <TabsTrigger value="topics">主題 <b>{selectedModule.topics.length}</b></TabsTrigger> : null}{access.canViewSpaces ? <TabsTrigger value="spaces">暫存 <b>{moduleSpaceCount(selectedModule)}</b></TabsTrigger> : null}{access.canViewFlows ? <TabsTrigger value="flows">資料流 <b>{selectedFlows.length}</b></TabsTrigger> : null}<TabsTrigger value="children">結構 <b>{(selectedModule.children ?? []).length}</b></TabsTrigger></TabsList>
          <TabsContent value="topics" className="tab-body">
            <div className="tab-actions"><p>點選討論後，就在該項目下方{access.canEdit ? '編輯' : '閱讀'}。</p>{access.canEdit ? <Button size="sm" onClick={addTopic}><Plus />新增主題</Button> : null}</div>
            <div className="topic-list">{selectedModule.topics.map((topic) => { const Icon = topicMeta[topic.status].icon; const active = selectedTopicId === topic.id; return <article className={`topic-item ${active ? 'active' : ''}`} key={topic.id}>
              <button type="button" className={`topic-row ${active ? 'active' : ''}`} aria-expanded={active} onClick={() => setSelectedTopicId(active ? null : topic.id)}><Icon /><span><strong>{topic.title}</strong><small>{topic.updatedAt}</small></span><Badge className={topic.status}>{topicMeta[topic.status].label}</Badge><ChevronRight className="topic-chevron" /></button>
              {active ? <div className="topic-editor"><div className="editor-heading"><span>{access.canEdit ? '編輯內容' : '討論內容'}</span><span className="editor-heading-actions"><Select value={topic.status} disabled={!access.canEdit} onValueChange={(value) => value && updateTopic(topic.id, { status: value as TopicStatus })}><SelectTrigger aria-label="主題狀態"><SelectValue>{topicMeta[topic.status].label}</SelectValue></SelectTrigger><SelectContent align="end" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="draft">草稿</SelectItem><SelectItem value="discussion">討論中</SelectItem><SelectItem value="reviewed">已 Review</SelectItem></SelectContent></Select>{access.canEdit ? <DeleteAction name={`主題「${topic.title}」`} description="這則主題的內容與狀態會永久刪除。" onConfirm={() => removeTopic(topic.id)} className="inline-delete" /> : null}</span></div><label><span>主題</span><Input value={topic.title} disabled={!access.canEdit} onChange={(event) => updateTopic(topic.id, { title: event.target.value })} /></label><label><span>內容</span><Textarea value={topic.content} disabled={!access.canEdit} onChange={(event) => updateTopic(topic.id, { content: event.target.value })} /></label>{access.canEdit ? <p className="autosave-note"><Check />自動同步變更，不鎖定編輯者</p> : null}</div> : null}
            </article>; })}{!selectedModule.topics.length ? <div className="detail-empty"><MessageCircle /><span>還沒有已開放的主題</span>{access.canEdit ? <button type="button" onClick={addTopic}>建立第一則</button> : null}</div> : null}</div>
          </TabsContent>
          <TabsContent value="spaces" className="tab-body"><div className="tab-actions"><p>同一基礎名稱的實例可展開或折疊。</p>{access.canEdit ? <Button size="sm" onClick={addSpace}><Plus />新增暫存區</Button> : null}</div><div className="space-list editable">{selectedModule.spaces.map((space, index) => { const instancesExpanded = expandedSpaceEditors.has(space.id); const total = expandedSpaceNames(space).reduce((sum, _, instanceIndex) => sum + instanceCount(space, instanceIndex), 0); return <article key={space.id}><span className="space-no">{String(index + 1).padStart(2, '0')}</span><Archive /><div className="space-fields"><label><span>基礎名稱</span><Input value={space.name} disabled={!access.canEdit} onChange={(event) => updateSpace(space.id, { name: event.target.value })} /></label><label><span>類型</span><Input value={space.kind} disabled={!access.canEdit} onChange={(event) => updateSpace(space.id, { kind: event.target.value })} /></label><label className="space-quantity-field"><span>數量</span><Input type="number" min={1} step={1} inputMode="numeric" disabled={!access.canEdit} value={spaceQuantity(space)} onChange={(event) => updateSpaceQuantity(space.id, Number(event.target.value))} /></label><label className="space-detail-field"><span>容量、TTL 或用途</span><Input value={space.detail} disabled={!access.canEdit} onChange={(event) => updateSpace(space.id, { detail: event.target.value })} /></label><button type="button" className="space-instance-toggle" aria-expanded={instancesExpanded} onClick={() => setExpandedSpaceEditors((current) => { const next = new Set(current); if (next.has(space.id)) next.delete(space.id); else next.add(space.id); return next; })}><span><Archive />{space.name} 的 {spaceQuantity(space)} 個實例</span><small>共 {total} 筆</small><ChevronRight /></button>{instancesExpanded ? <div className="instance-count-grid">{expandedSpaceNames(space).map((name, instanceIndex) => <div className="instance-count-editor" key={`${space.id}-instance-${instanceIndex}`}><CacheVessel name={name} count={instanceCount(space, instanceIndex)} compact /><label htmlFor={`${space.id}-count-${instanceIndex}`}><span>資料筆數</span><Input id={`${space.id}-count-${instanceIndex}`} type="number" min={0} step={1} inputMode="numeric" disabled={!access.canEdit} value={instanceCount(space, instanceIndex)} onChange={(event) => updateInstanceCount(space.id, instanceIndex, Number(event.target.value))} /></label></div>)}</div> : null}</div>{access.canEdit ? <DeleteAction name={`暫存空間「${space.name}」`} description="這個暫存空間的所有實例與資料筆數設定都會刪除。" onConfirm={() => removeSpace(space.id)} className="space-delete" /> : null}</article>; })}{!selectedModule.spaces.length ? <div className="detail-empty"><Archive /><span>這個模組尚無已開放的暫存空間</span>{access.canEdit ? <button type="button" onClick={addSpace}>加入第一個</button> : null}</div> : null}</div>{access.canEdit ? <p className="autosave-note"><Check />資料量會同步到狀態圖與匯出文件</p> : null}</TabsContent>
          <TabsContent value="flows" className="tab-body">
            <div className="flow-editor-intro"><Waypoints /><div><strong>資料流上下游</strong><p>下游節點可以是另一個模組或暫存群組；連到暫存群組表示這個模組會把資料寫入該暫存區。</p></div></div>
            {access.canEdit ? <div className="flow-builder">
              <label><span>方向</span><Select value={flowDirection} onValueChange={(value) => { if (!value) return; setFlowDirection(value as 'upstream' | 'downstream'); setFlowPeerId(''); }}><SelectTrigger aria-label="資料流方向"><SelectValue>{flowDirection === 'upstream' ? '新增上游' : '新增下游'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="upstream">新增上游模組</SelectItem><SelectItem value="downstream">新增下游或暫存</SelectItem></SelectContent></Select></label>
              <label><span>連接節點</span><Select value={flowPeerId} onValueChange={(value) => setFlowPeerId(value ?? '')}><SelectTrigger aria-label="選擇資料流節點"><SelectValue placeholder="選擇節點">{flowBuilderCandidates.find((item) => item.id === flowPeerId)?.label ?? '選擇節點'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{flowBuilderCandidates.map((item) => <SelectItem key={item.id} value={item.id}>{item.type === 'space' ? <Archive /> : <Layers3 />}{item.label}</SelectItem>)}</SelectContent></Select></label>
              <Button type="button" onClick={addFlow} disabled={!flowPeerId}><Plus />新增關係</Button>
            </div> : null}
            <div className="flow-editor-list">{selectedFlows.map((flow) => { const outgoing = flow.sourceId === selectedModule.id; const targetSpace = findSpaceEndpoint(version.modules, flow.targetId); const incoming = !outgoing; const peerId = outgoing ? flow.targetId : flow.sourceId; const peer = resolveFlowEndpoint(version.modules, peerId); const candidates = outgoing ? [...moduleFlowCandidates, ...spaceFlowCandidates] : moduleFlowCandidates; const directionValue = targetSpace ? 'cache' : incoming ? 'upstream' : 'downstream'; return <article key={flow.id} className={targetSpace ? 'cache-flow' : incoming ? 'incoming' : 'outgoing'}><label className="flow-direction-field"><span>方向</span><Select value={directionValue} disabled={!access.canEdit || Boolean(targetSpace)} onValueChange={(value) => value && value !== 'cache' && updateFlow(flow.id, value === 'upstream' ? { sourceId: peerId, targetId: selectedModule.id } : { sourceId: selectedModule.id, targetId: peerId })}><SelectTrigger aria-label="修改資料流方向"><SelectValue>{targetSpace ? '寫入暫存' : incoming ? '上游輸入' : '下游輸出'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{targetSpace ? <SelectItem value="cache">寫入暫存</SelectItem> : <><SelectItem value="upstream">上游輸入</SelectItem><SelectItem value="downstream">下游輸出</SelectItem></>}</SelectContent></Select></label><label className="flow-peer"><span>{incoming ? '來源模組' : '連接節點'}</span><Select value={peerId} disabled={!access.canEdit} onValueChange={(value) => value && updateFlow(flow.id, incoming ? { sourceId: value } : { targetId: value })}><SelectTrigger aria-label="修改連接節點"><SelectValue>{peer?.path ?? peerId}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{candidates.map((item) => <SelectItem key={item.id} value={item.id}>{item.type === 'space' ? <Archive /> : <Layers3 />}{item.label}</SelectItem>)}</SelectContent></Select></label><label htmlFor={`flow-label-${flow.id}`}><span>傳遞內容</span><Input id={`flow-label-${flow.id}`} disabled={!access.canEdit} value={flow.label} placeholder={targetSpace ? '例如：寫入訂單快照' : '例如：訂單事件'} onChange={(event) => updateFlow(flow.id, { label: event.target.value })} /></label>{access.canEdit ? <DeleteAction name={`與「${peer?.name ?? peerId}」的資料流`} description="這條上下游關係會從完整資料流圖中移除。" onConfirm={() => removeFlow(flow.id)} className="inline-delete" /> : null}</article>; })}{!selectedFlows.length ? <div className="detail-empty"><Waypoints /><span>此模組尚未設定資料流</span></div> : null}</div>
          </TabsContent>
          <TabsContent value="children" className="tab-body">
            <div className="structure-intro"><GitBranch /><div><strong>模組層級</strong><p>{access.canEdit ? '可將目前模組移到另一個模組下方，或升為根層；會自動排除自己與子孫，避免循環。' : '此帳號可查看模組的上下層結構。'}</p></div></div>
            {access.canEdit ? <div className="module-settings">
              <label><span>上層模組</span><Select value={currentParentId} onValueChange={(value) => value && moveModule(value)}><SelectTrigger aria-label="選擇上層模組"><SelectValue>{currentParentId === 'root' ? '根層（無上層）' : findModulePath(version.modules, currentParentId).map((item) => item.name).join(' / ')}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="root">根層（無上層）</SelectItem>{parentOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></label>
              <div className="structure-actions"><Button type="button" variant="outline" size="sm" onClick={addPeerModule}><Plus />新增同層模組</Button><Button type="button" size="sm" onClick={addChildModule}><Plus />新增子模組</Button></div>
            </div> : null}
            <div className="child-list">{(selectedModule.children ?? []).map((child) => <button type="button" key={child.id} onClick={() => { setSelectedModuleId(child.id); setSelectedTopicId(child.topics[0]?.id ?? null); }}><Layers3 /><span><strong>{child.name}</strong><small>{child.code} · {(child.children ?? []).length} 子模組</small></span><ChevronRight /></button>)}{!(selectedModule.children ?? []).length ? <div className="detail-empty"><Layers3 /><span>這一層尚無子模組</span>{access.canEdit ? <button type="button" onClick={addChildModule}>加入第一個</button> : null}</div> : null}</div>
          </TabsContent>
        </Tabs>
      </aside> : null}
    </div>
    </> : <div className="access-loading"><ShieldCheck /><strong>正在確認瀏覽權限…</strong></div>}
  </main>;
}
