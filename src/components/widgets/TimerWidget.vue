<script setup lang="ts">
import { computed, watch } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { useSoundStore } from '@/stores/useSoundStore';
import { TIMER_PRESETS_MIN, formatTimer, isFinished, remainingMs } from '@/utils/timer';

const props = defineProps<{ id: string }>();

const sound = useSoundStore();

// the end time is stored, so the timer survives reloads and the launcher being paused
const endsAt = useLocalStorage<number | null>(`widget.timer.${props.id}`, null);
const now = useNow({ interval: 250 });

const finished = computed(() => isFinished(endsAt.value, now.value.getTime()));
const remaining = computed(() => remainingMs(endsAt.value, now.value.getTime()));

watch(finished, done => { if (done) sound.playAlways('alert'); });

const start = (minutes: number) => { endsAt.value = Date.now() + minutes * 60_000; };
const stop = () => { endsAt.value = null; };
</script>

<template>
    <div>
        <template v-if="endsAt === null">
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
.presets { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
.preset { padding: 0 6px; border: 1px solid var(--ph); &:active { @include inverse; } }
.time { font-size: 1.6em; line-height: 1.1; }
.done { animation: blink 0.8s steps(2) infinite; }
.action { padding: 2px 0; &:active { @include inverse; } }

@keyframes blink { 50% { opacity: 0.2; } }
</style>
