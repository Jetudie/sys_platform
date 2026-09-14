'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CircleDot, Clock3, Code2, Database, Download, FileJson, FileText, GitBranch, Layers3, MessageCircle, Plus, Search, Settings2, Trash2, Waypoints } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type TopicStatus = 'draft' | 'discussion' | 'reviewed';
type ModuleHealth = 'healthy' | 'watch' | 'risk';
type Topic = { id: string; title: string; content: string; status: TopicStatus; updatedAt: string };
type TempSpace = { id: string; name: string; kind: string; detail: string; quantity?: number; instanceCounts?: number[] };
type DataFlow = { id: string; sourceId: string; targetId: string; label: string };
type SystemModule = { id: string; name: string; code: string; summary: string; health: ModuleHealth; color: string; spaces: TempSpace[]; topics: Topic[]; children?: SystemModule[] };
type SystemVersion = { id: string; label: string; release: string; state: '現行' | '候選' | '封存'; description: string; modules: SystemModule[]; flows?: DataFlow[] };
type SystemMapData = { systemName: string; versions: SystemVersion[] };

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
const moduleRecordCount = (module: SystemModule): number => module.spaces.reduce((sum, space) => sum + expandedSpaceNames(space).reduce((spaceSum, _, index) => spaceSum + instanceCount(space, index), 0), 0) + (module.children ?? []).reduce((sum, child) => sum + moduleRecordCount(child), 0);
const moduleMatches = (module: SystemModule, query: string, filter: 'all' | ModuleHealth): boolean => {
  const text = `${module.name} ${module.code} ${module.summary} ${module.spaces.map((space) => `${expandedSpaceNames(space).join(' ')} ${space.kind}`).join(' ')} ${module.topics.map((topic) => `${topic.title} ${topic.content}`).join(' ')}`.toLowerCase();
  const ownMatch = (!query || text.includes(query)) && (filter === 'all' || module.health === filter);
  return ownMatch || (module.children ?? []).some((child) => moduleMatches(child, query, filter));
};

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function moduleMarkdown(module: SystemModule, depth = 2): string {
  const heading = '#'.repeat(Math.min(depth, 6));
  const childSection = (module.children ?? []).map((child) => moduleMarkdown(child, depth + 1)).join('\n\n');
  return `${heading} ${module.name} (${module.code})\n\n${module.summary}\n\n**狀態：** ${healthMeta[module.health].label}\n\n${heading}# 暫存空間\n\n${module.spaces.length ? module.spaces.flatMap((space) => expandedSpaceNames(space).map((name, index) => `- **${name}** · ${space.kind} · ${instanceCount(space, index)} 筆 — ${space.detail}`)).join('\n') : '- 無'}\n\n${heading}# 主題與決議\n\n${module.topics.length ? module.topics.map((topic) => `- **${topic.title}** · ${topicMeta[topic.status].label} · ${topic.updatedAt}\n  ${topic.content}`).join('\n') : '- 目前沒有主題。'}${childSection ? `\n\n${heading}# 子模組\n\n${childSection}` : ''}`;
}
function versionMarkdown(version: SystemVersion, systemName: string) {
  const flows = (version.flows ?? []).map((flow) => `- **${findModule(version.modules, flow.sourceId)?.name ?? flow.sourceId}** → **${findModule(version.modules, flow.targetId)?.name ?? flow.targetId}**${flow.label ? ` · ${flow.label}` : ''}`).join('\n') || '- 尚未設定資料流。';
  return `# ${systemName} — ${version.label}\n\n> ${version.release} · ${version.state}\n\n${version.description}\n\n## 模組資料流\n\n${flows}\n\n${version.modules.map((module) => moduleMarkdown(module)).join('\n\n---\n\n')}\n`;
}
function versionHtml(version: SystemVersion, systemName: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  const renderModule = (module: SystemModule, depth = 0): string => `<article style="margin-left:${depth * 22}px"><h2>${escape(module.name)} <small>${escape(module.code)}</small></h2><p>${escape(module.summary)}</p><h3>暫存空間</h3><ul>${module.spaces.flatMap((space) => expandedSpaceNames(space).map((name, index) => `<li><b>${escape(name)}</b> · ${escape(space.kind)} · ${instanceCount(space, index)} 筆 — ${escape(space.detail)}</li>`)).join('') || '<li>無</li>'}</ul><h3>主題與決議</h3>${module.topics.map((topic) => `<section><h4>${escape(topic.title)}</h4><span class="tag">${escape(topicMeta[topic.status].label)}</span><p>${escape(topic.content)}</p><small>${escape(topic.updatedAt)}</small></section>`).join('') || '<p>目前沒有主題。</p>'}${(module.children ?? []).map((child) => renderModule(child, depth + 1)).join('')}</article>`;
  const flows = (version.flows ?? []).map((flow) => `<li><b>${escape(findModule(version.modules, flow.sourceId)?.name ?? flow.sourceId)}</b> → <b>${escape(findModule(version.modules, flow.targetId)?.name ?? flow.targetId)}</b>${flow.label ? ` · ${escape(flow.label)}` : ''}</li>`).join('') || '<li>尚未設定資料流。</li>';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(systemName)} ${escape(version.label)}</title><style>body{max-width:880px;margin:48px auto;padding:0 24px;font:16px/1.7 system-ui;color:#172035}h1,h2,h3{line-height:1.25}article{border-top:1px solid #d8dde8;padding:24px 0}.tag{display:inline-block;padding:2px 8px;background:#eef2f7;border-radius:4px;font-size:13px}</style></head><body><h1>${escape(systemName)} — ${escape(version.label)}</h1><p>${escape(version.release)} · ${escape(version.state)}</p><p>${escape(version.description)}</p><h2>模組資料流</h2><ul>${flows}</ul>${version.modules.map((module) => renderModule(module)).join('')}</body></html>`;
}

