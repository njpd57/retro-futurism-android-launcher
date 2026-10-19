<script setup lang="ts">
import { computed, watch } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { useSoundStore } from '@/stores/useSoundStore';
import { nullableJson } from '@/utils/storage';
import { EMPTY_STOPWATCH, TIMER_PRESETS_MIN, formatStopwatch, formatTimer, isFinished, lapSplits, lapStopwatch, remainingMs, startStopwatch, stopStopwatch, stopwatchElapsed, type Stopwatch } from '@/utils/timer';

const props = defineProps<{ id: string }>();

const sound = useSoundStore();

// the end time is stored, so the timer survives reloads and the launcher being paused
const endsAt = useLocalStorage<number | null>(`widget.timer.${props.id}`, null, { serializer: nullableJson((v): v is number => typeof v === 'number' && Number.isFinite(v)) });
const mode = useLocalStorage<'timer' | 'stopwatch'>(`widget.timer.${props.id}.mode`, 'timer');
const stopwatch = useLocalStorage<Stopwatch>(`widget.timer.${props.id}.sw`, EMPTY_STOPWATCH);
const now = useNow({ interval: 100 });
const elapsed = computed(() => stopwatchElapsed(stopwatch.value, now.value.getTime()));
const splits = computed(() => lapSplits(stopwatch.value.laps).reverse());

const finished = computed(() => isFinished(endsAt.value, now.value.getTime()));
const remaining = computed(() => remainingMs(endsAt.value, now.value.getTime()));

watch(finished, done => { if (done) sound.playAlways('alert'); });

const start = (minutes: number) => { endsAt.value = Date.now() + minutes * 60_000; };
const stop = () => { endsAt.value = null; };
const toggleSw = () => { stopwatch.value = stopwatch.value.running ? stopStopwatch(stopwatch.value, Date.now()) : startStopwatch(stopwatch.value, Date.now()); };
const lap = () => { stopwatch.value = lapStopwatch(stopwatch.value, Date.now()); };
const resetSw = () => { stopwatch.value = EMPTY_STOPWATCH; };
</script>

<template>
    <div>
        <div class="modes">
            <span class="mode pressable" :class="{ on: mode === 'timer' }" @click="mode = 'timer'">TEMP</span>
            <span class="mode pressable" :class="{ on: mode === 'stopwatch' }" @click="mode = 'stopwatch'">CRONO</span>
        </div>

        <template v-if="mode === 'stopwatch'">
            <div class="time">{{ formatStopwatch(elapsed) }}</div>
            <div class="sw-actions">
                <span class="action pressable" @click="toggleSw">{{ stopwatch.running ? '[PARAR]' : '[ARRANCAR]' }}</span>
                <span v-if="stopwatch.running" class="action pressable" @click="lap">[VUELTA]</span>
                <span v-else-if="elapsed > 0" class="action pressable" @click="resetSw">[CERO]</span>
            </div>
            <div v-for="(t, i) in splits.slice(0, 4)" :key="i" class="dim">V{{ String(splits.length - i).padStart(2, '0') }} {{ formatStopwatch(t) }}</div>
        </template>

        <template v-else-if="endsAt === null">
            <div class="dim">SELECCIONA TIEMPO</div>
            <div class="presets">
                <span v-for="m in TIMER_PRESETS_MIN" :key="m" class="preset pressable" @click="start(m)">{{ m }}M</span>
            </div>
        </template>
        <template v-else>
            <div class="time" :class="{ done: finished }">{{ finished ? '00:00' : formatTimer(remaining) }}</div>
            <div class="action pressable" @click="stop">{{ finished ? '[SILENCIAR]' : '[CANCELAR]' }}</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.modes { display: flex; gap: 8px; padding-bottom: 2px; }
.mode { padding: 0 4px; color: var(--ph-dim); &.on { @include inverse; } }
.sw-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.presets { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
.preset { padding: 0 6px; border: 1px solid var(--ph); &:active { @include inverse; } }
.time { font-size: 1.6em; line-height: 1.1; }
.done { animation: blink 0.8s steps(2) infinite; }
.action { padding: 2px 0; &:active { @include inverse; } }

@keyframes blink { 50% { opacity: 0.2; } }
</style>
