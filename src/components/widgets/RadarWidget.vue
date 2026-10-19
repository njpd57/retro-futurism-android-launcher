<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import type { BridgeNotification } from '@/types/bridge-fork';
import { appLabelFor } from '@/utils/notifications';
import { blipFromKey, nearestBlip, radarFrame } from '@/utils/radar';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';

const RADIUS = 5;
const FRAME_MS = 120;
const SWEEP_PER_SECOND = 1.6;

const bridgeEvents = useBridgeEventStore();
const notifications = useNotificationsStore();
const appsStore = useAppsStore();

const sweep = ref(0);
let timer: number | undefined;
let paused = false;

// every notification is a contact on the radar
const contacts = computed(() => notifications.visible.slice(0, 12));
const blips = computed(() => contacts.value.map(n => blipFromKey(n.key)));
const scanned = ref<BridgeNotification | null>(null);
const frame = computed(() => radarFrame(RADIUS, sweep.value, blips.value).join('\n'));

// A tap on the radar scans the nearest contact: the tapped spot is mapped to a grid cell by the text block's size.
function scan(e: MouseEvent)
{
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const col = Math.floor((e.clientX - rect.left) / rect.width * (RADIUS * 4 + 1));
    const row = Math.floor((e.clientY - rect.top) / rect.height * (RADIUS * 2 + 1));
    const i = nearestBlip(RADIUS, col, row, blips.value);
    if (i >= 0) scanned.value = contacts.value[i];
}

function act(fn: () => void)
{
    fn();
    scanned.value = null;
}

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause') paused = true;
    else if (ev.name === 'afterResume') paused = false;
}

onMounted(() =>
{
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { sweep.value = 1; return; }
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
    <div>
        <pre class="radar pressable" @click="scan">{{ frame }}</pre>
        <div class="dim">CONTACTOS {{ blips.length }}{{ blips.length ? ' · TOCAR PARA ESCANEAR' : '' }}</div>

        <TermMenu v-if="scanned" title="ESCÁNER" @close="scanned = null">
            <div class="contact">
                <div>CONTACTO: {{ appLabelFor(scanned.packageName, appsStore.apps).toUpperCase() }}</div>
                <div v-if="scanned.title">{{ scanned.title }}</div>
                <div v-if="scanned.text" class="dim">{{ scanned.text }}</div>
            </div>
            <MenuItem @click="act(() => notifications.open(scanned!.key))"><span>ABRIR</span></MenuItem>
            <MenuItem v-if="scanned.isClearable" @click="act(() => notifications.dismiss(scanned!.key))"><span>NEUTRALIZAR</span></MenuItem>
            <MenuItem v-for="a in scanned.actions.filter(x => !x.acceptsText)" :key="a.index" @click="act(() => notifications.runAction(scanned!.key, a.index))"><span>{{ a.title.toUpperCase() }}</span></MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.radar { margin: 0; font: inherit; font-size: 0.8em; line-height: 1; letter-spacing: 0; white-space: pre; overflow: hidden; }
.dim { color: var(--ph-dim); }
.contact { padding: 4px 10px 8px; overflow-wrap: anywhere; }
</style>
