import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeBattery, BridgeConnectivity, BridgeConnectionType, BridgeStorageStats } from "@/types/bridge-fork";
import { readJson } from "@/utils/safeJson";
import { bridgeHas } from "@/utils/bridgeHas";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useLogStore } from "./useLogStore";

interface WebBatteryManager
{
    level: number;
    charging: boolean;
    addEventListener(type: string, listener: () => void): void;
}

interface WebConnection
{
    type?: string;
}

/** Battery and connectivity from the fork when present, otherwise from the web APIs (null when there's nothing). */
export const useSystemStatusStore = defineStore('systemStatus', () =>
{
    const bridgeEvents = useBridgeEventStore();
    const log = useLogStore();

    const battery = ref<BridgeBattery | null>(null);
    const connectivity = ref<BridgeConnectivity | null>(null);
    const storage = ref<BridgeStorageStats | null>(null);

    const hasBridgeStorage = bridgeHas('getStorageStats');

    function readBridgeStorage()
    {
        if (hasBridgeStorage) storage.value = readJson<BridgeStorageStats>(() => Bridge.getStorageStats());
    }

    function readBridgeBattery()
    {
        battery.value = readJson<BridgeBattery>(() => Bridge.getBattery());
    }

    function readBridgeConnectivity()
    {
        connectivity.value = readJson<BridgeConnectivity>(() => Bridge.getConnectivity());
    }

    function readWebConnectivity()
    {
        const type = (navigator as Navigator & { connection?: WebConnection }).connection?.type;
        const known: BridgeConnectionType[] = ['wifi', 'cellular', 'ethernet'];
        connectivity.value = {
            type: !navigator.onLine ? 'none' : known.includes(type as BridgeConnectionType) ? type as BridgeConnectionType : 'other',
            wifiLevel: null,
            cellularLevel: null,
            dataActivity: 'none',
        };
    }

    async function initWebBattery()
    {
        const getBattery = (navigator as Navigator & { getBattery?: () => Promise<WebBatteryManager> }).getBattery;
        if (typeof getBattery !== 'function') return;

        try
        {
            const manager = await getBattery.call(navigator);
            const read = () => { battery.value = { level: Math.round(manager.level * 100), isCharging: manager.charging, pluggedType: null }; };
            read();
            manager.addEventListener('levelchange', read);
            manager.addEventListener('chargingchange', read);
        }
        catch (err)
        {
            console.warn('Battery Status API unavailable', err);
        }
    }

    const hasBridgeBattery = bridgeHas('getBattery');
    const hasBridgeConnectivity = bridgeHas('getConnectivity');

    readBridgeStorage();
    if (hasBridgeBattery) readBridgeBattery(); else initWebBattery();
    if (hasBridgeConnectivity) readBridgeConnectivity(); else readWebConnectivity();

    if (!hasBridgeConnectivity)
    {
        window.addEventListener('online', readWebConnectivity);
        window.addEventListener('offline', readWebConnectivity);
    }

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'batteryChanged')
        {
            const before = battery.value;
            battery.value = ev.newValue;
            if (!before || before.isCharging !== ev.newValue.isCharging)
                log.push('PWR', `${ev.newValue.isCharging ? 'CARGANDO' : 'BATERÍA'} ${ev.newValue.level}%`);
        }
        else if (ev.name === 'connectivityChanged')
        {
            const before = connectivity.value;
            connectivity.value = ev.newValue;
            if (!before || before.type !== ev.newValue.type)
                log.push('NET', `ENLACE ${ev.newValue.type.toUpperCase()}`);
        }
        else if (ev.name === 'afterResume')
        {
            readBridgeStorage();
            if (hasBridgeBattery) readBridgeBattery();
            if (hasBridgeConnectivity) readBridgeConnectivity(); else readWebConnectivity();
            log.push('SYS', 'REANUDADO');
        }
    });

    return { battery, connectivity, storage };
});
