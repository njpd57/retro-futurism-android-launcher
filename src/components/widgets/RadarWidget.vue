<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { radarContacts, radarScene } from '@/utils/radar';
import SignalScanner from '../SignalScanner.vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';

const FRAME_MS = 120;
const SWEEP_PER_SECOND = 1.6;

const bridgeEvents = useBridgeEventStore();
const notifications = useNotificationsStore();

const sweep = ref(0);
let timer: number | undefined;
let paused = false;

// every app with notifications is a contact on the radar; the more signals, the bigger the blip
const contacts = computed(() => radarContacts(notifications.visible));
const blips = computed(() => contacts.value.map(c => c.blip));
const signals = computed(() => contacts.value.reduce((n, c) => n + c.notifications.length, 0));
const scannedPackage = ref<string | null>(null);
const scene = computed(() => radarScene(sweep.value, blips.value));
/** Marks every 30 degrees on the outer ring, as short radial strokes. */
const TICKS = Array.from({ length: 12 }, (_, i) =>
{
    const a = i * Math.PI / 6;
    return `M${(Math.cos(a) * 0.94).toFixed(3)} ${(Math.sin(a) * 0.94).toFixed(3)} L${Math.cos(a).toFixed(3)} ${Math.sin(a).toFixed(3)}`;
}).join(' ');

/** A tap on a contact scans it. The hit circles are DOM elements, so the CRT curvature correction of `click` applies. */
function scanAt(i: number)
{
    scannedPackage.value = contacts.value[i].packageName;
}

function close()
{
    scannedPackage.value = null;
}

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause') paused = true;
    else if (ev.name === 'afterResume') paused = false;
}

onMounted(() =>
{
    if (prefersReducedMotion()) { sweep.value = 1; return; }
    timer = window.setInterval(() => { if (!paused) sweep.value += SWEEP_PER_SECOND * FRAME_MS / 1000; }, FRAME_MS);
    bridgeEvents.addEventListener(onBridgeEvent);
});

onBeforeUnmount(() =>
{
    window.clearInterval(timer);
    bridgeEvents.removeEventListener(onBridgeEvent);
});
</script>

<template>
    <div class="radar-widget">
        <svg class="radar" viewBox="-1.04 -1.04 2.08 2.08" preserveAspectRatio="xMidYMid meet">
            <g class="grid">
                <circle r="1" /><circle r="0.66" /><circle r="0.33" />
                <path d="M-1 0 H1 M0 -1 V1" />
                <path class="ticks" :d="TICKS" />
                <path d="M-0.05 0 H0.05 M0 -0.05 V0.05" class="center" />
            </g>
            <g class="beam">
                <path v-for="(w, i) in scene.wedges" :key="i" :d="w.d" :fill-opacity="w.opacity" />
            </g>
            <g v-for="(dot, i) in scene.dots" :key="i" class="contact-dot pressable" :opacity="dot.brightness" @click="scanAt(i)">
                <circle class="hit" :cx="dot.x" :cy="dot.y" r="0.22" />
                <circle class="blip" :cx="dot.x" :cy="dot.y" :r="dot.heavy ? 0.08 : 0.05" />
                <circle v-if="dot.heavy" class="ring" :cx="dot.x" :cy="dot.y" r="0.14" />
            </g>
        </svg>
        <div class="dim">CONTACTOS {{ contacts.length }} · SEÑALES {{ signals }}{{ contacts.length ? ' · TOCAR PARA ESCANEAR' : '' }}</div>

        <SignalScanner v-if="scannedPackage" :package-name="scannedPackage" @close="close" />
    </div>
</template>

<style scoped lang="scss">
.radar-widget { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.radar {
    flex: 1;
    min-height: 0;
    width: 100%;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    .grid { fill: none; stroke: var(--ph); stroke-opacity: 0.45; stroke-width: 1.2px; }
    .grid circle, .grid path { vector-effect: non-scaling-stroke; }
    .grid > circle:first-child { stroke-opacity: 0.9; }
    .grid .ticks { stroke-opacity: 0.9; }
    .grid .center { stroke-opacity: 1; }
    .beam path { fill: var(--ph); stroke: none; }
    .hit { fill: transparent; }
    .blip { fill: var(--ph); }
    .ring { fill: none; stroke: var(--ph); stroke-width: 1.2px; vector-effect: non-scaling-stroke; }
}
.dim { color: var(--ph-dim); flex: none; }
// a 1x1 window has no room for the caption
@container (max-height: 11em) { .dim { display: none; } }
</style>
