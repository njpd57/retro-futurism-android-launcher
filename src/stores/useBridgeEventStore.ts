import { defineStore } from "pinia";
import type { BridgeEventListener } from "@bridgelauncher/api";

export const useBridgeEventStore = defineStore('bridgeEvent', () =>
{
    const listeners = new Set<BridgeEventListener>();

    function addEventListener(listener: BridgeEventListener)
    {
        listeners.add(listener);
    }

    function removeEventListener(listener: BridgeEventListener)
    {
        listeners.delete(listener);
    }

    window.onBridgeEvent = event =>
    {
        for (const listener of listeners)
        {
            listener(event);
        }
    };

    return {
        addEventListener,
        removeEventListener,
    };
});
