<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAnimStore } from '@/stores/useAnimStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { useTubeStore } from '@/stores/useTubeStore';
import { BOOT_STEP_MS, bootFrame, bootLines, bootScreen, bootScript, bootScriptMs } from '@/utils/boot';

const emit = defineEmits<{ (e: 'done'): void }>();

const anim = useAnimStore();
const tube = useTubeStore();
const elapsed = ref(0);
// with text animation on: the long boot (typed lines, a memory test that counts, a bar that fills);
// off: every line appears whole in its step, as it always did
const long = anim.text;
const script = bootScript();
const lines = bootLines();
const total = long ? bootScriptMs(script) : lines.length * BOOT_STEP_MS;
const shown = computed(() => long ? bootScreen(script, elapsed.value) : bootFrame(lines, elapsed.value, false));

const HOLD_MS = 500;
let raf = 0;
let finished = false;

function finish()
{
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    emit('done');
}

// requestAnimationFrame and the clock, so the typing follows the display's refresh rate
const sound = useSoundStore();

onMounted(() =>
{
    sound.play('boot');
    if (anim.transitions) tube.startUp();
    const started = performance.now();
    const frame = (t: number) =>
    {
        elapsed.value = t - started;
        if (elapsed.value >= total + HOLD_MS) finish();
        else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
});

onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
    <div class="boot" @click="finish">
        <div v-for="(line, i) in shown" :key="i" class="line">{{ line || ' ' }}</div>
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
