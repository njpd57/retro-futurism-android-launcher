import { onBeforeUnmount } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';

/**
 * An interval that stops on `beforePause` and restarts on `afterResume`, as every looping widget must.
 * `start` / `stop` are manual switches (e.g. a game); the interval only runs while started and not paused.
 */
export function usePausableInterval(fn: () => void, ms: number)
{
    const bridgeEvents = useBridgeEventStore();
    let timer: number | undefined;
    let wanted = false;

    const clear = () => { window.clearInterval(timer); timer = undefined; };
    const begin = () => { if (wanted && timer === undefined) timer = window.setInterval(fn, ms); };

    function onBridgeEvent(ev: { name: string })
    {
        if (ev.name === 'beforePause') clear();
        else if (ev.name === 'afterResume') begin();
    }

    bridgeEvents.addEventListener(onBridgeEvent);
    onBeforeUnmount(() =>
    {
        wanted = false;
        clear();
        bridgeEvents.removeEventListener(onBridgeEvent);
    });

    return {
        start() { wanted = true; begin(); },
        stop() { wanted = false; clear(); },
    };
}
