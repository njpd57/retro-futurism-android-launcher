import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeNextAlarm } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { useBridgeEventStore } from "./useBridgeEventStore";

export const useAlarmStore = defineStore('alarm', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getNextAlarm');
    const nextAlarm = ref<BridgeNextAlarm | null>(null);

    function read()
    {
        if (supported)
            nextAlarm.value = JSON.parse(Bridge.getNextAlarm()) as BridgeNextAlarm | null;
    }

    read();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'nextAlarmChanged')
            nextAlarm.value = ev.newValue;
        else if (ev.name === 'afterResume')
            read();
    });

    function openAlarms() { Bridge.requestOpenAlarms(); }

    return { supported, nextAlarm, openAlarms };
});
