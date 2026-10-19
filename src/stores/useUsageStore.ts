import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeAppUsage } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
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

    function requestAccess() { Bridge.requestOpenUsageAccessSettings(); }

    return { supported, canRead, apps, sync, requestAccess };
});
