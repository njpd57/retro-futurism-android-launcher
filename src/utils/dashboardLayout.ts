/** Window sizes in grid cells (columns x rows): small 1x1, wide 2x1, tall 1x2, large 2x2. */
export type WidgetSize = 's' | 'w' | 't' | 'l';

export const SIZE_CELLS: Record<WidgetSize, { cols: 1 | 2; rows: 1 | 2 }> = {
    s: { cols: 1, rows: 1 },
    w: { cols: 2, rows: 1 },
    t: { cols: 1, rows: 2 },
    l: { cols: 2, rows: 2 },
};

export const SIZE_LABELS: Record<WidgetSize, string> = { s: '1×1', w: '2×1', t: '1×2', l: '2×2' };

export interface DashboardItem
{
    id: string;
    kind: string;
    minimized: boolean;
    /** Chosen size; absent in layouts saved before sizes existed (the widget's first size applies). */
    size?: WidgetSize;
}

/** The size an item is drawn at: its own when the widget supports it, otherwise the widget's default (the first). */
export function sizeOf(item: Pick<DashboardItem, 'size'>, sizes: readonly WidgetSize[]): WidgetSize
{
    return item.size && sizes.includes(item.size) ? item.size : sizes[0];
}

/** Moves one item to the next size its widget supports, wrapping around. */
export function cycleSize(layout: readonly DashboardItem[], id: string, sizes: readonly WidgetSize[]): DashboardItem[]
{
    return layout.map(i =>
    {
        if (i.id !== id || sizes.length < 2) return i;
        return { ...i, size: sizes[(sizes.indexOf(sizeOf(i, sizes)) + 1) % sizes.length] };
    });
}

const item = (kind: string, size?: WidgetSize): DashboardItem => ({ id: `${kind}-1`, kind, minimized: false, ...(size ? { size } : {}) });

/** The panels a fresh install starts with, as `kind:size`. Ids are unique across panels because they key the widget's stored state. */
const DEFAULT_PANEL_SPECS: string[][] = [
    ['clock:w', 'power:s', 'link:s', 'alarm:w', 'agenda:t', 'favorites:t', 'media:w', 'recent:w'],
    ['radar:l', 'mother:w', 'contacts:s', 'storage:s', 'screentime:w', 'log:w', 'telemetry:s', 'scope:s'],
    ['forecast:t', 'moon:s', 'compass:s', 'clocks:s', 'countdown:s', 'timer:s', 'protocol:t', 'notes:t', 'images:w'],
    ['tracker:l', 'reroute:w', 'isolation:w', 'marines:s', 'nostromo:l'],
];

export const DEFAULT_PANELS: DashboardItem[][] = DEFAULT_PANEL_SPECS.map(panel =>
    panel.map(spec => { const [kind, size] = spec.split(':'); return item(kind, size as WidgetSize); }));

/** `kind-N` with the smallest N not used by the layout. */
export function newItemId(layout: readonly DashboardItem[], kind: string)
{
    const used = new Set(layout.map(i => i.id));
    let n = 1;
    while (used.has(`${kind}-${n}`)) n++;
    return `${kind}-${n}`;
}

export function addWidget(layout: readonly DashboardItem[], kind: string): DashboardItem[]
{
    return [...layout, { id: newItemId(layout, kind), kind, minimized: false }];
}

export function removeWidget(layout: readonly DashboardItem[], id: string): DashboardItem[]
{
    return layout.filter(i => i.id !== id);
}

/** Moves one step towards the start (-1) or the end (1); stays put at the edges. */
export function moveWidget(layout: readonly DashboardItem[], id: string, delta: -1 | 1): DashboardItem[]
{
    const from = layout.findIndex(i => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= layout.length) return [...layout];

    const next = [...layout];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
}

export function toggleMinimized(layout: readonly DashboardItem[], id: string): DashboardItem[]
{
    return layout.map(i => i.id === id ? { ...i, minimized: !i.minimized } : i);
}

// ---- several panels (P1, P2, ...) ----

export interface LayoutSet
{
    /** index of the visible panel */
    active: number;
    panels: DashboardItem[][];
}

export const MAX_PANELS = 4;

/** The starting set: the single layout stored before panels existed as panel 1 when `legacy` is given, otherwise the default panels. */
export function createLayoutSet(legacy?: readonly DashboardItem[] | null): LayoutSet
{
    if (legacy) return { active: 0, panels: [[...legacy]] };
    return defaultLayoutSet();
}

/** A fresh copy of the starting panels. */
export function defaultLayoutSet(): LayoutSet
{
    return { active: 0, panels: DEFAULT_PANELS.map(p => p.map(i => ({ ...i }))) };
}

/** Repairs a stored set: at least one panel, `active` inside the range. */
export function normalizeLayoutSet(set: LayoutSet | null | undefined, legacy?: readonly DashboardItem[] | null): LayoutSet
{
    if (!set || !Array.isArray(set.panels) || !set.panels.length) return createLayoutSet(legacy);
    const panels = set.panels.slice(0, MAX_PANELS).map(p => Array.isArray(p) ? p : []);
    const active = Number.isInteger(set.active) ? Math.min(Math.max(set.active, 0), panels.length - 1) : 0;
    return { active, panels };
}

export function activePanel(set: LayoutSet): DashboardItem[]
{
    return set.panels[set.active];
}

export function setActivePanelItems(set: LayoutSet, items: DashboardItem[]): LayoutSet
{
    return { ...set, panels: set.panels.map((p, i) => i === set.active ? items : p) };
}

export function selectPanel(set: LayoutSet, index: number): LayoutSet
{
    return index < 0 || index >= set.panels.length ? set : { ...set, active: index };
}

/** Adds an empty panel and shows it; no-op at the limit. */
export function addPanel(set: LayoutSet): LayoutSet
{
    if (set.panels.length >= MAX_PANELS) return set;
    return { active: set.panels.length, panels: [...set.panels, []] };
}

/** Removes the visible panel; the last one can't be removed. */
export function removeActivePanel(set: LayoutSet): LayoutSet
{
    if (set.panels.length <= 1) return set;
    const panels = set.panels.filter((_, i) => i !== set.active);
    return { active: Math.min(set.active, panels.length - 1), panels };
}

export const allItems = (set: LayoutSet): DashboardItem[] => set.panels.flat();

/** Adds a widget to the visible panel. The id is unique across ALL panels, because it keys the widget's stored state. */
export function addWidgetToActive(set: LayoutSet, kind: string): LayoutSet
{
    const item: DashboardItem = { id: newItemId(allItems(set), kind), kind, minimized: false };
    return setActivePanelItems(set, [...activePanel(set), item]);
}
