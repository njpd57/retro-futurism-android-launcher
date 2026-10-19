import { folderOf, type Folders } from './folders';
import { isNewApp } from './newApps';

export interface BoxOptions
{
    folders: Readonly<Folders>;
    favorites: readonly string[];
    /** Most recent first. */
    recents: readonly string[];
    firstSeen: Readonly<Record<string, number>>;
    /** Time in use today by package, in ms. */
    usage: Readonly<Record<string, number>>;
    now: number;
}

export interface AppBox<T>
{
    /** `sys:favorites`, `sys:recents`, `sys:new` or `dir:<FOLDER>`. */
    id: string;
    kind: 'system' | 'folder';
    label: string;
    apps: T[];
    count: number;
    hasNew: boolean;
    /** Use today relative to the busiest box (0-1). */
    usageFraction: number;
}

export const folderBoxId = (name: string) => `dir:${name}`;

/**
 * The boxes of the apps screen: FAVORITAS, RECIENTES and NUEVAS (only when not empty; they are filters, apps stay
 * where they are) followed by the user's folders in alphabetical order. `apps` is the visible, already sorted list.
 */
export function buildBoxes<T extends { packageName: string }>(apps: readonly T[], opts: BoxOptions): AppBox<T>[]
{
    const isNew = (app: T) => isNewApp(opts.firstSeen[app.packageName], opts.now);
    const byPackage = new Map(apps.map(a => [a.packageName, a]));

    const raw: { id: string; kind: AppBox<T>['kind']; label: string; apps: T[] }[] = [
        { id: 'sys:favorites', kind: 'system', label: 'FAVORITAS', apps: apps.filter(a => opts.favorites.includes(a.packageName)) },
        { id: 'sys:recents', kind: 'system', label: 'RECIENTES', apps: opts.recents.flatMap(p => byPackage.get(p) ?? []) },
        { id: 'sys:new', kind: 'system', label: 'NUEVAS', apps: apps.filter(isNew) },
    ];

    const inFolder = new Map<string, T[]>();
    for (const app of apps)
    {
        const f = folderOf(opts.folders, app.packageName);
        if (f) inFolder.set(f, [...(inFolder.get(f) ?? []), app]);
    }
    for (const name of [...inFolder.keys()].sort())
        raw.push({ id: folderBoxId(name), kind: 'folder', label: name, apps: inFolder.get(name)! });

    const used = (list: readonly T[]) => list.reduce((sum, a) => sum + (opts.usage[a.packageName] ?? 0), 0);
    const present = raw.filter(b => b.apps.length > 0);
    const busiest = Math.max(0, ...present.map(b => used(b.apps)));

    return present.map(b => ({
        ...b,
        count: b.apps.length,
        hasNew: b.id !== 'sys:new' && b.apps.some(isNew),
        usageFraction: busiest > 0 ? used(b.apps) / busiest : 0,
    }));
}

/** The apps that are in no folder, in the given order. */
export const looseApps = <T extends { packageName: string }>(apps: readonly T[], folders: Readonly<Folders>) =>
    apps.filter(a => folderOf(folders, a.packageName) === null);
