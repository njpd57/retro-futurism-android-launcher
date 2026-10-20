<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import type { BridgeNotification } from '@/types/bridge-fork';
import { appLabelFor } from '@/utils/notifications';
import { radarContacts, radarScene } from '@/utils/radar';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';

const FRAME_MS = 120;
const SWEEP_PER_SECOND = 1.6;

const bridgeEvents = useBridgeEventStore();
const notifications = useNotificationsStore();
const appsStore = useAppsStore();

const sweep = ref(0);
let timer: number | undefined;
let paused = false;

// every app with notifications is a contact on the radar; the more signals, the bigger the blip
const contacts = computed(() => radarContacts(notifications.visible));
const blips = computed(() => contacts.value.map(c => c.blip));
const signals = computed(() => contacts.value.reduce((n, c) => n + c.notifications.length, 0));
const scannedPackage = ref<string | null>(null);
const picked = ref<string | null>(null); // the key of the signal being looked at, when its app has several
const scannedContact = computed(() => contacts.value.find(c => c.packageName === scannedPackage.value) ?? null);
const scanned = computed<BridgeNotification | null>(() =>
{
    const c = scannedContact.value;
    if (!c) return null;
    if (c.notifications.length === 1) return c.notifications[0];
    return c.notifications.find(n => n.key === picked.value) ?? null;
});
const clearable = computed(() => scannedContact.value?.notifications.filter(n => n.isClearable) ?? []);
const SHOWN_SIGNALS = 8;
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
    picked.value = null;
}

function close()
{
    scannedPackage.value = null;
    picked.value = null;
}

/** Runs an action on a signal and leaves the scanner, unless the app still has other signals to look at. */
function act(fn: () => void)
{
    fn();
    close();
}

/** Back from one signal to the list of its app. */
function back()
{
    if (picked.value && (scannedContact.value?.notifications.length ?? 0) > 1) picked.value = null; else close();
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

        <TermMenu v-if="scannedContact" title="ESCÁNER" @close="back">
            <div class="contact">
                <div>CONTACTO: {{ appLabelFor(scannedContact.packageName, appsStore.apps).toUpperCase() }} · {{ scannedContact.notifications.length }} {{ scannedContact.notifications.length === 1 ? 'SEÑAL' : 'SEÑALES' }}</div>
                <template v-if="scanned">
                    <div v-if="scanned.title">{{ scanned.title }}</div>
                    <div v-if="scanned.text" class="dim">{{ scanned.text }}</div>
                </template>
            </div>

            <template v-if="scanned">
                <MenuItem @click="act(() => notifications.open(scanned!.key))"><span>ABRIR</span></MenuItem>
                <MenuItem v-if="scanned.isClearable" @click="act(() => notifications.dismiss(scanned!.key))"><span>NEUTRALIZAR</span></MenuItem>
                <MenuItem v-for="a in scanned.actions.filter(x => !x.acceptsText)" :key="a.index" @click="act(() => notifications.runAction(scanned!.key, a.index))"><span>{{ a.title.toUpperCase() }}</span></MenuItem>
                <MenuItem v-if="scannedContact.notifications.length > 1" @click="picked = null"><span>[VER TODAS]</span></MenuItem>
            </template>
            <template v-else>
                <MenuItem v-for="n in scannedContact.notifications.slice(0, SHOWN_SIGNALS)" :key="n.key" @click="picked = n.key">
                    <span class="signal">{{ n.title || n.text || n.packageName }}</span><span>»</span>
                </MenuItem>
                <div v-if="scannedContact.notifications.length > SHOWN_SIGNALS" class="contact dim">+{{ scannedContact.notifications.length - SHOWN_SIGNALS }} MÁS</div>
                <MenuItem v-if="clearable.length > 1" @click="act(() => clearable.forEach(n => notifications.dismiss(n.key)))"><span>NEUTRALIZAR TODAS ({{ clearable.length }})</span></MenuItem>
            </template>
        </TermMenu>
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
.contact { padding: 4px 10px 8px; overflow-wrap: anywhere; }
.signal { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
