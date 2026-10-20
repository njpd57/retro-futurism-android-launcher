import { defineStore } from "pinia";
import { ref } from "vue";
import { useBridgeEventStore } from "./useBridgeEventStore";

const TICK_MS = 30_000;

/** The time the protocols and alerts are judged at: it ticks every 30 s while the launcher is on screen and catches up on resume. */
export const useShipClockStore = defineStore('shipClock', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const now = ref(new Date());
    let timer: number | undefined;

    const tick = () => { now.value = new Date(); };

    function start()
    {
        if (timer === undefined) timer = window.setInterval(tick, TICK_MS);
    }

    function stop()
    {
        window.clearInterval(timer);
        timer = undefined;
    }

    start();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause') stop();
        else if (ev.name === 'afterResume') { tick(); start(); }
    });

    return { now };
});
