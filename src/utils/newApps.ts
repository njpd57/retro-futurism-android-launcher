export const NEW_APP_DAYS = 7;

/**
 * Records when each package was first seen. The first scan ever marks every package as already known (0), so
 * nothing is flagged new on a fresh install of the launcher; later scans stamp unknown packages with `now`.
 */
export function updateFirstSeen(known: Readonly<Record<string, number>>, packages: readonly string[], now: number): Record<string, number>
{
    const firstScan = Object.keys(known).length === 0;
    const next = { ...known };
    for (const p of packages)
        if (!(p in next)) next[p] = firstScan ? 0 : now;
    return next;
}

/** Drops packages that aren't installed any more. */
export function pruneFirstSeen(known: Readonly<Record<string, number>>, installed: ReadonlySet<string>): Record<string, number>
{
    return Object.fromEntries(Object.entries(known).filter(([p]) => installed.has(p)));
}

export function isNewApp(firstSeenAt: number | undefined, now: number, days = NEW_APP_DAYS)
{
    return !!firstSeenAt && firstSeenAt > 0 && now - firstSeenAt < days * 86_400_000;
}
