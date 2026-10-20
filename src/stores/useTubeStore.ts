import { defineStore } from 'pinia';
import { ref } from 'vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import { useBridgeEventStore } from './useBridgeEventStore';
import { useSettingsStore } from './useSettingsStore';

/** The picture tube's own states: a degauss pulse on demand, and switching off / on around the launcher's pause. */
export const useTubeStore = defineStore('tube', () =>
{
    const settings = useSettingsStore();
    const bridgeEvents = useBridgeEventStore();

    // CrtScreen watches the counter and plays the pulse; a counter, not a flag, so two requests in a row both play
    const degaussPulse = ref(0);
    /** on: normal. off: collapsed after `beforePause`. warming: the switch-on flash after a resume */
    const power = ref<'on' | 'off' | 'warming'>('on');

    function degauss()
    {
        if (prefersReducedMotion()) return;
        degaussPulse.value++;
    }

    function switchOff()
    {
        if (!settings.tubePower || prefersReducedMotion()) return;
        power.value = 'off';
    }

    function switchOn()
    {
        if (power.value === 'off') power.value = 'warming';
    }

    function warmed() { power.value = 'on'; }

    // leaving for another app: the picture folds first and the app opens when it is gone, because by the time
    // `beforePause` arrives the screen is already leaving and the collapse would never be seen
    const COLLAPSE_MS = 420;
    const RESTORE_MS = 2500;
    let leaving = false;

    /** Plays the switch-off and then runs `go`. Without the effect (off, or reduced motion) it runs `go` at once. */
    function collapseThen(go: () => void)
    {
        if (!settings.tubePower || prefersReducedMotion()) { go(); return; }
        if (leaving) return; // a second tap while the picture is folding
        leaving = true;
        power.value = 'off';
        window.setTimeout(go, COLLAPSE_MS);
        // if the app never takes over (the launch failed), the launcher is still visible: bring the picture back
        window.setTimeout(() =>
        {
            leaving = false;
            if (document.visibilityState === 'visible' && power.value === 'off') power.value = 'on';
        }, RESTORE_MS);
    }

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'beforePause') switchOff();
        else if (ev.name === 'afterResume') switchOn();
    });
    // the page can come back without Bridge's event (a plain browser, a missed event): never stay dark
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') switchOn(); });

    return { degaussPulse, power, degauss, switchOn, warmed, collapseThen };
});