function CacheVessel({ name, count, compact = false }: { name: string; count: number; compact?: boolean }) {
  const visibleBalls = Math.min(count, compact ? 6 : 12);
  return <span className={`cache-vessel ${count ? 'occupied' : 'empty'} ${compact ? 'compact' : ''}`} aria-label={`${name}，${count} 筆資料`}>
    <span className="vessel-label"><b>{name}</b><small>{count ? `${count} 筆` : '空'}</small></span>
    <span className="vessel-cup" aria-hidden="true"><span className="vessel-balls">{Array.from({ length: visibleBalls }, (_, index) => <i key={index} />)}</span>{count > visibleBalls ? <em>+{count - visibleBalls}</em> : null}</span>
  </span>;
}

const ownRecordCount = (module: SystemModule) => module.spaces.reduce((total, space) => total + expandedSpaceNames(space).reduce((sum, _, index) => sum + instanceCount(space, index), 0), 0);

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
  return <AlertDialog><AlertDialogTrigger disabled={disabled} render={<Button type="button" variant="ghost" size={label ? 'sm' : 'icon-sm'} className={className} aria-label={`刪除${name}`} disabled={disabled} />}><Trash2 />{label}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>刪除{name}？</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

type FlowPath = { id: string; label: string; d: string; labelX: number; labelY: number };

