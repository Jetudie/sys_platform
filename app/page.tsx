'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Boxes,
  PackageOpen,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SmallContainerType = {
  id: string;
  name: string;
  quantity: number;
  itemCount: number;
};

type BigContainer = {
  id: string;
  name: string;
  types: SmallContainerType[];
};

const colors = ['#F46C4E', '#F2B84B', '#5AB6A9', '#5E86E5', '#A879D8', '#E781A6'];

const sampleContainers: BigContainer[] = [
  {
    id: 'basket-a',
    name: '水果籃 A',
    types: [
      { id: 'apple', name: '蘋果盒', quantity: 3, itemCount: 6 },
      { id: 'orange', name: '橘子袋', quantity: 2, itemCount: 4 },
    ],
  },
  {
    id: 'basket-b',
    name: '水果籃 B',
    types: [
      { id: 'pear', name: '梨子盒', quantity: 2, itemCount: 5 },
      { id: 'berry', name: '莓果杯', quantity: 4, itemCount: 3 },
    ],
  },
];

const cloneSample = () => structuredClone(sampleContainers);
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function QuantityInput({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="quantity-control">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`${label}減少 1`}
        onClick={() => onChange(clamp(value - 1, min, max))}
      >
        −
      </Button>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`${label}增加 1`}
        onClick={() => onChange(clamp(value + 1, min, max))}
      >
        +
      </Button>
    </div>
  );
}

