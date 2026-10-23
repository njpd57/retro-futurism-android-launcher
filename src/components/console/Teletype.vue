<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { useReducedMotion } from '@/composables/useReducedMotion';
import { advance, buildTape, emptyStrip, targetUnder, type Strip, type TickerMessage, type TickerTarget } from '@/utils/bridgeConsole';

// MOTHER's teletype: the messages are printed one character at a time and the strip moves left, in steps.
// The tape is reloaded from the latest messages only between passes, so text never jumps mid-line;
// `restart` (a tapped lamp) loads it at once so its message comes in next.
const props = defineProps<{ messages: readonly TickerMessage[]; restart: unknown }>();
const emit = defineEmits<{ (e: 'target', t: TickerTarget): void; (e: 'pass'): void }>();

const STEP_MS = 120;
const STILL_MS = 6000;

const reduced = useReducedMotion();
const tapeEl = ref<HTMLElement | null>(null);
const probe = ref<HTMLElement | null>(null);
const { width } = useElementSize(tapeEl);
const charPx = ref(8);

// VT323 is monospaced: ten characters give the cell width (measured again once the font has loaded)
function measure()
{
    if (probe.value) charPx.value = probe.value.getBoundingClientRect().width / 10 || 8;
}
onMounted(() =>
{
    measure();
    document.fonts?.ready.then(measure);
    // print the first character now so the tape is never blank while waiting for the first interval
    if (!reduced.value) step();
});

const cells = computed(() => Math.max(8, Math.floor(width.value / charPx.value)));

let tape = buildTape(props.messages);
let cursor = 0;
const strip = ref<Strip>(emptyStrip(cells.value));

watch(() => props.restart, () => { tape = buildTape(props.messages); cursor = 0; });
watch(cells, n =>
{
    strip.value = emptyStrip(n);
    if (!reduced.value) step();
});

function step()
{
    const r = advance(strip.value, cells.value, tape, cursor);
    strip.value = r.strip;
    cursor = r.cursor;
    if (r.done)
    {
        emit('pass');
        tape = buildTape(props.messages);
    }
}

// reduced motion: no moving tape, one message at a time
const still = ref(0);
const stillMessage = computed(() => props.messages[still.value % Math.max(1, props.messages.length)] ?? null);
function nextStill()
{
    still.value++;
    if (still.value % Math.max(1, props.messages.length) === 0) emit('pass');
}

const tape$ = usePausableInterval(step, STEP_MS);
const still$ = usePausableInterval(nextStill, STILL_MS);

watch(reduced, r =>
{
    if (r) { tape$.stop(); still$.start(); }
    else { still$.stop(); tape$.start(); }
}, { immediate: true });

function onTap(e: MouseEvent)
{
    if (reduced.value)
    {
        if (stillMessage.value) emit('target', stillMessage.value.target);
        return;
    }
    const rect = tapeEl.value?.getBoundingClientRect();
    if (!rect) return;
    const index = Math.floor((e.clientX - rect.left) / charPx.value);
    const t = targetUnder(strip.value, index);
    if (t) emit('target', t);
}
</script>

<template>
    <div class="teletype pressable" @click="onTap">
        <span ref="probe" class="probe" aria-hidden="true">MMMMMMMMMM</span>
        <span class="prompt">»</span>
        <span ref="tapeEl" class="tape">{{ reduced ? stillMessage?.text ?? '' : strip.text }}</span>
    </div>
</template>

<style scoped lang="scss">
.teletype {
    position: relative;
    display: flex;
    gap: 0.4em;
    padding: 0 10px;
    overflow: hidden;
    white-space: pre;
    font-size: 0.75em;
    line-height: 1.25;
    color: var(--ph-dim);
    border-bottom: 1px solid var(--ph-dim);

    .prompt { flex: none; color: var(--ph); }
    .tape { flex: 1; min-width: 0; overflow: hidden; }
    .probe { position: absolute; visibility: hidden; pointer-events: none; }

    &:active { @include inverse; }
}
</style>
