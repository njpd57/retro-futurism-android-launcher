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

export const useAppsStore = defineStore('apps', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const apps = ref(new Map<string, InstalledAppInfo>());
    /** package -> when the launcher first saw it (0 = was there from the start). Device specific, not part of a backup. */
    const firstSeen = useLocalStorage<Record<string, number>>('apps.firstSeen', {});

    const requestStatus = ref(RequestStatus.Idle);
    const requestErrorMessage = ref('');

    async function requestAppsAsync()
    {
        if (requestStatus.value === RequestStatus.InProgress) return;

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