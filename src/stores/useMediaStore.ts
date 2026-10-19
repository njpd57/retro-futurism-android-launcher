import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeMediaAction, BridgeMediaSession } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { readJson } from "@/utils/safeJson";
import { useBridgeEventStore } from "./useBridgeEventStore";

/** The current media session from the fork (needs notification access). Null when nothing plays or it isn't supported. */
export const useMediaStore = defineStore('media', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getMediaSession');
    const session = ref<BridgeMediaSession | null>(null);

    function read()
    {
        if (!supported) return;
        session.value = readJson<BridgeMediaSession>(() => Bridge.getMediaSession());
    }

    read();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'mediaSessionChanged')
            session.value = ev.session;
        else if (ev.name === 'afterResume')
            read();
    });

    function action(a: BridgeMediaAction) { Bridge.requestMediaAction(a); }
    function openApp() { Bridge.requestOpenMediaApp(); }

    return { supported, session, action, openApp };
});
