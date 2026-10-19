<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { blipFromKey, radarFrame } from '@/utils/radar';

const RADIUS = 5;
const FRAME_MS = 120;
const SWEEP_PER_SECOND = 1.6;

const bridgeEvents = useBridgeEventStore();
const notifications = useNotificationsStore();

const sweep = ref(0);
let timer: number | undefined;
let paused = false;

// every notification is a contact on the radar
const blips = computed(() => notifications.visible.slice(0, 12).map(n => blipFromKey(n.key)));
const frame = computed(() => radarFrame(RADIUS, sweep.value, blips.value).join('\n'));

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
        <pre class="radar">{{ frame }}</pre>
        <div class="dim">CONTACTOS {{ blips.length }}</div>
    </div>
</template>

<style scoped lang="scss">
.radar { margin: 0; font: inherit; font-size: 0.8em; line-height: 1; letter-spacing: 0; white-space: pre; overflow: hidden; }
.dim { color: var(--ph-dim); }
</style>
