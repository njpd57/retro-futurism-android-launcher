<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useHeading } from '@/composables/useHeading';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { useReducedMotion } from '@/composables/useReducedMotion';
import { crewBpm, headingText, monitorSweep, rotorScreens } from '@/utils/bridgeConsole';

// The left side of the console shows one reading at a time: heading, pulse, weather, storage. It changes by itself
// every few seconds, in one blink (no blink with reduced motion); a tap moves on at once. The time is not here: the tab bar already has it.
const props = defineProps<{ weather: string | null; storage: string | null; stress: boolean }>();

const ROTATE_MS = 4000;
const SWEEP_STEP_MS = 120;
const BLINK_MS = 120;
const CHAR_PX = 7;
/** `PULSO 72 ` before the monitor. */
const PULSE_LABEL_CHARS = 9;
const MONITOR_CELLS = 10;

const reduced = useReducedMotion();
const { heading } = useHeading();

const screens = computed(() => rotorScreens({ heading: heading.value !== null, weather: !!props.weather, storage: !!props.storage }));
const index = ref(0);
const screen = computed(() => screens.value[index.value % screens.value.length]);

// the blink between two readings: one step with the text hidden
const blank = ref(false);
let blinkTimer: number | undefined;
function next()
{
    index.value = (index.value + 1) % screens.value.length;
    if (reduced.value) return;
    window.clearTimeout(blinkTimer);
    blank.value = true;
    blinkTimer = window.setTimeout(() => { blank.value = false; }, BLINK_MS);
}
onBeforeUnmount(() => window.clearTimeout(blinkTimer));

const root = ref<HTMLElement | null>(null);
const { width } = useElementSize(root);

const now = ref(Date.now());
const rotor = usePausableInterval(next, ROTATE_MS);
const sweep = usePausableInterval(() => { now.value = Date.now(); }, SWEEP_STEP_MS);
rotor.start();

// the monitor only runs while it is the reading on screen, and never with reduced motion
watch([screen, reduced], ([s, r]) =>
{
    if (s === 'pulse' && !r) { now.value = Date.now(); sweep.start(); }
    else sweep.stop();
}, { immediate: true });

const bpm = computed(() => crewBpm(now.value, props.stress));
const cells = computed(() => Math.max(0, Math.min(MONITOR_CELLS, Math.floor(width.value / CHAR_PX) - PULSE_LABEL_CHARS)));
const text = computed(() =>
{
    switch (screen.value)
    {
        case 'heading': return headingText(heading.value ?? 0);
        case 'weather': return props.weather ?? '';
        case 'storage': return props.storage ?? '';
        default:
        {
            const label = `PULSO ${bpm.value}`;
            return reduced.value || cells.value < 4 ? label : `${label} ${monitorSweep(now.value, bpm.value, cells.value, SWEEP_STEP_MS)}`;
        }
    }
});

function onTap()
{
    next();
    rotor.stop();
    rotor.start();
}
</script>

<template>
    <div ref="root" class="rotor pressable" :class="{ blank, dim: screen === 'weather' || screen === 'storage' }" @click="onTap">{{ text }}</div>
</template>

<style scoped lang="scss">
.rotor {
    display: flex;
    align-items: center;
    height: 100%;
    min-width: 0;
    overflow: hidden;
    white-space: pre;

    &.dim { color: var(--ph-dim); }
    &.blank { visibility: hidden; }
    &:active { @include inverse; }
}
</style>
