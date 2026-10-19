import { simplifyString } from "@/utils/misc-utils";
import { defineStore } from "pinia";
import { ref } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { pruneFirstSeen, updateFirstSeen } from "@/utils/newApps";
import { useBridgeEventStore } from "./useBridgeEventStore";
import type { BridgeGetAppsResponse, BridgeInstalledAppInfo } from "@bridgelauncher/api";

export interface InstalledAppInfo extends BridgeInstalledAppInfo
{
    labelSimplified: string;
}

export enum RequestStatus
{
    Idle,
    InProgress,
    Error,
}

const MAX_RETRIES = 4;
const RETRY_MS = 1500;

export const useAppsStore = defineStore('apps', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const apps = ref(new Map<string, InstalledAppInfo>());
    /** package -> when the launcher first saw it (0 = was there from the start). Device specific, not part of a backup. */
    const firstSeen = useLocalStorage<Record<string, number>>('apps.firstSeen', {});

    const requestStatus = ref(RequestStatus.Idle);
    const requestErrorMessage = ref('');

    let retries = 0;
    let retryTimer: number | undefined;

    async function requestAppsAsync()
    {
        if (requestStatus.value === RequestStatus.InProgress) return;
        window.clearTimeout(retryTimer);

        requestStatus.value = RequestStatus.InProgress;
        requestErrorMessage.value = '';

        try
        {
            const resp = await fetch(Bridge.getAppsURL());
            const respApps = await resp.json() as BridgeGetAppsResponse;

            const newApps = new Map<string, InstalledAppInfo>();

            for (const a of respApps.apps) 
            {
                newApps.set(a.packageName, processAppFromAPI(a));
            }

            retries = 0;
            apps.value = newApps;
            if (newApps.size)
                firstSeen.value = pruneFirstSeen(updateFirstSeen(firstSeen.value, [...newApps.keys()], Date.now()), new Set(newApps.keys()));
            requestStatus.value = RequestStatus.Idle;
        }
        catch (err)
        {
            console.error(err);
            requestStatus.value = RequestStatus.Error;
            requestErrorMessage.value = `${err}`;

            // Bridge may not be ready yet at startup: retry a few times instead of staying with an empty list
            if (retries < MAX_RETRIES)
                retryTimer = window.setTimeout(requestAppsAsync, RETRY_MS * ++retries);
        }
    }

    function processAppFromAPI(a: BridgeInstalledAppInfo): InstalledAppInfo
    {
        return {
            ...a,
            labelSimplified: simplifyString(a.label),
        };
    }

    requestAppsAsync();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'appInstalled' || ev.name === 'appChanged')
        {
            apps.value.set(ev.app.packageName, processAppFromAPI(ev.app));
            if (ev.name === 'appInstalled')
                firstSeen.value = updateFirstSeen(firstSeen.value, [ev.app.packageName], Date.now());
        }
        else if (ev.name === 'afterResume')
        {
            // apps installed or removed while the launcher was paused don't send events
            requestAppsAsync();
        }
        else if (ev.name === 'appRemoved')
        {
            apps.value.delete(ev.packageName);
        }
    });

    return {
        apps,
        firstSeen,
        requestAppsAsync,
        requestStatus,
        requestErrorMessage,
    };
});