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
    /** Stable id of each panel (a deck of the ship); rules refer to a deck by it, so reordering or deleting others can't retarget them. */
    ids: string[];
    /** Name shown on each panel's tab, UPPERCASE. */
    names: string[];
}

export const MAX_PANELS = 8;
export const MAX_DECK_NAME = 10;

/** Names of the starting decks, in order. */
const DEFAULT_DECK_NAMES = ['PUENTE', 'SENSORES', 'BITÁCORA', 'RECREO'];

/** UPPERCASE, trimmed and cut to the tab's width; empty when nothing is left. */
export const cleanDeckName = (raw: string): string => raw.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, MAX_DECK_NAME);

/** `dN` with the smallest N not in `ids`. */
function newDeckId(ids: readonly string[]): string
{
    let n = 1;
    while (ids.includes(`d${n}`)) n++;
    return `d${n}`;
}

/** The starting set: the single layout stored before panels existed as panel 1 when `legacy` is given, otherwise the default panels. */
export function createLayoutSet(legacy?: readonly DashboardItem[] | null): LayoutSet
{
    if (legacy) return { active: 0, panels: [[...legacy]], ids: ['d1'], names: ['P1'] };
    return defaultLayoutSet();
}

/** A fresh copy of the starting panels. */
export function defaultLayoutSet(): LayoutSet
{
    return { active: 0, panels: DEFAULT_PANELS.map(p => p.map(i => ({ ...i }))), ids: DEFAULT_PANELS.map((_, n) => `d${n + 1}`), names: DEFAULT_PANELS.map((_, n) => DEFAULT_DECK_NAMES[n] ?? `P${n + 1}`) };
}

/**
 * Repairs a stored set: at least one panel, `active` inside the range, and one unique id and one name per panel.
 * Sets saved before decks existed get ids d1..dN and the names P1..PN they were shown with.
 */
export function normalizeLayoutSet(set: LayoutSet | null | undefined, legacy?: readonly DashboardItem[] | null): LayoutSet
{
    if (!set || !Array.isArray(set.panels) || !set.panels.length) return createLayoutSet(legacy);
    const panels = set.panels.slice(0, MAX_PANELS).map(p => Array.isArray(p) ? p : []);
    const active = Number.isInteger(set.active) ? Math.min(Math.max(set.active, 0), panels.length - 1) : 0;
    const ids: string[] = [];
    panels.forEach((_, n) =>
    {
        const raw = Array.isArray(set.ids) ? set.ids[n] : undefined;
        ids.push(typeof raw === 'string' && raw && !ids.includes(raw) ? raw : newDeckId(ids));
    });
    const names = panels.map((_, n) => (Array.isArray(set.names) && typeof set.names[n] === 'string' ? cleanDeckName(set.names[n]) : '') || `P${n + 1}`);
    return { active, panels, ids, names };
}

/** Index of the deck with that id, -1 when it doesn't exist (any more). */
export const deckIndex = (set: LayoutSet, id: string): number => set.ids.indexOf(id);

/** Renames a deck; an empty name keeps the old one. */
export function renameDeck(set: LayoutSet, index: number, name: string): LayoutSet
{
    const clean = cleanDeckName(name);
    if (!clean || index < 0 || index >= set.names.length) return set;
    return { ...set, names: set.names.map((n, i) => i === index ? clean : n) };
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
    return { active: set.panels.length, panels: [...set.panels, []], ids: [...set.ids, newDeckId(set.ids)], names: [...set.names, `P${set.panels.length + 1}`] };
}

/** Removes the visible panel; the last one can't be removed. */
export function removeActivePanel(set: LayoutSet): LayoutSet
{
    if (set.panels.length <= 1) return set;
    const keep = <T>(list: T[]) => list.filter((_, i) => i !== set.active);
    const panels = keep(set.panels);
    return { active: Math.min(set.active, panels.length - 1), panels, ids: keep(set.ids), names: keep(set.names) };
}

export const allItems = (set: LayoutSet): DashboardItem[] => set.panels.flat();

/** Adds a widget to the visible panel. The id is unique across ALL panels, because it keys the widget's stored state. */
export function addWidgetToActive(set: LayoutSet, kind: string): LayoutSet
{
    const item: DashboardItem = { id: newItemId(allItems(set), kind), kind, minimized: false };
    return setActivePanelItems(set, [...activePanel(set), item]);
}

// ---- reordering by drag ----

/**
 * Moves `id` next to `targetId`: before it, or after it when `after`. The grid flows `dense`, so the list order is what
 * counts, not a cell: dropping on a window means "insert here". No-op when either id is missing or they are the same.
 */
