import type { BridgeAppUsage } from '@/types/bridge-fork';

/** Most used apps by time, skipping `exclude` and anything under a minute. */
export function topUsage(apps: readonly BridgeAppUsage[], limit: number, exclude: readonly string[] = []): BridgeAppUsage[]
{
    return apps
        .filter(a => a.totalTimeMs >= 60_000 && !exclude.includes(a.packageName))
        .sort((a, b) => b.totalTimeMs - a.totalTimeMs)
        .slice(0, limit);
}

export function totalUsageMs(apps: readonly BridgeAppUsage[], exclude: readonly string[] = [])
{
    return apps.filter(a => !exclude.includes(a.packageName)).reduce((sum, a) => sum + a.totalTimeMs, 0);
}

/** `2H 14M`, `14M`, or `<1M`. */
export function formatUsage(ms: number)
{
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return '<1M';
    const h = Math.floor(minutes / 60);
    return h ? `${h}H ${String(minutes % 60).padStart(2, '0')}M` : `${minutes}M`;
}
