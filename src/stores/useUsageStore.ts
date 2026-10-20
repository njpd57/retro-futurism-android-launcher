import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref } from "vue";
import type { BridgeAppUsage } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { dayRanges, type DayUsage } from "@/utils/weeklyReport";
import { useBridgeEventStore } from "./useBridgeEventStore";

const REFRESH_MS = 5 * 60_000;

/** App usage since midnight from the fork ("Usage access" permission). */
export const useUsageStore = defineStore('usage', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getAppUsageURL') && bridgeHas('getCanReadUsageStats');
    const canRead = ref(false);
    const apps = ref<BridgeAppUsage[]>([]);

    let paused = false;

    async function sync()
    {
        if (!supported) return;

        canRead.value = Bridge.getCanReadUsageStats();
        if (!canRead.value)
        {
            apps.value = [];
            return;
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        try
        {
            const resp = await fetch(Bridge.getAppUsageURL(start.getTime(), Date.now()));
            if (resp.ok)
                apps.value = ((await resp.json()) as { apps: BridgeAppUsage[] }).apps;
        }
        catch (err)
        {
            console.error(err);
        }
    }

    sync();
    window.setInterval(() => { if (!paused) sync(); }, REFRESH_MS);

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause') paused = true;
        else if (ev.name === 'afterResume') { paused = false; sync(); }
        else if (ev.name === 'canReadUsageStatsChanged') sync();
    });

    // The last two weeks, day by day, for the weekly report. Closed days never change, so they are kept
    // (top apps only) and asked for once; today is always asked again.
    const KEPT_PER_DAY = 20;
    const cache = useLocalStorage<Record<string, BridgeAppUsage[]>>('widget.weekly.cache', {});
    const history = ref<DayUsage[]>([]);
    const loadingHistory = ref(false);

    async function loadHistory()
    {
        if (!supported || loadingHistory.value) return;
        canRead.value = Bridge.getCanReadUsageStats();
        if (!canRead.value) { history.value = []; return; }

        loadingHistory.value = true;
        try
        {
            const now = new Date();
            const ranges = dayRanges(now);
            const known = cache.value && typeof cache.value === 'object' ? cache.value : {};
            const next: Record<string, BridgeAppUsage[]> = {};
            const days: DayUsage[] = [];
            for (let i = 0; i < ranges.length; i++)
            {
                const r = ranges[i];
                const isToday = i === ranges.length - 1;
                let apps = !isToday && Array.isArray(known[r.day]) ? known[r.day] : null;
                if (!apps)
                {
                    const resp = await fetch(Bridge.getAppUsageURL(r.from, r.to));
                    apps = resp.ok ? ((await resp.json()) as { apps: BridgeAppUsage[] }).apps.slice(0, KEPT_PER_DAY) : [];
                }
                if (!isToday) next[r.day] = apps;
                days.push({ day: r.day, apps });
            }
            cache.value = next;
            history.value = days;
        }
        catch (err)
        {
            console.error(err);
        }
        finally
        {
            loadingHistory.value = false;
        }
    }

    function requestAccess() { Bridge.requestOpenUsageAccessSettings(); }

    return { supported, canRead, apps, sync, history, loadingHistory, loadHistory, requestAccess };
});
