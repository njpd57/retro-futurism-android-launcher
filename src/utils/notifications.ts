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

export function clearableKeys(list: readonly BridgeNotification[]): string[]
{
    return list.filter(n => n.isClearable && !n.isOngoing).map(n => n.key);
}
