import { simplifyString } from "./misc-utils";

export interface SearchableApp
{
    packageName: string;
    label: string;
    labelSimplified: string;
}

export type SortMode = 'alpha' | 'usage' | 'recent';
export const SORT_MODES: { id: SortMode; label: string }[] = [
    { id: 'alpha', label: 'ALFABÉTICO' },
    { id: 'usage', label: 'MÁS USADAS HOY' },
    { id: 'recent', label: 'INSTALADAS RECIENTES' },
];

export const nextSortMode = (current: SortMode) => SORT_MODES[(SORT_MODES.findIndex(m => m.id === current) + 1) % SORT_MODES.length].id;

export interface SearchOptions
{
    sort?: SortMode;
    /** package -> ms of use today */
    usage?: Readonly<Record<string, number>>;
    /** package -> first seen timestamp (0 = was already there) */
    firstSeen?: Readonly<Record<string, number>>;
    /** package -> user's own name, also searched */
    aliases?: Readonly<Record<string, string>>;
}

function rankText(label: string, words: string[], query: string)
{
    if (label === query) return 0;
    if (label.startsWith(query)) return 1;
    if (words.some(w => w.startsWith(query))) return 2;
    if (label.includes(query)) return 3;
    return -1;
}

const wordsOf = (text: string) => text.split(/[^A-Za-z0-9À-ɏ]+/).map(simplifyString);

function rank(app: SearchableApp, query: string, alias?: string)
{
    const byLabel = rankText(app.labelSimplified, wordsOf(app.label), query);
    const byAlias = alias ? rankText(simplifyString(alias), wordsOf(alias), query) : -1;
    if (byLabel < 0) return byAlias;
    if (byAlias < 0) return byLabel;
    return Math.min(byLabel, byAlias);
}

/** The name shown for an app: the user's alias, if any. */
export const displayName = (app: SearchableApp, aliases: Readonly<Record<string, string>> = {}) => aliases[app.packageName]?.trim() || app.label;

export function searchApps<T extends SearchableApp>(apps: Iterable<T>, query: string, hidden: readonly string[] = [], options: SearchOptions = {}): T[]
{
    const q = simplifyString(query);
    const hiddenSet = new Set(hidden);
    const { usage = {}, firstSeen = {}, aliases = {}, sort = 'alpha' } = options;

    const alpha = (a: T, b: T) => displayName(a, aliases).localeCompare(displayName(b, aliases));
    const byMode = (a: T, b: T) =>
        sort === 'usage' ? (usage[b.packageName] ?? 0) - (usage[a.packageName] ?? 0) || alpha(a, b)
        : sort === 'recent' ? (firstSeen[b.packageName] ?? 0) - (firstSeen[a.packageName] ?? 0) || alpha(a, b)
        : alpha(a, b);

    const visible = [...apps].filter(a => !hiddenSet.has(a.packageName));
    if (!q) return visible.sort(byMode);

    return visible
        .map(app => ({ app, r: rank(app, q, aliases[app.packageName]) }))
        .filter(x => x.r >= 0)
        .sort((a, b) => a.r - b.r || byMode(a.app, b.app))
        .map(x => x.app);
}
