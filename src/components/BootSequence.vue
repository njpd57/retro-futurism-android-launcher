<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { BOOT_STEP_MS, bootLines, visibleBootLines } from '@/utils/boot';

const emit = defineEmits<{ (e: 'done'): void }>();

const lines = bootLines();
const started = Date.now();
const elapsed = ref(0);
const shown = computed(() => visibleBootLines(lines.length, elapsed.value));

const HOLD_MS = 500;
let timer: number | undefined;

function finish()
{
    window.clearInterval(timer);
    emit('done');
}

onMounted(() =>
{
    timer = window.setInterval(() =>
    {
        elapsed.value = Date.now() - started;
        if (elapsed.value >= lines.length * BOOT_STEP_MS + HOLD_MS) finish();
    }, 40);
});

onUnmounted(() => window.clearInterval(timer));
</script>

<template>
    <div class="boot" @click="finish">
        <div v-for="(line, i) in lines.slice(0, shown)" :key="i" class="line">{{ line || ' ' }}</div>
        <div class="cursor">█</div>
        <div class="skip">TOCA PARA OMITIR</div>
    </div>
</template>

<style scoped lang="scss">
.boot {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: var(--ph-bg);
    padding: calc(var(--inset-top, 0px) + 24px) 16px 16px;
    white-space: pre;
    overflow: hidden;

    > .line { @include glow; }
    > .cursor { animation: blink 1s steps(1) infinite; }
    > .skip { position: absolute; left: 16px; bottom: calc(var(--inset-bottom, 0px) + 12px); color: var(--ph-dim); }
}

@keyframes blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .boot > .cursor { animation: none; } }
</style>
