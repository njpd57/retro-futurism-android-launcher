import { simplifyString } from "./misc-utils";

export interface SearchableApp
{
    packageName: string;
    label: string;
    labelSimplified: string;
}

function rank(app: SearchableApp, query: string)
{
    const label = app.labelSimplified;
    if (label === query) return 0;
    if (label.startsWith(query)) return 1;

    const words = app.label.split(/[^A-Za-z0-9À-ɏ]+/).map(simplifyString);
    if (words.some(w => w.startsWith(query))) return 2;

    if (label.includes(query)) return 3;
    return -1;
}

export function searchApps<T extends SearchableApp>(apps: Iterable<T>, query: string, hidden: readonly string[] = []): T[]
{
    const q = simplifyString(query);
    const hiddenSet = new Set(hidden);
    const byLabel = (a: T, b: T) => a.label.localeCompare(b.label);

    const visible = [...apps].filter(a => !hiddenSet.has(a.packageName));
    if (!q) return visible.sort(byLabel);

    return visible
        .map(app => ({ app, r: rank(app, q) }))
        .filter(x => x.r >= 0)
        .sort((a, b) => a.r - b.r || byLabel(a.app, b.app))
        .map(x => x.app);
}
