<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { compassPoint, compassStrip, headingFromAlpha } from '@/utils/compass';

const bridgeEvents = useBridgeEventStore();

const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
const heading = ref<number | null>(null);
const noSensor = ref(false);
const strip = computed(() => heading.value === null ? '' : compassStrip(heading.value, 23));

const EVENT = supported && 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

function onOrientation(e: Event)
{
    const o = e as OrientationEvent;
    if (typeof o.webkitCompassHeading === 'number') heading.value = o.webkitCompassHeading;
    else if (o.absolute && typeof o.alpha === 'number') heading.value = headingFromAlpha(o.alpha);
}

let listening = false;
let giveUp: number | undefined;

function listen()
{
    if (!supported || listening) return;
    listening = true;
    // the plain event's alpha is relative to an arbitrary start in Chrome: only trust it where it carries a compass heading
    window.addEventListener(EVENT, onOrientation);
    giveUp = window.setTimeout(() => { if (heading.value === null) noSensor.value = true; }, 3000);
}

function unlisten()
{
    if (!listening) return;
    listening = false;
    window.clearTimeout(giveUp);
    window.removeEventListener(EVENT, onOrientation);
}

// the sensor is only read while the launcher is in front
function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause') unlisten();
    else if (ev.name === 'afterResume') listen();
}

onMounted(() => { listen(); bridgeEvents.addEventListener(onBridgeEvent); });
onBeforeUnmount(() => { unlisten(); bridgeEvents.removeEventListener(onBridgeEvent); });
</script>

<template>
    <div class="compass">
        <div v-if="!supported || noSensor" class="dim">NO DISPONIBLE: SIN SENSOR DE ORIENTACIÓN</div>
        <template v-else-if="heading !== null">
            <div class="strip">{{ strip }}</div>
            <div class="mark">▲</div>
            <div class="big">{{ String(Math.round(heading) % 360).padStart(3, '0') }}° {{ compassPoint(heading) }}</div>
        </template>
        <div v-else class="dim">CALIBRANDO…</div>
    </div>
</template>

<style scoped lang="scss">
.compass { text-align: center; }
.dim { color: var(--ph-dim); text-align: left; }
.strip { white-space: pre; letter-spacing: 1px; overflow: hidden; }
.mark { line-height: 1; }
.big { font-size: 1.3em; }
</style>
