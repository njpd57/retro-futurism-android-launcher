<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { compassPoint, compassRose, headingFromAlpha } from '@/utils/compass';

const bridgeEvents = useBridgeEventStore();

const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
const heading = ref<number | null>(null);
const noSensor = ref(false);
const rose = compassRose();

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
            <svg viewBox="-1.05 -1.12 2.1 2.2" preserveAspectRatio="xMidYMid meet">
                <g :transform="`rotate(${-heading})`">
                    <circle class="ring" r="1" />
                    <path v-for="m in rose.marks" :key="m.deg" :d="m.d" :class="{ north: m.deg === 0 }" />
                    <text v-for="l in rose.labels" :key="l.text" :x="l.x" :y="l.y" :class="{ cardinal: l.text.length === 1 }" :transform="`rotate(${heading} ${l.x} ${l.y})`">{{ l.text }}</text>
                </g>
                <path class="index" d="M0 -1.12 L-0.07 -1.02 L0.07 -1.02 Z" />
            </svg>
            <div class="big">{{ String(Math.round(heading) % 360).padStart(3, '0') }}° {{ compassPoint(heading) }}</div>
        </template>
        <div v-else class="dim">CALIBRANDO…</div>
    </div>
</template>

<style scoped lang="scss">
.compass { display: flex; flex-direction: column; align-items: center; height: 100%; min-height: 0; text-align: center; }
.dim { color: var(--ph-dim); text-align: left; }
svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    .ring { fill: none; stroke: var(--ph); stroke-opacity: 0.6; stroke-width: 1.2px; vector-effect: non-scaling-stroke; }
    path:not(.index) { fill: none; stroke: var(--ph); stroke-width: 1.2px; vector-effect: non-scaling-stroke; }
    .north { stroke-width: 2.4px; }
    .index { fill: var(--ph); }
    text { fill: var(--ph-dim); font-size: 0.17px; text-anchor: middle; dominant-baseline: central; }
    text.cardinal { fill: var(--ph); font-size: 0.26px; }
}
.big { flex: none; font-size: 1.3em; }
</style>
