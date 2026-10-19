import { defineStore } from "pinia";
import { onScopeDispose, ref } from "vue";
import { isIdle } from "@/utils/idle";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useSettingsStore } from "./useSettingsStore";

/** Idle detection: after N minutes without a touch or key the launcher shows the idle clock. Stops while paused. */
export const useIdleStore = defineStore('idle', () =>
{
    const settings = useSettingsStore();
    const bridgeEvents = useBridgeEventStore();

    const idle = ref(false);
    let last = Date.now();
    let timer: number | undefined;

    function touch()
    {
        last = Date.now();
    }

    function check()
    {
        if (!idle.value && isIdle(Date.now(), last, settings.idleMinutes)) idle.value = true;
    }

    function wake()
    {
        idle.value = false;
        touch();
    }

    function start()
    {
        if (timer === undefined) timer = window.setInterval(check, 5000);
    }

    function stop()
    {
        window.clearInterval(timer);
        timer = undefined;
    }

    // the wake-up tap is handled by the idle overlay itself, which is on top
    window.addEventListener('pointerdown', touch, { capture: true });
    window.addEventListener('keydown', touch, { capture: true });
    start();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause') stop();
        else if (ev.name === 'afterResume') { touch(); start(); }
    });

    onScopeDispose(() =>
    {
        stop();
        window.removeEventListener('pointerdown', touch, { capture: true });
        window.removeEventListener('keydown', touch, { capture: true });
    });

    return { idle, wake };
});
