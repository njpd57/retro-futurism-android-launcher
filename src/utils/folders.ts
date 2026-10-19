export type Folders = Record<string, string[]>;

export const FOLDER_NAME_MAX = 16;

/** Folder names are shown uppercase; blanks are dropped and the length is capped. */
export const cleanFolderName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, FOLDER_NAME_MAX).toUpperCase();

/** Moves a package into a folder (created if needed) or out of every folder when `name` is null. Empty folders disappear. */
export function assignToFolder(folders: Readonly<Folders>, packageName: string, name: string | null): Folders
{
    const target = name === null ? null : cleanFolderName(name);
    const next: Folders = {};
    for (const [folder, pkgs] of Object.entries(folders))
    {
        const rest = pkgs.filter(p => p !== packageName);
        if (rest.length) next[folder] = rest;
    }
    if (target)
        next[target] = [...(next[target] ?? []), packageName];
    return next;
}

export const folderOf = (folders: Readonly<Folders>, packageName: string) =>
    Object.keys(folders).find(f => folders[f].includes(packageName)) ?? null;

export type ListRow<T> =
    | { type: 'folder'; name: string; count: number; open: boolean }
    | { type: 'app'; app: T; depth: 0 | 1 };

/**
 * Rows of the app list: folders first (alphabetical), each followed by its apps when open, then the apps that
 * are in no folder in their given order. `apps` is the already sorted, visible list.
 */
export function buildRows<T extends { packageName: string }>(apps: readonly T[], folders: Readonly<Folders>, open: ReadonlySet<string>): ListRow<T>[]
{
    const folderApps = new Map<string, T[]>();
    const loose: T[] = [];
    for (const app of apps)
    {
        const f = folderOf(folders, app.packageName);
        if (f) folderApps.set(f, [...(folderApps.get(f) ?? []), app]);
        else loose.push(app);
    }

    const rows: ListRow<T>[] = [];
    for (const name of [...folderApps.keys()].sort())
    {
        const inside = folderApps.get(name)!;
        const isOpen = open.has(name);
        rows.push({ type: 'folder', name, count: inside.length, open: isOpen });
        if (isOpen) rows.push(...inside.map(app => ({ type: 'app' as const, app, depth: 1 as const })));
    }
    rows.push(...loose.map(app => ({ type: 'app' as const, app, depth: 0 as const })));
    return rows;
}