function UnifiedFlowMap({ modules, flows, selectedId, onSelect, onAddRoot }: { modules: SystemModule[]; flows: DataFlow[]; selectedId: string; onSelect: (module: SystemModule) => void; onAddRoot: () => void }) {
  const sceneRef = useRef<HTMLDivElement>(null); const nodeRefs = useRef(new Map<string, HTMLButtonElement>()); const [paths, setPaths] = useState<FlowPath[]>([]);
  const flat = useMemo(() => flattenModules(modules), [modules]); const visibleIds = useMemo(() => new Set(flat.map((module) => module.id)), [flat]);
  const visibleFlows = useMemo(() => flows.filter((flow) => visibleIds.has(flow.sourceId) && visibleIds.has(flow.targetId)), [flows, visibleIds]);
  const levels = useMemo(() => buildFlowLevels(modules, visibleFlows), [modules, visibleFlows]); const levelCount = Math.max(...levels.values(), 0) + 1;
  const columns = useMemo(() => Array.from({ length: levelCount }, (_, level) => flat.filter((module) => levels.get(module.id) === level)), [flat, levelCount, levels]);
  const measurePaths = useCallback(() => {
    const scene = sceneRef.current; if (!scene) return; const bounds = scene.getBoundingClientRect();
    setPaths(visibleFlows.flatMap((flow) => { const source = nodeRefs.current.get(flow.sourceId)?.getBoundingClientRect(); const target = nodeRefs.current.get(flow.targetId)?.getBoundingClientRect(); if (!source || !target) return [];
      const forward = target.left > source.left; const startX = (forward ? source.right : source.left) - bounds.left; const endX = (forward ? target.left : target.right) - bounds.left; const startY = source.top + source.height / 2 - bounds.top; const endY = target.top + target.height / 2 - bounds.top;
      const bend = forward ? Math.max(52, Math.abs(endX - startX) * .48) : 58; const d = forward ? `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}` : `M ${startX} ${startY} C ${startX - bend} ${startY}, ${endX + bend} ${endY}, ${endX} ${endY}`;
      return [{ id: flow.id, label: flow.label || '資料流', d, labelX: (startX + endX) / 2, labelY: (startY + endY) / 2 - 7 }]; }));
  }, [visibleFlows]);
  useEffect(() => { const frame = requestAnimationFrame(measurePaths); const observer = new ResizeObserver(measurePaths); if (sceneRef.current) observer.observe(sceneRef.current); nodeRefs.current.forEach((node) => observer.observe(node)); return () => { cancelAnimationFrame(frame); observer.disconnect(); }; }, [flat, measurePaths]);
  return <section className="unified-flow" aria-label="完整模組資料流與資料筆數">
    <div className="unified-flow-head"><div><span><Waypoints />完整資料流</span><strong>從上游到下游，直接查看每個模組的資料量</strong></div><div className="flow-head-actions"><div className="flow-legend"><span><i className="legend-flow" />資料流</span><span><i className="legend-record" />資料筆數</span></div><Button type="button" size="sm" onClick={onAddRoot}><Plus />新增根模組</Button></div></div>
    <div className="flow-scroll"><div ref={sceneRef} className="flow-scene" style={{ '--flow-columns': levelCount } as React.CSSProperties}>
      <svg className="flow-lines" aria-hidden="true"><defs><marker id="flow-arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{paths.map((path) => <g key={path.id}><path className="flow-line" d={path.d} markerEnd="url(#flow-arrow-head)" /><text x={path.labelX} y={path.labelY} textAnchor="middle">{path.label}</text></g>)}</svg>
      {columns.map((column, level) => <div className="flow-column" key={level}><div className="flow-column-head"><span>階段 {String(level + 1).padStart(2, '0')}</span><b>{column.reduce((sum, module) => sum + ownRecordCount(module), 0)} 筆</b></div>{column.map((module) => { const path = findModulePath(modules, module.id); const incomingCount = visibleFlows.filter((flow) => flow.targetId === module.id).length; const outgoingCount = visibleFlows.filter((flow) => flow.sourceId === module.id).length; return <button ref={(node) => { if (node) nodeRefs.current.set(module.id, node); else nodeRefs.current.delete(module.id); }} type="button" className={`graph-module ${selectedId === module.id ? 'selected' : ''}`} style={{ '--module-color': module.color } as React.CSSProperties} key={module.id} onClick={() => onSelect(module)}>
        <span className="graph-module-top"><small>{module.code}</small><span className={`health-mark ${healthMeta[module.health].tone}`}>{healthMeta[module.health].label}</span></span><strong>{module.name}</strong>{path.length > 1 ? <span className="graph-module-path">{path.slice(0, -1).map((item) => item.name).join(' / ')} /</span> : <span className="graph-module-path">根層模組</span>}
        <span className="graph-record-total"><Database /><b>{ownRecordCount(module)}</b><small>筆資料</small>{(module.children ?? []).length ? <em>含子模組 {moduleRecordCount(module)} 筆</em> : null}</span>
        <span className="graph-cache-rack">{module.spaces.flatMap((space) => expandedSpaceNames(space).map((name, index) => <CacheVessel compact key={`${space.id}-${index}`} name={name} count={instanceCount(space, index)} />))}{!module.spaces.length ? <span className="no-cache-state compact"><Database />無暫存空間</span> : null}</span>
        <span className="graph-flow-count"><span><ArrowLeft />{incomingCount} 上游</span><span>{outgoingCount} 下游<ArrowRight /></span></span>
      </button>; })}</div>)}
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
  const [flowDirection, setFlowDirection] = useState<'upstream' | 'downstream'>('downstream');
  const [flowPeerId, setFlowPeerId] = useState('');
  const [syncState, setSyncState] = useState<'loading' | 'saved' | 'saving' | 'local' | 'conflict'>('loading');
  const [revision, setRevision] = useState(0);
  const hydratedRef = useRef(false); const localChangeRef = useRef(false);
  const version = useMemo(() => data.versions.find((item) => item.id === versionId) ?? data.versions[0], [data, versionId]);
  const selectedModule = useMemo(() => findModule(version.modules, selectedModuleId) ?? version.modules[0] ?? null, [version, selectedModuleId]);
  const selectedPath = useMemo(() => findModulePath(version.modules, selectedModuleId), [version, selectedModuleId]);
  const selectedTopic = useMemo(() => selectedModule?.topics.find((item) => item.id === selectedTopicId) ?? null, [selectedModule, selectedTopicId]);

  const loadShared = useCallback(async (quiet = false) => {
    if (localChangeRef.current) return; if (!quiet) setSyncState('loading');
    try { const response = await fetch('/api/map', { cache: 'no-store' }); if (!response.ok) throw new Error('sync'); const payload = await response.json() as { data: SystemMapData | null; revision: number; mode?: string }; if (payload.data?.versions?.length) setData(payload.data); setRevision(payload.revision ?? 0); setSyncState(payload.mode === 'memory' ? 'local' : 'saved'); }
    catch { setSyncState('local'); } finally { hydratedRef.current = true; }
  }, []);
  useEffect(() => { void loadShared(); const timer = window.setInterval(() => void loadShared(true), 5000); return () => window.clearInterval(timer); }, [loadShared]);
  useEffect(() => {
    if (!hydratedRef.current || !localChangeRef.current) return;
    const timer = window.setTimeout(async () => {
      setSyncState('saving');
      try { const response = await fetch('/api/map', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, revision }) }); const payload = await response.json() as { data?: SystemMapData; revision?: number; mode?: string }; if (response.status === 409) { if (payload.data) setData(payload.data); setRevision(payload.revision ?? revision); setSyncState('conflict'); } else if (!response.ok) throw new Error('save'); else { setRevision(payload.revision ?? revision + 1); setSyncState(payload.mode === 'memory' ? 'local' : 'saved'); } } catch { setSyncState('local'); } finally { localChangeRef.current = false; }
    }, 550); return () => window.clearTimeout(timer);
  }, [data, revision]);

  const mutate = (updater: (current: SystemMapData) => SystemMapData) => { localChangeRef.current = true; setData(updater); };
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
  const addRootModule = () => { const module: SystemModule = { id: makeId('module'), name: '新根模組', code: 'MOD-NEW', summary: '補上這個模組的責任範圍。', health: 'healthy', color: '#63d8c7', spaces: [], topics: [], children: [] }; updateVersion({ modules: [...version.modules, module] }); setSelectedModuleId(module.id); setSelectedTopicId(null); };
  const removeSelectedModule = () => {
    if (!selectedModule) return; const removedIds = new Set([selectedModule.id, ...flattenModules(selectedModule.children ?? []).map((item) => item.id)]); const nextModules = removeModuleTree(version.modules, selectedModule.id); const nextSelection = selectedPath.at(-2) ?? flattenModules(nextModules)[0] ?? null;
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
  const addSpace = () => { if (selectedModule) updateModule({ spaces: [...selectedModule.spaces, { id: makeId('space'), name: '新暫存空間', kind: 'Redis', detail: '補上容量、TTL 或用途。', quantity: 1, instanceCounts: [0] }] }); };
  const removeSpace = (spaceId: string) => { if (selectedModule) updateModule({ spaces: selectedModule.spaces.filter((space) => space.id !== spaceId) }); };
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
    if (!selectedModule || !flowPeerId || flowPeerId === selectedModule.id || !findModule(version.modules, flowPeerId)) return;
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
  const flowCandidates = useMemo(() => allModules.filter((item) => item.id !== selectedModule?.id).map((item) => ({ id: item.id, label: findModulePath(version.modules, item.id).map((part) => part.name).join(' / ') })), [allModules, selectedModule?.id, version.modules]);
  const selectedFlows = useMemo(() => (version.flows ?? []).filter((flow) => flow.sourceId === selectedModule?.id || flow.targetId === selectedModule?.id), [selectedModule?.id, version.flows]);
  const visibleModules = useMemo(() => version.modules.filter((module) => moduleMatches(module, query.trim().toLowerCase(), healthFilter)), [healthFilter, query, version]);
  const healthCounts = useMemo(() => allModules.reduce((counts, module) => ({ ...counts, [module.health]: counts[module.health] + 1 }), { healthy: 0, watch: 0, risk: 0 } as Record<ModuleHealth, number>), [allModules]);
  const totalRecords = useMemo(() => version.modules.reduce((sum, module) => sum + moduleRecordCount(module), 0), [version.modules]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext; if (!modelContext?.registerTool) return; const lifecycle = new AbortController();
    const registration = modelContext.registerTool({ name: 'open_system_module', title: '開啟系統模組', description: '切換到指定系統版本，並在視覺化地圖中開啟任意層級的模組文件面板。', inputSchema: { type: 'object', properties: { versionId: { type: 'string' }, moduleId: { type: 'string' } }, required: ['versionId', 'moduleId'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, async execute(input: unknown) { const value = input as { versionId?: string; moduleId?: string }; const targetVersion = data.versions.find((item) => item.id === value.versionId); const targetModule = targetVersion ? findModule(targetVersion.modules, value.moduleId ?? '') : undefined; if (!targetVersion || !targetModule) throw new Error('找不到指定的版本或模組。'); setVersionId(targetVersion.id); setSelectedModuleId(targetModule.id); setSelectedTopicId(targetModule.topics[0]?.id ?? null); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); return { version: targetVersion.label, module: targetModule.name, topics: targetModule.topics.length }; } }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined); return () => lifecycle.abort();
  }, [data.versions]);

  const exportVersion = (format: 'md' | 'html' | 'json') => { const base = `${data.systemName}-${version.label}`.replace(/\s+/g, '-'); if (format === 'md') downloadFile(`${base}.md`, versionMarkdown(version, data.systemName), 'text/markdown;charset=utf-8'); if (format === 'html') downloadFile(`${base}.html`, versionHtml(version, data.systemName), 'text/html;charset=utf-8'); if (format === 'json') downloadFile(`${base}.json`, JSON.stringify(version, null, 2), 'application/json;charset=utf-8'); };
  const syncLabel = syncState === 'saving' ? '儲存中…' : syncState === 'saved' ? '共同編輯 · 已同步' : syncState === 'conflict' ? '已載入其他人的更新' : syncState === 'loading' ? '連線中…' : '本機預覽模式';

  return <main className="system-shell">
    <header className="topbar"><div className="brand-block"><div className="brand-symbol" aria-hidden="true"><Layers3 /></div><div><p className="eyebrow">SYSTEM MAP</p><h1>{data.systemName}</h1></div></div><div className="topbar-actions"><span className={`sync-state ${syncState}`}><i />{syncLabel}</span><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" className="export-button" />}><Download />匯出文件</DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => exportVersion('md')}><FileText />Markdown (.md)</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('html')}><Code2 />HTML (.html)</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('json')}><FileJson />JSON 資料</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
    <section className="version-strip" aria-label="系統版本">
      <div className="version-selector"><span className="field-label">系統版本</span><Select value={version.id} onValueChange={(value) => value && chooseVersion(value)}><SelectTrigger aria-label="選擇系統版本"><SelectValue>{version.label} · {version.state}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{data.versions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.state}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="sm" className="version-add-button" onClick={addVersion}><Plus />新增</Button>
        <Dialog><DialogTrigger render={<Button type="button" variant="outline" size="sm" className="version-edit-button" />}><Settings2 />編輯</DialogTrigger><DialogContent className="version-edit-dialog"><DialogHeader><DialogTitle>編輯系統與版本</DialogTitle><DialogDescription>這些名稱與說明會同步顯示在地圖及匯出文件。</DialogDescription></DialogHeader><div className="version-form">
          <label htmlFor="system-name"><span>系統名稱</span><Input id="system-name" value={data.systemName} onChange={(event) => updateSystemName(event.target.value)} /></label>
          <label htmlFor={`version-label-${version.id}`}><span>版本名稱</span><Input id={`version-label-${version.id}`} value={version.label} onChange={(event) => updateVersion({ label: event.target.value })} /></label>
          <label htmlFor={`version-release-${version.id}`}><span>發布時間</span><Input id={`version-release-${version.id}`} value={version.release} onChange={(event) => updateVersion({ release: event.target.value })} /></label>
          <label><span>版本狀態</span><Select value={version.state} onValueChange={(value) => value && updateVersion({ state: value as SystemVersion['state'] })}><SelectTrigger aria-label="版本狀態"><SelectValue>{version.state}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="現行">現行</SelectItem><SelectItem value="候選">候選</SelectItem><SelectItem value="封存">封存</SelectItem></SelectContent></Select></label>
          <label className="version-description-field" htmlFor={`version-description-${version.id}`}><span>版本說明</span><Textarea id={`version-description-${version.id}`} value={version.description} onChange={(event) => updateVersion({ description: event.target.value })} /></label>
        </div><div className="version-danger"><DeleteAction name={`版本「${version.label}」`} label="刪除版本" description="這個版本內的模組、資料流、暫存空間與主題都會一起刪除。" onConfirm={removeVersion} className="danger-button" disabled={data.versions.length <= 1} /><small>{data.versions.length <= 1 ? '至少需要保留一個版本。' : '刪除後無法復原。'}</small></div></DialogContent></Dialog>
      </div>
      <div className="version-note"><Badge variant="outline">{version.release}</Badge><span>{version.description}</span></div><div className="version-metrics" aria-label="版本摘要"><span><strong>{allModules.length}</strong> 模組</span><span><strong>{allModules.reduce((sum, module) => sum + moduleSpaceCount(module), 0)}</strong> 暫存實例</span><span><strong>{totalRecords}</strong> 筆資料</span></div>
    </section>
    <div className="workspace">
      <section className="map-panel" aria-label="系統模組視覺化"><div className="map-toolbar"><div className="search-box"><Search aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋模組或暫存實例…" aria-label="搜尋系統狀態" /></div><div className="filter-set" aria-label="模組健康狀態篩選">{(['all', 'healthy', 'watch', 'risk'] as const).map((filter) => <button key={filter} type="button" className={healthFilter === filter ? 'active' : ''} onClick={() => setHealthFilter(filter)}>{filter === 'all' ? '全部' : healthMeta[filter].label}{filter !== 'all' ? <b>{healthCounts[filter]}</b> : null}</button>)}</div></div>
        <div className="system-canvas"><div className="canvas-header"><div><span className="canvas-kicker">LIVE ARCHITECTURE / {version.label}</span><h2>模組、資料流與暫存狀態</h2></div><span className="canvas-hint"><CircleDot />點擊模組編輯狀態</span></div>
          <UnifiedFlowMap modules={visibleModules} flows={version.flows ?? []} selectedId={selectedModule?.id ?? ''} onAddRoot={addRootModule} onSelect={(target) => { setSelectedModuleId(target.id); setSelectedTopicId(target.topics[0]?.id ?? null); setFlowPeerId(''); }} />
          {visibleModules.length === 0 ? <div className="map-empty"><Search /><strong>沒有符合的模組</strong><span>試著清除搜尋或切換狀態。</span></div> : null}</div>
        <footer className="attention-bar"><div><Database /><span><strong>{allModules.reduce((sum, module) => sum + moduleSpaceCount(module), 0)} 個暫存實例</strong>，目前共 {totalRecords} 筆資料；空杯代表 0 筆。</span></div><button type="button" onClick={() => setHealthFilter('risk')}>只看風險模組 <ChevronRight /></button></footer></section>
      {selectedModule ? <aside className="detail-panel" aria-label={`${selectedModule.name} 詳細資訊`}>
        <div className="module-breadcrumb" aria-label="模組層級">{selectedPath.map((item, index) => <span key={item.id}>{index ? <ChevronRight /> : null}<button type="button" onClick={() => { setSelectedModuleId(item.id); setSelectedTopicId(item.topics[0]?.id ?? null); }}>{item.name}</button></span>)}</div>
        <div className="detail-head" style={{ '--module-color': selectedModule.color } as React.CSSProperties}>
          <div className="detail-level"><span className="detail-code">第 {selectedPath.length} 層</span><span className="detail-head-actions"><span className={`health-mark ${healthMeta[selectedModule.health].tone}`}>{healthMeta[selectedModule.health].label}</span><DeleteAction name={`模組「${selectedModule.name}」`} description={`將一併刪除它的 ${(selectedModule.children ?? []).length} 個直接子模組、暫存空間、主題，以及所有相連的資料流。`} onConfirm={removeSelectedModule} className="module-delete" /></span></div>
          <label className="detail-field" htmlFor={`module-name-${selectedModule.id}`}><span>模組名稱</span><Input id={`module-name-${selectedModule.id}`} className="module-name-input" value={selectedModule.name} onChange={(event) => updateModule({ name: event.target.value })} /></label>
          <div className="detail-compact-fields">
            <label className="detail-field" htmlFor={`module-code-${selectedModule.id}`}><span>模組代碼</span><Input id={`module-code-${selectedModule.id}`} value={selectedModule.code} onChange={(event) => updateModule({ code: event.target.value })} /></label>
            <label className="detail-field"><span>健康狀態</span><Select value={selectedModule.health} onValueChange={(value) => value && updateModule({ health: value as ModuleHealth })}><SelectTrigger aria-label="模組健康狀態"><SelectValue>{healthMeta[selectedModule.health].label}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="healthy">穩定</SelectItem><SelectItem value="watch">留意</SelectItem><SelectItem value="risk">風險</SelectItem></SelectContent></Select></label>
            <label className="detail-field color-field" htmlFor={`module-color-${selectedModule.id}`}><span>識別色</span><input id={`module-color-${selectedModule.id}`} type="color" value={selectedModule.color} onChange={(event) => updateModule({ color: event.target.value })} /></label>
          </div>
          <label className="detail-field" htmlFor={`module-summary-${selectedModule.id}`}><span>責任與說明</span><Textarea id={`module-summary-${selectedModule.id}`} value={selectedModule.summary} onChange={(event) => updateModule({ summary: event.target.value })} /></label>
        </div>
        <Tabs defaultValue="topics" className="detail-tabs">
          <TabsList><TabsTrigger value="topics">主題 <b>{selectedModule.topics.length}</b></TabsTrigger><TabsTrigger value="spaces">暫存 <b>{moduleSpaceCount(selectedModule)}</b></TabsTrigger><TabsTrigger value="flows">資料流 <b>{selectedFlows.length}</b></TabsTrigger><TabsTrigger value="children">結構 <b>{(selectedModule.children ?? []).length}</b></TabsTrigger></TabsList>
          <TabsContent value="topics" className="tab-body"><div className="tab-actions"><p>決議、疑問與背景都放在這裡。</p><Button size="sm" onClick={addTopic}><Plus />新增主題</Button></div><div className="topic-list">{selectedModule.topics.map((topic) => { const Icon = topicMeta[topic.status].icon; return <button type="button" key={topic.id} className={`topic-row ${selectedTopicId === topic.id ? 'active' : ''}`} onClick={() => setSelectedTopicId(topic.id)}><Icon /><span><strong>{topic.title}</strong><small>{topic.updatedAt}</small></span><Badge className={topic.status}>{topicMeta[topic.status].label}</Badge></button>; })}{!selectedModule.topics.length ? <div className="detail-empty"><MessageCircle /><span>還沒有主題</span><button type="button" onClick={addTopic}>建立第一則</button></div> : null}</div>
            {selectedTopic ? <div className="topic-editor"><div className="editor-heading"><span>編輯內容</span><span className="editor-heading-actions"><Select value={selectedTopic.status} onValueChange={(value) => value && updateTopic(selectedTopic.id, { status: value as TopicStatus })}><SelectTrigger aria-label="主題狀態"><SelectValue>{topicMeta[selectedTopic.status].label}</SelectValue></SelectTrigger><SelectContent align="end" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="draft">草稿</SelectItem><SelectItem value="discussion">討論中</SelectItem><SelectItem value="reviewed">已 Review</SelectItem></SelectContent></Select><DeleteAction name={`主題「${selectedTopic.title}」`} description="這則主題的內容與狀態會永久刪除。" onConfirm={() => removeTopic(selectedTopic.id)} className="inline-delete" /></span></div><label><span>主題</span><Input value={selectedTopic.title} onChange={(event) => updateTopic(selectedTopic.id, { title: event.target.value })} /></label><label><span>內容</span><Textarea value={selectedTopic.content} onChange={(event) => updateTopic(selectedTopic.id, { content: event.target.value })} /></label><p className="autosave-note"><Check />自動同步變更，不鎖定編輯者</p></div> : null}
          </TabsContent>
          <TabsContent value="spaces" className="tab-body"><div className="tab-actions"><p>每個實例可分別設定目前資料筆數。</p><Button size="sm" onClick={addSpace}><Plus />新增暫存區</Button></div><div className="space-list editable">{selectedModule.spaces.map((space, index) => <article key={space.id}><span className="space-no">{String(index + 1).padStart(2, '0')}</span><Archive /><div className="space-fields"><label><span>基礎名稱</span><Input value={space.name} onChange={(event) => updateSpace(space.id, { name: event.target.value })} /></label><label><span>類型</span><Input value={space.kind} onChange={(event) => updateSpace(space.id, { kind: event.target.value })} /></label><label className="space-quantity-field"><span>數量</span><Input type="number" min={1} step={1} inputMode="numeric" value={spaceQuantity(space)} onChange={(event) => updateSpaceQuantity(space.id, Number(event.target.value))} /></label><label className="space-detail-field"><span>容量、TTL 或用途</span><Input value={space.detail} onChange={(event) => updateSpace(space.id, { detail: event.target.value })} /></label><div className="instance-count-grid">{expandedSpaceNames(space).map((name, instanceIndex) => <div className="instance-count-editor" key={`${space.id}-instance-${instanceIndex}`}><CacheVessel name={name} count={instanceCount(space, instanceIndex)} compact /><label htmlFor={`${space.id}-count-${instanceIndex}`}><span>資料筆數</span><Input id={`${space.id}-count-${instanceIndex}`} type="number" min={0} step={1} inputMode="numeric" value={instanceCount(space, instanceIndex)} onChange={(event) => updateInstanceCount(space.id, instanceIndex, Number(event.target.value))} /></label></div>)}</div></div><DeleteAction name={`暫存空間「${space.name}」`} description="這個暫存空間的所有實例與資料筆數設定都會刪除。" onConfirm={() => removeSpace(space.id)} className="space-delete" /></article>)}{!selectedModule.spaces.length ? <div className="detail-empty"><Archive /><span>這個模組尚無暫存空間</span><button type="button" onClick={addSpace}>加入第一個</button></div> : null}</div><p className="autosave-note"><Check />資料量會同步到狀態圖與匯出文件</p></TabsContent>
          <TabsContent value="flows" className="tab-body">
            <div className="flow-editor-intro"><Waypoints /><div><strong>資料流上下游</strong><p>這裡描述模組間的資料傳遞；模組與子模組的包含關係仍由「結構」頁籤管理。</p></div></div>
            <div className="flow-builder">
              <label><span>方向</span><Select value={flowDirection} onValueChange={(value) => value && setFlowDirection(value as 'upstream' | 'downstream')}><SelectTrigger aria-label="資料流方向"><SelectValue>{flowDirection === 'upstream' ? '新增上游' : '新增下游'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="upstream">新增上游</SelectItem><SelectItem value="downstream">新增下游</SelectItem></SelectContent></Select></label>
              <label><span>連接模組</span><Select value={flowPeerId} onValueChange={(value) => setFlowPeerId(value ?? '')}><SelectTrigger aria-label="選擇資料流模組"><SelectValue placeholder="選擇模組">{flowCandidates.find((item) => item.id === flowPeerId)?.label ?? '選擇模組'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{flowCandidates.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></label>
              <Button type="button" onClick={addFlow} disabled={!flowPeerId}><Plus />新增關係</Button>
            </div>
            <div className="flow-editor-list">{selectedFlows.map((flow) => { const incoming = flow.targetId === selectedModule.id; const peerId = incoming ? flow.sourceId : flow.targetId; const peer = findModule(version.modules, peerId); return <article key={flow.id} className={incoming ? 'incoming' : 'outgoing'}><label className="flow-direction-field"><span>方向</span><Select value={incoming ? 'upstream' : 'downstream'} onValueChange={(value) => value && updateFlow(flow.id, value === 'upstream' ? { sourceId: peerId, targetId: selectedModule.id } : { sourceId: selectedModule.id, targetId: peerId })}><SelectTrigger aria-label="修改資料流方向"><SelectValue>{incoming ? '上游輸入' : '下游輸出'}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="upstream">上游輸入</SelectItem><SelectItem value="downstream">下游輸出</SelectItem></SelectContent></Select></label><label className="flow-peer"><span>連接模組</span><Select value={peerId} onValueChange={(value) => value && updateFlow(flow.id, incoming ? { sourceId: value } : { targetId: value })}><SelectTrigger aria-label="修改連接模組"><SelectValue>{peer ? findModulePath(version.modules, peer.id).map((item) => item.name).join(' / ') : peerId}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>{flowCandidates.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></label><label htmlFor={`flow-label-${flow.id}`}><span>傳遞內容</span><Input id={`flow-label-${flow.id}`} value={flow.label} placeholder="例如：訂單事件" onChange={(event) => updateFlow(flow.id, { label: event.target.value })} /></label><DeleteAction name={`與「${peer?.name ?? peerId}」的資料流`} description="這條上下游關係會從完整資料流圖中移除。" onConfirm={() => removeFlow(flow.id)} className="inline-delete" /></article>; })}{!selectedFlows.length ? <div className="detail-empty"><Waypoints /><span>此模組尚未設定資料流</span></div> : null}</div>
          </TabsContent>
          <TabsContent value="children" className="tab-body">
            <div className="structure-intro"><GitBranch /><div><strong>指定模組層級</strong><p>可將目前模組移到另一個模組下方，或升為根層；會自動排除自己與子孫，避免循環。</p></div></div>
            <div className="module-settings">
              <label><span>上層模組</span><Select value={currentParentId} onValueChange={(value) => value && moveModule(value)}><SelectTrigger aria-label="選擇上層模組"><SelectValue>{currentParentId === 'root' ? '根層（無上層）' : findModulePath(version.modules, currentParentId).map((item) => item.name).join(' / ')}</SelectValue></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}><SelectItem value="root">根層（無上層）</SelectItem>{parentOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></label>
              <div className="structure-actions"><Button type="button" variant="outline" size="sm" onClick={addPeerModule}><Plus />新增同層模組</Button><Button type="button" size="sm" onClick={addChildModule}><Plus />新增子模組</Button></div>
            </div>
            <div className="child-list">{(selectedModule.children ?? []).map((child) => <button type="button" key={child.id} onClick={() => { setSelectedModuleId(child.id); setSelectedTopicId(child.topics[0]?.id ?? null); }}><Layers3 /><span><strong>{child.name}</strong><small>{child.code} · {(child.children ?? []).length} 子模組</small></span><ChevronRight /></button>)}{!(selectedModule.children ?? []).length ? <div className="detail-empty"><Layers3 /><span>這一層尚無子模組</span><button type="button" onClick={addChildModule}>加入第一個</button></div> : null}</div>
          </TabsContent>
        </Tabs>
      </aside> : null}
    </div>
  </main>;
}
