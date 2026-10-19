export interface DashboardItem
{
    id: string;
    kind: string;
    minimized: boolean;
}

const item = (kind: string): DashboardItem => ({ id: `${kind}-1`, kind, minimized: false });

export const DEFAULT_LAYOUT: DashboardItem[] = ['clock', 'power', 'link', 'favorites', 'scope', 'recent', 'log'].map(item);

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

/** A set with one panel. `legacy` is the single layout stored before panels existed. */
export function createLayoutSet(legacy?: readonly DashboardItem[] | null): LayoutSet
{
    return { active: 0, panels: [[...(legacy ?? DEFAULT_LAYOUT)]] };
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
