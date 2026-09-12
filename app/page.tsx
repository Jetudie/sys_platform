'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, Check, CheckCircle2, ChevronRight, CircleDot, Clock3, Code2, Download, FileJson, FileText, Layers3, MessageCircle, Plus, Search, Server, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type TopicStatus = 'draft' | 'discussion' | 'reviewed';
type ModuleHealth = 'healthy' | 'watch' | 'risk';
type Topic = { id: string; title: string; content: string; status: TopicStatus; updatedAt: string };
type TempSpace = { id: string; name: string; kind: string; detail: string };
type SystemModule = { id: string; name: string; code: string; summary: string; health: ModuleHealth; color: string; spaces: TempSpace[]; topics: Topic[]; children?: SystemModule[] };
type SystemVersion = { id: string; label: string; release: string; state: '現行' | '候選' | '封存'; description: string; modules: SystemModule[] };
type SystemMapData = { systemName: string; versions: SystemVersion[] };

const nowLabel = () => new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const initialData: SystemMapData = {
  systemName: 'Atlas Commerce Platform',
  versions: [
    {
      id: 'v3-2', label: 'v3.2', release: '2026 Q3', state: '現行', description: '訂單流程拆分完成，快取責任回到各領域模組。',
      modules: [
        { id: 'gateway', name: 'API Gateway', code: 'EDGE-01', health: 'healthy', color: '#63d8c7', summary: '統一入口，負責驗證、限流與請求路由。', spaces: [{ id: 'gw-session', name: 'Session Cache', kind: 'Redis', detail: 'TTL 30 min · 8.2 GB' }, { id: 'gw-rate', name: 'Rate Window', kind: 'Memory', detail: 'TTL 60 sec · 12 shards' }], topics: [{ id: 'gw-topic-1', title: '企業客戶限流例外', content: '需確認 partner tier 是否沿用獨立 quota。', status: 'discussion', updatedAt: '9/12 14:20' }, { id: 'gw-topic-2', title: 'JWT key rotation', content: '雙 key 過渡期已在 staging 驗證。', status: 'reviewed', updatedAt: '9/11 17:05' }], children: [{ id: 'auth-guard', name: '身分驗證器', code: 'EDGE-01-A', health: 'healthy', color: '#63d8c7', summary: '解析 access token 並提供一致的授權上下文。', spaces: [{ id: 'auth-key', name: 'Signing Keys', kind: 'LRU', detail: 'TTL 15 min' }], topics: [{ id: 'auth-topic-1', title: '服務帳號權限', content: '待整理跨服務 scope 對照表。', status: 'draft', updatedAt: '9/12 10:15' }], children: [{ id: 'claim-normalizer', name: 'Claim 正規化', code: 'EDGE-01-A-1', health: 'healthy', color: '#63d8c7', summary: '將不同 issuer 的 claims 轉為內部格式。', spaces: [{ id: 'claim-rules', name: 'Rule Snapshot', kind: 'Memory', detail: 'Versioned rules' }], topics: [] }] }] },
        { id: 'catalog', name: '商品目錄', code: 'CAT-07', health: 'healthy', color: '#6f9cff', summary: '提供商品、價格與可售狀態的統一查詢介面。', spaces: [{ id: 'cat-query', name: 'Query Cache', kind: 'Redis', detail: 'TTL 5 min · 22 GB' }, { id: 'cat-image', name: 'Image Metadata', kind: 'LRU', detail: '50k entries' }], topics: [{ id: 'cat-topic-1', title: '價格失效策略', content: '促銷價更新改為 event-driven invalidation。', status: 'reviewed', updatedAt: '9/10 10:40' }] },
        { id: 'order', name: '訂單核心', code: 'ORD-12', health: 'watch', color: '#ffbf69', summary: '管理購物車結帳後的訂單生命週期與狀態機。', spaces: [{ id: 'ord-draft', name: 'Draft Order', kind: 'Redis', detail: 'TTL 24 hr · 14 GB' }, { id: 'ord-idem', name: 'Idempotency Keys', kind: 'KV', detail: 'TTL 48 hr' }, { id: 'ord-outbox', name: 'Event Outbox', kind: 'SQL', detail: '15 min rolling window' }], topics: [{ id: 'ord-topic-1', title: '跨區重送的冪等性', content: '需要補上切區期間的衝突案例與回復順序。', status: 'discussion', updatedAt: '9/12 16:42' }, { id: 'ord-topic-2', title: 'Outbox 清理批次', content: '目前尖峰時段延後 30 分鐘執行。', status: 'draft', updatedAt: '9/12 11:18' }] },
        { id: 'payment', name: '支付協調器', code: 'PAY-04', health: 'risk', color: '#ff7e79', summary: '協調授權、請款、退款與第三方支付狀態。', spaces: [{ id: 'pay-token', name: 'Token Vault Proxy', kind: 'Encrypted', detail: 'TTL 10 min' }, { id: 'pay-retry', name: 'Retry Queue', kind: 'Queue', detail: '1.3k pending' }], topics: [{ id: 'pay-topic-1', title: '重試佇列積壓', content: '供應商 B 的 429 增加；暫時將 backoff 上限調至 20 分鐘。', status: 'discussion', updatedAt: '9/12 17:02' }] },
        { id: 'fulfillment', name: '履約中心', code: 'FUL-09', health: 'healthy', color: '#b68cff', summary: '整合庫存保留、出貨批次與物流狀態。', spaces: [{ id: 'ful-stock', name: 'Stock Snapshot', kind: 'Redis', detail: 'TTL 90 sec · 18 GB' }, { id: 'ful-batch', name: 'Wave Buffer', kind: 'Memory', detail: '2k orders / wave' }], topics: [{ id: 'ful-topic-1', title: '缺貨補償流程', content: '客服與倉儲的責任邊界已確認。', status: 'reviewed', updatedAt: '9/9 09:30' }] },
      ],
    },
    {
      id: 'v3-3-rc', label: 'v3.3 RC', release: '2026 Q4', state: '候選', description: '加入風險引擎與區域化支付路由，正進行容量驗證。',
      modules: [
        { id: 'gateway-rc', name: 'API Gateway', code: 'EDGE-02', health: 'healthy', color: '#63d8c7', summary: '新增區域感知路由與流量鏡像。', spaces: [{ id: 'gw-rc-session', name: 'Session Cache', kind: 'Redis', detail: 'Regional · TTL 30 min' }, { id: 'gw-rc-mirror', name: 'Traffic Mirror', kind: 'Buffer', detail: '5% sampled' }], topics: [{ id: 'gw-rc-t1', title: '鏡像流量的敏感欄位', content: '遮罩規則待資安 review。', status: 'discussion', updatedAt: '9/12 13:10' }] },
        { id: 'order-rc', name: '訂單核心', code: 'ORD-13', health: 'watch', color: '#ffbf69', summary: '狀態機改為 append-only event stream。', spaces: [{ id: 'ord-rc-state', name: 'State Projection', kind: 'Redis', detail: 'TTL 7 days' }, { id: 'ord-rc-outbox', name: 'Event Stream', kind: 'Kafka', detail: '12 partitions' }], topics: [{ id: 'ord-rc-t1', title: '回放時間目標', content: '百萬筆事件需在 8 分鐘內完成。', status: 'draft', updatedAt: '9/12 09:05' }] },
        { id: 'risk-rc', name: '風險引擎', code: 'RSK-01', health: 'risk', color: '#ff7e79', summary: '在付款前計算交易風險與阻擋策略。', spaces: [{ id: 'risk-feature', name: 'Feature Store', kind: 'Redis', detail: 'TTL 15 min · 31 GB' }, { id: 'risk-decision', name: 'Decision Cache', kind: 'KV', detail: 'TTL 6 hr' }], topics: [{ id: 'risk-rc-t1', title: '模型降級條件', content: '超過 180ms 時切換規則模式；門檻仍待壓測。', status: 'discussion', updatedAt: '9/12 16:30' }] },
        { id: 'payment-rc', name: '支付路由', code: 'PAY-05', health: 'watch', color: '#6f9cff', summary: '依區域、幣別與健康度選擇支付供應商。', spaces: [{ id: 'pay-rc-health', name: 'Provider Health', kind: 'Memory', detail: 'TTL 10 sec' }, { id: 'pay-rc-idem', name: 'Payment Keys', kind: 'KV', detail: 'TTL 72 hr' }], topics: [{ id: 'pay-rc-t1', title: '供應商切換觀測', content: '需要統一切換原因碼，供客服查詢。', status: 'draft', updatedAt: '9/11 15:22' }] },
      ],
    },
    {
      id: 'v2-8', label: 'v2.8', release: '2025 Q4', state: '封存', description: '單體訂單服務時期的基準版本，僅供事件追溯。',
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
const moduleMatches = (module: SystemModule, query: string, filter: 'all' | TopicStatus): boolean => {
  const text = `${module.name} ${module.code} ${module.summary} ${module.spaces.map((space) => `${space.name} ${space.kind}`).join(' ')} ${module.topics.map((topic) => `${topic.title} ${topic.content}`).join(' ')}`.toLowerCase();
  const ownMatch = (!query || text.includes(query)) && (filter === 'all' || module.topics.some((topic) => topic.status === filter));
  return ownMatch || (module.children ?? []).some((child) => moduleMatches(child, query, filter));
};

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function moduleMarkdown(module: SystemModule, depth = 2): string {
  const heading = '#'.repeat(Math.min(depth, 6));
  const childSection = (module.children ?? []).map((child) => moduleMarkdown(child, depth + 1)).join('\n\n');
  return `${heading} ${module.name} (${module.code})\n\n${module.summary}\n\n**狀態：** ${healthMeta[module.health].label}\n\n${heading}# 暫存空間\n\n${module.spaces.length ? module.spaces.map((space) => `- **${space.name}** · ${space.kind} — ${space.detail}`).join('\n') : '- 無'}\n\n${heading}# 主題與決議\n\n${module.topics.length ? module.topics.map((topic) => `- **${topic.title}** · ${topicMeta[topic.status].label} · ${topic.updatedAt}\n  ${topic.content}`).join('\n') : '- 目前沒有主題。'}${childSection ? `\n\n${heading}# 子模組\n\n${childSection}` : ''}`;
}
function versionMarkdown(version: SystemVersion, systemName: string) {
  return `# ${systemName} — ${version.label}\n\n> ${version.release} · ${version.state}\n\n${version.description}\n\n${version.modules.map((module) => moduleMarkdown(module)).join('\n\n---\n\n')}\n`;
}
function versionHtml(version: SystemVersion, systemName: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
  const renderModule = (module: SystemModule, depth = 0): string => `<article style="margin-left:${depth * 22}px"><h2>${escape(module.name)} <small>${escape(module.code)}</small></h2><p>${escape(module.summary)}</p><h3>暫存空間</h3><ul>${module.spaces.map((space) => `<li><b>${escape(space.name)}</b> · ${escape(space.kind)} — ${escape(space.detail)}</li>`).join('') || '<li>無</li>'}</ul><h3>主題與決議</h3>${module.topics.map((topic) => `<section><h4>${escape(topic.title)}</h4><span class="tag">${escape(topicMeta[topic.status].label)}</span><p>${escape(topic.content)}</p><small>${escape(topic.updatedAt)}</small></section>`).join('') || '<p>目前沒有主題。</p>'}${(module.children ?? []).map((child) => renderModule(child, depth + 1)).join('')}</article>`;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(systemName)} ${escape(version.label)}</title><style>body{max-width:880px;margin:48px auto;padding:0 24px;font:16px/1.7 system-ui;color:#172035}h1,h2,h3{line-height:1.25}article{border-top:1px solid #d8dde8;padding:24px 0}.tag{display:inline-block;padding:2px 8px;background:#eef2f7;border-radius:4px;font-size:13px}</style></head><body><h1>${escape(systemName)} — ${escape(version.label)}</h1><p>${escape(version.release)} · ${escape(version.state)}</p><p>${escape(version.description)}</p>${version.modules.map((module) => renderModule(module)).join('')}</body></html>`;
}

function ModuleBranch({ module, index, depth = 0, selectedId, onSelect }: { module: SystemModule; index: number; depth?: number; selectedId: string; onSelect: (module: SystemModule) => void }) {
  const discussions = module.topics.filter((topic) => topic.status === 'discussion').length;
  const children = module.children ?? [];
  return <div className={`module-stack depth-${depth}`} style={{ '--module-color': module.color } as React.CSSProperties}>
    <button type="button" className={`${depth === 0 ? 'module-card' : 'submodule-card'} ${selectedId === module.id ? 'selected' : ''}`} onClick={() => onSelect(module)}>
      {depth === 0 ? <>
        <span className="module-index">{String(index + 1).padStart(2, '0')}</span><span className={`health-mark ${healthMeta[module.health].tone}`}>{healthMeta[module.health].label}</span><span className="module-title"><small>{module.code}</small><strong>{module.name}</strong></span><span className="module-summary">{module.summary}</span><span className="cache-rack">{module.spaces.map((space) => <span className="cache-unit" key={space.id}><Archive /><span><b>{space.name}</b><small>{space.kind}</small></span></span>)}</span><span className="module-footer"><span>{module.topics.length} 則主題</span>{children.length ? <span className="child-count"><Layers3 />{children.length} 子模組</span> : null}{discussions ? <span className="discussion-count"><MessageCircle />{discussions} 討論中</span> : <span className="review-clear"><Check />已整理</span>}<ChevronRight /></span>
      </> : <>
        <span className="submodule-line" aria-hidden="true" /><Layers3 /><span className="submodule-name"><small>{module.code}</small><strong>{module.name}</strong></span><span className="submodule-meta">{module.spaces.length} 暫存區 · {module.topics.length} 主題</span><span className={`health-dot ${healthMeta[module.health].tone}`} title={healthMeta[module.health].label} /><ChevronRight />
      </>}
    </button>
    {children.length ? <div className="submodule-tree" aria-label={`${module.name} 的子模組`}>{children.map((child, childIndex) => <ModuleBranch key={child.id} module={child} index={childIndex} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}</div> : null}
  </div>;
}

export default function Home() {
  const [data, setData] = useState<SystemMapData>(initialData);
  const [versionId, setVersionId] = useState(initialData.versions[0].id);
  const [selectedModuleId, setSelectedModuleId] = useState(initialData.versions[0].modules[2].id);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(initialData.versions[0].modules[2].topics[0].id);
  const [query, setQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<'all' | TopicStatus>('all');
  const [syncState, setSyncState] = useState<'loading' | 'saved' | 'saving' | 'local' | 'conflict'>('loading');
  const [revision, setRevision] = useState(0);
  const hydratedRef = useRef(false); const localChangeRef = useRef(false);
  const version = useMemo(() => data.versions.find((item) => item.id === versionId) ?? data.versions[0], [data, versionId]);
  const selectedModule = useMemo(() => findModule(version.modules, selectedModuleId) ?? version.modules[0], [version, selectedModuleId]);
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
  const updateModule = (patch: Partial<SystemModule>) => mutate((current) => ({ ...current, versions: current.versions.map((item) => item.id === version.id ? { ...item, modules: updateModuleTree(item.modules, selectedModule.id, patch) } : item) }));
  const updateTopic = (topicId: string, patch: Partial<Topic>) => updateModule({ topics: selectedModule.topics.map((topic) => topic.id === topicId ? { ...topic, ...patch, updatedAt: nowLabel() } : topic) });
  const addTopic = () => { const topic: Topic = { id: makeId('topic'), title: '未命名主題', content: '在這裡補上背景、決定或待確認事項。', status: 'draft', updatedAt: nowLabel() }; updateModule({ topics: [...selectedModule.topics, topic] }); setSelectedTopicId(topic.id); };
  const updateSpace = (spaceId: string, patch: Partial<TempSpace>) => updateModule({ spaces: selectedModule.spaces.map((space) => space.id === spaceId ? { ...space, ...patch } : space) });
  const addSpace = () => updateModule({ spaces: [...selectedModule.spaces, { id: makeId('space'), name: '新暫存空間', kind: 'Redis', detail: '補上容量、TTL 或用途。' }] });
  const removeSpace = (spaceId: string) => updateModule({ spaces: selectedModule.spaces.filter((space) => space.id !== spaceId) });
  const addChildModule = () => {
    const child: SystemModule = { id: makeId('module'), name: '新子模組', code: `${selectedModule.code}-SUB`, summary: '補上這個子模組的責任範圍。', health: 'healthy', color: selectedModule.color, spaces: [], topics: [], children: [] };
    updateModule({ children: [...(selectedModule.children ?? []), child] });
    setSelectedModuleId(child.id); setSelectedTopicId(null);
  };
  const chooseVersion = (id: string) => { const next = data.versions.find((item) => item.id === id); if (!next) return; setVersionId(id); setSelectedModuleId(next.modules[0]?.id ?? ''); setSelectedTopicId(next.modules[0]?.topics[0]?.id ?? null); };
  const allModules = useMemo(() => flattenModules(version.modules), [version]);
  const visibleModules = useMemo(() => version.modules.filter((module) => moduleMatches(module, query.trim().toLowerCase(), topicFilter)), [query, topicFilter, version]);
  const topicCounts = useMemo(() => allModules.flatMap((module) => module.topics).reduce((counts, topic) => ({ ...counts, [topic.status]: counts[topic.status] + 1 }), { draft: 0, discussion: 0, reviewed: 0 } as Record<TopicStatus, number>), [allModules]);

  useEffect(() => {
    const modelContext = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext; if (!modelContext?.registerTool) return; const lifecycle = new AbortController();
    const registration = modelContext.registerTool({ name: 'open_system_module', title: '開啟系統模組', description: '切換到指定系統版本，並在視覺化地圖中開啟任意層級的模組文件面板。', inputSchema: { type: 'object', properties: { versionId: { type: 'string' }, moduleId: { type: 'string' } }, required: ['versionId', 'moduleId'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, async execute(input: unknown) { const value = input as { versionId?: string; moduleId?: string }; const targetVersion = data.versions.find((item) => item.id === value.versionId); const targetModule = targetVersion ? findModule(targetVersion.modules, value.moduleId ?? '') : undefined; if (!targetVersion || !targetModule) throw new Error('找不到指定的版本或模組。'); setVersionId(targetVersion.id); setSelectedModuleId(targetModule.id); setSelectedTopicId(targetModule.topics[0]?.id ?? null); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); return { version: targetVersion.label, module: targetModule.name, topics: targetModule.topics.length }; } }, { signal: lifecycle.signal });
    void Promise.resolve(registration).catch(() => undefined); return () => lifecycle.abort();
  }, [data.versions]);

  const exportVersion = (format: 'md' | 'html' | 'json') => { const base = `${data.systemName}-${version.label}`.replace(/\s+/g, '-'); if (format === 'md') downloadFile(`${base}.md`, versionMarkdown(version, data.systemName), 'text/markdown;charset=utf-8'); if (format === 'html') downloadFile(`${base}.html`, versionHtml(version, data.systemName), 'text/html;charset=utf-8'); if (format === 'json') downloadFile(`${base}.json`, JSON.stringify(version, null, 2), 'application/json;charset=utf-8'); };
  const syncLabel = syncState === 'saving' ? '儲存中…' : syncState === 'saved' ? '共同編輯 · 已同步' : syncState === 'conflict' ? '已載入其他人的更新' : syncState === 'loading' ? '連線中…' : '本機預覽模式';

  return <main className="system-shell">
    <header className="topbar"><div className="brand-block"><div className="brand-symbol" aria-hidden="true"><Layers3 /></div><div><p className="eyebrow">SYSTEM MAP</p><h1>{data.systemName}</h1></div></div><div className="topbar-actions"><span className={`sync-state ${syncState}`}><i />{syncLabel}</span><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" className="export-button" />}><Download />匯出文件</DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => exportVersion('md')}><FileText />Markdown (.md)</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('html')}><Code2 />HTML (.html)</DropdownMenuItem><DropdownMenuItem onClick={() => exportVersion('json')}><FileJson />JSON 資料</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header>
    <section className="version-strip" aria-label="系統版本"><div className="version-selector"><span className="field-label">系統版本</span><Select value={version.id} onValueChange={(value) => value && chooseVersion(value)}><SelectTrigger aria-label="選擇系統版本"><SelectValue /></SelectTrigger><SelectContent>{data.versions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.state}</SelectItem>)}</SelectContent></Select></div><div className="version-note"><Badge variant="outline">{version.release}</Badge><span>{version.description}</span></div><div className="version-metrics" aria-label="版本摘要"><span><strong>{allModules.length}</strong> 模組</span><span><strong>{allModules.reduce((sum, module) => sum + module.spaces.length, 0)}</strong> 暫存區</span><span><strong>{topicCounts.discussion}</strong> 討論中</span></div></section>
    <div className="workspace">
      <section className="map-panel" aria-label="系統模組視覺化"><div className="map-toolbar"><div className="search-box"><Search aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋模組、暫存區或主題…" aria-label="搜尋系統資訊" /></div><div className="filter-set" aria-label="主題狀態篩選">{(['all', 'discussion', 'draft', 'reviewed'] as const).map((filter) => <button key={filter} type="button" className={topicFilter === filter ? 'active' : ''} onClick={() => setTopicFilter(filter)}>{filter === 'all' ? '全部' : topicMeta[filter].label}{filter !== 'all' ? <b>{topicCounts[filter]}</b> : null}</button>)}</div></div>
        <div className="system-canvas"><div className="canvas-header"><div><span className="canvas-kicker">ARCHITECTURE / {version.label}</span><h2>服務與暫存責任</h2></div><span className="canvas-hint"><CircleDot />點擊模組開啟文件</span></div><div className="request-source"><Server /><span>Client / Partner APIs</span></div><ArrowDown className="flow-arrow top-flow" aria-hidden="true" />
          <div className="module-grid">{visibleModules.map((module, index) => <ModuleBranch key={module.id} module={module} index={index} selectedId={selectedModule.id} onSelect={(target) => { setSelectedModuleId(target.id); setSelectedTopicId(target.topics[0]?.id ?? null); }} />)}</div>
          {visibleModules.length === 0 ? <div className="map-empty"><Search /><strong>沒有符合的模組</strong><span>試著清除搜尋或切換狀態。</span></div> : null}</div>
        <footer className="attention-bar"><div><Sparkles /><span><strong>溝通焦點</strong> 先處理 {topicCounts.discussion} 則討論，再確認 {topicCounts.draft} 則草稿。</span></div><button type="button" onClick={() => setTopicFilter('discussion')}>只看討論中 <ChevronRight /></button></footer></section>
      {selectedModule ? <aside className="detail-panel" aria-label={`${selectedModule.name} 詳細資訊`}>
        <div className="module-breadcrumb" aria-label="模組層級">{selectedPath.map((item, index) => <span key={item.id}>{index ? <ChevronRight /> : null}<button type="button" onClick={() => { setSelectedModuleId(item.id); setSelectedTopicId(item.topics[0]?.id ?? null); }}>{item.name}</button></span>)}</div>
        <div className="detail-head" style={{ '--module-color': selectedModule.color } as React.CSSProperties}><span className="detail-code">{selectedModule.code} · 第 {selectedPath.length} 層</span><span className={`health-mark ${healthMeta[selectedModule.health].tone}`}>{healthMeta[selectedModule.health].label}</span><h2>{selectedModule.name}</h2><Textarea aria-label="模組說明" value={selectedModule.summary} onChange={(event) => updateModule({ summary: event.target.value })} /></div>
        <Tabs defaultValue="topics" className="detail-tabs">
          <TabsList><TabsTrigger value="topics">主題 <b>{selectedModule.topics.length}</b></TabsTrigger><TabsTrigger value="spaces">暫存空間 <b>{selectedModule.spaces.length}</b></TabsTrigger><TabsTrigger value="children">子模組 <b>{(selectedModule.children ?? []).length}</b></TabsTrigger></TabsList>
          <TabsContent value="topics" className="tab-body"><div className="tab-actions"><p>決議、疑問與背景都放在這裡。</p><Button size="sm" onClick={addTopic}><Plus />新增主題</Button></div><div className="topic-list">{selectedModule.topics.map((topic) => { const Icon = topicMeta[topic.status].icon; return <button type="button" key={topic.id} className={`topic-row ${selectedTopicId === topic.id ? 'active' : ''}`} onClick={() => setSelectedTopicId(topic.id)}><Icon /><span><strong>{topic.title}</strong><small>{topic.updatedAt}</small></span><Badge className={topic.status}>{topicMeta[topic.status].label}</Badge></button>; })}{!selectedModule.topics.length ? <div className="detail-empty"><MessageCircle /><span>還沒有主題</span><button type="button" onClick={addTopic}>建立第一則</button></div> : null}</div>
            {selectedTopic ? <div className="topic-editor"><div className="editor-heading"><span>編輯內容</span><Select value={selectedTopic.status} onValueChange={(value) => value && updateTopic(selectedTopic.id, { status: value as TopicStatus })}><SelectTrigger aria-label="主題狀態"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="discussion">討論中</SelectItem><SelectItem value="reviewed">已 Review</SelectItem></SelectContent></Select></div><label><span>主題</span><Input value={selectedTopic.title} onChange={(event) => updateTopic(selectedTopic.id, { title: event.target.value })} /></label><label><span>內容</span><Textarea value={selectedTopic.content} onChange={(event) => updateTopic(selectedTopic.id, { content: event.target.value })} /></label><p className="autosave-note"><Check />自動同步變更，不鎖定編輯者</p></div> : null}
          </TabsContent>
          <TabsContent value="spaces" className="tab-body"><div className="tab-actions"><p>每個小容器代表這一層模組擁有的暫存責任。</p><Button size="sm" onClick={addSpace}><Plus />新增暫存區</Button></div><div className="space-list editable">{selectedModule.spaces.map((space, index) => <article key={space.id}><span className="space-no">{String(index + 1).padStart(2, '0')}</span><Archive /><div className="space-fields"><label><span>名稱</span><Input value={space.name} onChange={(event) => updateSpace(space.id, { name: event.target.value })} /></label><label><span>類型</span><Input value={space.kind} onChange={(event) => updateSpace(space.id, { kind: event.target.value })} /></label><label className="space-detail-field"><span>容量、TTL 或用途</span><Input value={space.detail} onChange={(event) => updateSpace(space.id, { detail: event.target.value })} /></label></div><Button type="button" variant="ghost" size="icon-sm" className="space-delete" aria-label={`刪除 ${space.name}`} onClick={() => removeSpace(space.id)}><Trash2 /></Button></article>)}{!selectedModule.spaces.length ? <div className="detail-empty"><Archive /><span>這個模組尚無暫存空間</span><button type="button" onClick={addSpace}>加入第一個</button></div> : null}</div><p className="autosave-note"><Check />變更會同步到畫布與匯出文件</p></TabsContent>
          <TabsContent value="children" className="tab-body"><div className="tab-actions"><p>任何子模組都能繼續加入下一層。</p><Button size="sm" onClick={addChildModule}><Plus />新增子模組</Button></div><div className="module-settings"><label><span>模組名稱</span><Input value={selectedModule.name} onChange={(event) => updateModule({ name: event.target.value })} /></label><label><span>模組代碼</span><Input value={selectedModule.code} onChange={(event) => updateModule({ code: event.target.value })} /></label><label><span>健康狀態</span><Select value={selectedModule.health} onValueChange={(value) => value && updateModule({ health: value as ModuleHealth })}><SelectTrigger aria-label="模組健康狀態"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="healthy">穩定</SelectItem><SelectItem value="watch">留意</SelectItem><SelectItem value="risk">風險</SelectItem></SelectContent></Select></label></div><div className="child-list">{(selectedModule.children ?? []).map((child) => <button type="button" key={child.id} onClick={() => { setSelectedModuleId(child.id); setSelectedTopicId(child.topics[0]?.id ?? null); }}><Layers3 /><span><strong>{child.name}</strong><small>{child.code} · {(child.children ?? []).length} 子模組</small></span><ChevronRight /></button>)}{!(selectedModule.children ?? []).length ? <div className="detail-empty"><Layers3 /><span>這一層尚無子模組</span><button type="button" onClick={addChildModule}>加入第一個</button></div> : null}</div></TabsContent>
        </Tabs>
      </aside> : null}
    </div>
  </main>;
}
