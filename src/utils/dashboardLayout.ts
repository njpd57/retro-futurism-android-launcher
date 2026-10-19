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
