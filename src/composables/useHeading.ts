import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { headingFromAlpha } from '@/utils/compass';

type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

/**
 * The compass heading of the phone in degrees (null until the sensor answers, or on a device without one).
 * It listens only while the launcher is in front, like `CompassWidget`.
 */
export function useHeading()
{
    const bridgeEvents = useBridgeEventStore();

    const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const eventName = supported && 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    const heading = ref<number | null>(null);
    let listening = false;

    function onOrientation(e: Event)
    {
        const o = e as OrientationEvent;
        if (typeof o.webkitCompassHeading === 'number') heading.value = o.webkitCompassHeading;
        else if (o.absolute && typeof o.alpha === 'number') heading.value = headingFromAlpha(o.alpha);
    }

    function listen()
    {
        if (!supported || listening) return;
        listening = true;
        window.addEventListener(eventName, onOrientation);
    }

    function unlisten()
    {
        if (!listening) return;
        listening = false;
        window.removeEventListener(eventName, onOrientation);
    }

    function onBridgeEvent(ev: { name: string })
    {
        if (ev.name === 'beforePause') unlisten();
        else if (ev.name === 'afterResume') listen();
    }

    onMounted(() => { listen(); bridgeEvents.addEventListener(onBridgeEvent); });
    onBeforeUnmount(() => { unlisten(); bridgeEvents.removeEventListener(onBridgeEvent); });

    return { heading };
}
