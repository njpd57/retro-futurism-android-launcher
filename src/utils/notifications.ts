import type { BridgeNotification } from '@/types/bridge-fork';

const newestFirst = (a: BridgeNotification, b: BridgeNotification) => b.postTime - a.postTime;

/**
 * What the panel lists: media notifications are left to the media widget, and a group summary is hidden
 * when the same app has an individual notification.
 */
export function visibleNotifications(list: Iterable<BridgeNotification>): BridgeNotification[]
{
    const all = [...list].filter(n => !n.isMedia);
    const withChildren = new Set(all.filter(n => !n.isGroupSummary).map(n => n.packageName));
    return all.filter(n => !n.isGroupSummary || !withChildren.has(n.packageName)).sort(newestFirst);
}

export function splitNotifications(list: readonly BridgeNotification[])
{
    return {
        ongoing: list.filter(n => n.isOngoing),
        recent: list.filter(n => !n.isOngoing),
    };
}

/** One entry per app, newest first (what the status bar shows). */
export function uniquePackages(list: readonly BridgeNotification[]): string[]
{
    return [...new Set([...list].sort(newestFirst).map(n => n.packageName))];
}

/** App name for a package: the installed app's label, else the last package segment capitalized (`com.x.deskclock` → `Deskclock`). */
export function appLabelFor(packageName: string, labels: { get(pkg: string): { label: string } | undefined }): string
{
    const label = labels.get(packageName)?.label;
    if (label) return label;
    const last = packageName.split('.').pop() || packageName;
    return last.charAt(0).toUpperCase() + last.slice(1);
}

export interface NotificationGroup
{
    packageName: string;
    items: BridgeNotification[];
    latest: number;
}

/** Notifications grouped by app: groups ordered by their newest notification, newest first inside each. */
export function groupByApp(list: readonly BridgeNotification[]): NotificationGroup[]
{
    const groups = new Map<string, NotificationGroup>();
    for (const n of [...list].sort(newestFirst))
    {
        const g = groups.get(n.packageName);
        if (g) g.items.push(n);
        else groups.set(n.packageName, { packageName: n.packageName, items: [n], latest: n.postTime });
    }
    return [...groups.values()];
}

/** How many notifications deserve attention: ongoing ones (timers, downloads) don't count. */
export function alertCount(list: readonly BridgeNotification[]): number
{
    return list.filter(n => !n.isOngoing).length;
}

export function clearableKeys(list: readonly BridgeNotification[]): string[]
{
    return list.filter(n => n.isClearable && !n.isOngoing).map(n => n.key);
}

export type NotifyTone = 'notify' | 'notifyCall' | 'notifySys';

/** The sound for a new notification, by Android category; null when it should stay silent (ongoing, media, group summaries). */
export function notifyTone(n: Pick<BridgeNotification, 'category' | 'isOngoing' | 'isMedia' | 'isGroupSummary'>): NotifyTone | null
{
    if (n.isOngoing || n.isMedia || n.isGroupSummary) return null;
    switch (n.category)
    {
        case 'call': case 'alarm': return 'notifyCall';
        case 'sys': case 'service': case 'status': case 'progress': case 'transport': return 'notifySys';
        default: return 'notify';
    }
}