function ContentStack({ count, color }: { count: number; color: string }) {
  if (count === 0) {
    return <span className="empty-items">空</span>;
  }

  return (
    <div className="item-stack" aria-label={`${count} 個內容物`}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="content-dot"
          style={{ '--dot-color': color, '--dot-index': index } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [containers, setContainers] = useState<BigContainer[]>(cloneSample);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;

    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();

    const register = modelContext.registerTool(
      {
        name: 'configure_container_map',
        title: '設定容器視圖',
        description: '一次設定大容器，以及各自包含的小容器種類、數量與每個小容器的內容物數量。',
        inputSchema: {
          type: 'object',
          properties: {
            containers: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 40 },
                  types: {
                    type: 'array',
                    maxItems: 8,
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', minLength: 1, maxLength: 40 },
                        quantity: { type: 'integer', minimum: 1, maximum: 12 },
                        itemCount: { type: 'integer', minimum: 0, maximum: 30 },
                      },
                      required: ['name', 'quantity', 'itemCount'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['name', 'types'],
                additionalProperties: false,
              },
            },
          },
          required: ['containers'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input: unknown) {
          if (!input || typeof input !== 'object' || !('containers' in input)) {
            throw new Error('需要提供 containers 陣列。');
          }
          const rawContainers = (input as { containers: unknown }).containers;
          if (!Array.isArray(rawContainers) || rawContainers.length < 1 || rawContainers.length > 8) {
            throw new Error('大容器數量必須介於 1 到 8。');
          }

          const next = rawContainers.map((rawContainer) => {
            if (!rawContainer || typeof rawContainer !== 'object') throw new Error('大容器格式錯誤。');
            const { name, types } = rawContainer as { name?: unknown; types?: unknown };
            if (typeof name !== 'string' || !name.trim() || name.length > 40 || !Array.isArray(types) || types.length > 8) {
              throw new Error('請檢查大容器名稱與小容器種類。');
            }
            return {
              id: makeId(),
              name: name.trim(),
              types: types.map((rawType) => {
                if (!rawType || typeof rawType !== 'object') throw new Error('小容器格式錯誤。');
                const type = rawType as { name?: unknown; quantity?: unknown; itemCount?: unknown };
                if (
                  typeof type.name !== 'string' ||
                  !type.name.trim() ||
                  type.name.length > 40 ||
                  !Number.isInteger(type.quantity) ||
                  Number(type.quantity) < 1 ||
                  Number(type.quantity) > 12 ||
                  !Number.isInteger(type.itemCount) ||
                  Number(type.itemCount) < 0 ||
                  Number(type.itemCount) > 30
                ) {
                  throw new Error('請檢查小容器名稱、數量與內容物數量。');
                }
                return {
                  id: makeId(),
                  name: type.name.trim(),
                  quantity: Number(type.quantity),
                  itemCount: Number(type.itemCount),
                };
              }),
            };
          });

          setContainers(next);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const smallContainers = next.reduce(
            (sum, container) => sum + container.types.reduce((subtotal, type) => subtotal + type.quantity, 0),
            0,
          );
          const items = next.reduce(
            (sum, container) => sum + container.types.reduce((subtotal, type) => subtotal + type.quantity * type.itemCount, 0),
            0,
          );
          return { bigContainers: next.length, smallContainers, items };
        },
      },
      { signal: lifecycle.signal },
    );

    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const totals = useMemo(() => {
    const small = containers.reduce(
      (sum, container) =>
        sum + container.types.reduce((typeSum, type) => typeSum + type.quantity, 0),
      0,
    );
    const items = containers.reduce(
      (sum, container) =>
        sum +
        container.types.reduce(
          (typeSum, type) => typeSum + type.quantity * type.itemCount,
          0,
        ),
      0,
    );
    return { small, items };
  }, [containers]);

  const setBigContainerCount = (count: number) => {
    const nextCount = clamp(count, 1, 8);
    setContainers((current) => {
      if (nextCount <= current.length) return current.slice(0, nextCount);
      return [
        ...current,
        ...Array.from({ length: nextCount - current.length }, (_, index) => ({
          id: makeId(),
          name: `大容器 ${current.length + index + 1}`,
          types: [
            {
              id: makeId(),
              name: '小容器',
              quantity: 1,
              itemCount: 3,
            },
          ],
        })),
      ];
    });
  };

  const updateContainer = (containerId: string, updater: (container: BigContainer) => BigContainer) => {
    setContainers((current) =>
      current.map((container) => (container.id === containerId ? updater(container) : container)),
    );
  };

  const addType = (containerId: string) => {
    updateContainer(containerId, (container) => ({
      ...container,
      types: [
        ...container.types,
        {
          id: makeId(),
          name: `小容器種類 ${container.types.length + 1}`,
          quantity: 1,
          itemCount: 3,
        },
      ],
    }));
  };

  const updateType = (
    containerId: string,
    typeId: string,
    patch: Partial<SmallContainerType>,
  ) => {
    updateContainer(containerId, (container) => ({
      ...container,
      types: container.types.map((type) =>
        type.id === typeId ? { ...type, ...patch } : type,
      ),
    }));
  };

  const removeType = (containerId: string, typeId: string) => {
    updateContainer(containerId, (container) => ({
      ...container,
      types: container.types.filter((type) => type.id !== typeId),
    }));
  };

  return (
    <main className="min-h-screen">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          <Boxes />
        </div>
        <div>
          <p className="eyebrow">CONTAINER MAP</p>
          <h1>容器視圖</h1>
        </div>
        <div className="summary" aria-label="目前總覽">
          <span><strong>{containers.length}</strong> 大容器</span>
          <span><strong>{totals.small}</strong> 小容器</span>
          <span><strong>{totals.items}</strong> 內容物</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="settings-panel" aria-label="容器設定">
          <div className="panel-heading">
            <div>
              <p className="step-label">設定</p>
              <h2>安排你的容器</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setContainers(cloneSample())}
            >
              <RotateCcw /> 載入範例
            </Button>
          </div>

          <div className="big-count-row">
            <div>
              <label htmlFor="big-count">大容器數量</label>
              <p>最多可同時比較 8 個</p>
            </div>
            <QuantityInput
              value={containers.length}
              min={1}
              max={8}
              label="大容器數量"
              onChange={setBigContainerCount}
            />
          </div>

          <div className="editor-list">
            {containers.map((container, containerIndex) => (
              <section className="editor-card" key={container.id}>
                <div className="editor-card-title">
                  <span className="container-number">{String(containerIndex + 1).padStart(2, '0')}</span>
                  <div className="field-grow">
                    <label htmlFor={`container-${container.id}`}>大容器名稱</label>
                    <Input
                      id={`container-${container.id}`}
                      value={container.name}
                      onChange={(event) =>
                        updateContainer(container.id, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="type-heading">
                  <span>{container.types.length} 種小容器</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => addType(container.id)}>
                    <Plus /> 新增種類
                  </Button>
                </div>

                <div className="type-list">
                  {container.types.length === 0 ? (
                    <button className="empty-type" type="button" onClick={() => addType(container.id)}>
                      <Plus /> 加入第一種小容器
                    </button>
                  ) : null}

                  {container.types.map((type, typeIndex) => (
                    <div className="type-editor" key={type.id}>
                      <span
                        className="type-swatch"
                        style={{ backgroundColor: colors[typeIndex % colors.length] }}
                      />
                      <div className="type-fields">
                        <div className="type-name-row">
                          <Input
                            aria-label={`第 ${typeIndex + 1} 種小容器名稱`}
                            value={type.name}
                            onChange={(event) =>
                              updateType(container.id, type.id, { name: event.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`刪除 ${type.name}`}
                            onClick={() => removeType(container.id, type.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="count-grid">
                          <label>
                            <span>小容器數量</span>
                            <QuantityInput
                              value={type.quantity}
                              min={1}
                              max={12}
                              label={`${type.name}數量`}
                              onChange={(quantity) => updateType(container.id, type.id, { quantity })}
                            />
                          </label>
                          <label>
                            <span>每個內容物</span>
                            <QuantityInput
                              value={type.itemCount}
                              min={0}
                              max={30}
                              label={`${type.name}內容物數量`}
                              onChange={(itemCount) => updateType(container.id, type.id, { itemCount })}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>

        <section className="visual-panel" aria-label="容器即時圖像">
          <div className="visual-heading">
            <div>
              <p className="step-label">即時預覽</p>
              <h2>一眼看懂裝了什麼</h2>
            </div>
            <div className="legend">
              <span><i className="legend-box" /> 小容器</span>
              <span><i className="legend-dot" /> 內容物</span>
            </div>
          </div>

          <div className="container-canvas">
            {containers.map((container, containerIndex) => (
              <article className="big-container" key={container.id}>
                <div className="big-container-header">
                  <div className="crate-icon" aria-hidden="true"><Box /></div>
                  <div>
                    <p>大容器 {String(containerIndex + 1).padStart(2, '0')}</p>
                    <h3>{container.name || '未命名容器'}</h3>
                  </div>
                  <span className="big-container-total">
                    {container.types.reduce((sum, type) => sum + type.quantity, 0)} 個小容器
                  </span>
                </div>

                {container.types.length === 0 ? (
                  <div className="visual-empty">
                    <PackageOpen />
                    <span>這個大容器目前是空的</span>
                  </div>
                ) : (
                  <div className="small-container-grid">
                    {container.types.flatMap((type, typeIndex) =>
                      Array.from({ length: type.quantity }, (_, instanceIndex) => {
                        const color = colors[typeIndex % colors.length];
                        return (
                          <section
                            key={`${type.id}-${instanceIndex}`}
                            className="small-container"
                            style={{ '--container-color': color } as React.CSSProperties}
                          >
                            <div className="small-container-label">
                              <span>{type.name || '未命名'}</span>
                              <strong>{String(instanceIndex + 1).padStart(2, '0')}</strong>
                            </div>
                            <div className="contents-well">
                              <ContentStack count={type.itemCount} color={color} />
                            </div>
                            <span className="item-count">{type.itemCount} 個</span>
                          </section>
                        );
                      }),
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
