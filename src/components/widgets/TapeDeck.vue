<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import type { BridgeMediaAction, BridgeMediaSession } from '@/types/bridge-fork';
import { reelGlyph, tapeCounter, tapeRun, tapeStatus, tapeUnit } from '@/utils/media';
import GaugeBar from '../gauges/GaugeBar.vue';

const props = defineProps<{ id: string; session: BridgeMediaSession; position: number; fraction: number }>();
const emit = defineEmits<{ (e: 'action', a: BridgeMediaAction): void }>();

const REEL_STEP_MS = 250;
const TAPE_WIDTH = 8;

const running = computed(() => props.session.state === 'playing');
const frame = ref(0);

// the reels turn in steps and stop with the tape; the interval also stops when the launcher is paused
const spin = usePausableInterval(() => { frame.value++; }, REEL_STEP_MS);
const sync = () => { if (running.value && !prefersReducedMotion()) spin.start(); else spin.stop(); };
watch(running, sync);
onMounted(sync);

const reels = computed(() => `${reelGlyph(frame.value, running.value)}${tapeRun(frame.value, running.value, TAPE_WIDTH)}${reelGlyph(frame.value, running.value)}`);
</script>

<template>
    <div class="deck">
        <div class="head">UNIDAD DE CINTA {{ tapeUnit(id) }} · {{ tapeStatus(session.state) }}</div>
        <div class="reels">{{ reels }}</div>
        <div class="track">{{ session.title ?? '---' }}<span v-if="session.artist" class="dim"> · {{ session.artist }}</span></div>
        <div class="count">{{ tapeCounter(position, session.durationMs) }}</div>
        <GaugeBar class="progress" :fraction="fraction" :segments="16" />
        <div class="buttons">
            <button type="button" :disabled="!session.canSkipToPrevious" @click="emit('action', 'previous')">[◀◀]</button>
            <button type="button" :class="{ on: running }" @click="emit('action', 'playPause')">[▶]</button>
            <button type="button" :disabled="!session.canSkipToNext" @click="emit('action', 'next')">[▶▶]</button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.head { font-size: 0.85em; color: var(--ph-dim); }
.reels { margin: 2px 0; white-space: pre; letter-spacing: 0; }
.track { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { font-size: 0.85em; }
.progress { margin: 2px 0; }

.buttons {
    display: flex;
    gap: 6px;

    > button {
        flex: 1;
        border: 1px solid var(--ph);
        background: var(--ph-bg);
        color: inherit;
        font: inherit;
        text-shadow: inherit;
        padding: 2px 0;

        &:active:not(:disabled) { @include inverse; }
        // the key that is down (the tape is running)
        &.on { @include inverse; }
        &:disabled { opacity: 0.35; }
    }
}

// a short window (one row of the grid) keeps the reels, the title, the bar and the keys
@container (max-height: 9em) {
    .head, .count { display: none; }
    .reels { margin: 0; }
}
</style>