export function moveWidgetTo(layout: readonly DashboardItem[], id: string, targetId: string, after: boolean): DashboardItem[]
{
    if (id === targetId) return [...layout];
    const moved = layout.find(i => i.id === id);
    if (!moved || !layout.some(i => i.id === targetId)) return [...layout];
    const rest = layout.filter(i => i.id !== id);
    const at = rest.findIndex(i => i.id === targetId) + (after ? 1 : 0);
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

/** Whether a drop at (fx, fy), each 0..1 inside the target window, goes after it (lower right half) or before it. */
export const dropAfter = (fx: number, fy: number): boolean => fx + fy >= 1;

/** Moves a window to the end of another panel and keeps its id (it keys the stored state). No-op for a bad panel or the same one. */
export function moveWidgetToPanel(set: LayoutSet, id: string, panelIndex: number): LayoutSet
{
    if (panelIndex < 0 || panelIndex >= set.panels.length) return set;
    const from = set.panels.findIndex(p => p.some(i => i.id === id));
    if (from < 0 || from === panelIndex) return set;
    const moved = set.panels[from].find(i => i.id === id)!;
    return { ...set, panels: set.panels.map((p, n) => n === from ? p.filter(i => i.id !== id) : n === panelIndex ? [...p, moved] : p) };
}

/** A new window of the same kind and size right after `id`, in the same panel (its own empty state). */
export function duplicateWidget(set: LayoutSet, id: string): LayoutSet
{
    const at = set.panels.findIndex(p => p.some(i => i.id === id));
    if (at < 0) return set;
    const panel = set.panels[at];
    const src = panel.find(i => i.id === id)!;
    const copy: DashboardItem = { ...src, id: newItemId(allItems(set), src.kind), minimized: false };
    const pos = panel.indexOf(src) + 1;
    return { ...set, panels: set.panels.map((p, n) => n === at ? [...p.slice(0, pos), copy, ...p.slice(pos)] : p) };
}

/** A bounded undo stack of layout sets for the edit mode. */
export function pushHistory<T>(stack: readonly T[], value: T, max = 20): T[]
{
    return [...stack, value].slice(-max);
}

// ---- layout templates ----

export interface LayoutTemplate
{
    id: string;
    label: string;
    hint: string;
    /** Decks with their windows as `kind:size`. */
    decks: { name: string; items: string[] }[];
}

/** Whole sets of decks to start from; applying one replaces the layout (and can be undone in the edit mode). */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
    {
        id: 'work', label: 'TRABAJO', hint: 'RELOJ, AGENDA, NOTAS Y TEMPORIZADOR',
        decks: [
            { name: 'PUENTE', items: ['clock:w', 'agenda:t', 'notes:t', 'timer:s', 'countdown:s', 'protocol:t'] },
            { name: 'ENLACES', items: ['radar:l', 'contacts:s', 'mother:w', 'favorites:t', 'recent:w'] },
        ],
    },
    {
        id: 'night', label: 'NOCHE', hint: 'RELOJ, ALARMA Y MEDIOS; LO MÍNIMO',
        decks: [{ name: 'GUARDIA', items: ['clock:w', 'alarm:w', 'moon:s', 'power:s', 'media:w', 'forecast:t'] }],
    },
    {
        id: 'travel', label: 'VIAJE', hint: 'HORAS DEL MUNDO, RUMBO, CLIMA Y RESERVA',
        decks: [
            { name: 'RUTA', items: ['clocks:s', 'compass:s', 'forecast:t', 'power:w', 'storage:s', 'telemetry:s'] },
            { name: 'PUENTE', items: ['clock:w', 'radar:l', 'media:w', 'contacts:s'] },
        ],
    },
];

/** The layout set a template describes: fresh ids (unique across decks) and the deck names; the first deck shows. */
export function templateSet(t: LayoutTemplate): LayoutSet
{
    const panels: DashboardItem[][] = [];
    const all: DashboardItem[] = [];
    for (const deck of t.decks.slice(0, MAX_PANELS))
    {
        const panel = deck.items.map(spec =>
        {
            const [kind, size] = spec.split(':');
            const it: DashboardItem = { id: newItemId(all, kind), kind, minimized: false, ...(size ? { size: size as WidgetSize } : {}) };
            all.push(it);
            return it;
        });
        panels.push(panel);
    }
    return normalizeLayoutSet({ active: 0, panels, ids: panels.map((_, n) => `d${n + 1}`), names: t.decks.map(d => d.name) });
}
