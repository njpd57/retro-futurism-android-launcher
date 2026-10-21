<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAnimStore } from '@/stores/useAnimStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { typewriterAdvance } from '@/utils/anim';

const props = withDefaults(defineProps<{
    text: string;
    /** Type it out. Decided when the component appears: text that is already there (a loaded session) shows whole. */
    animate?: boolean;
    /** The text may still grow (a streamed answer): keep the cursor lit even when the typing has caught up. */
    busy?: boolean;
    cps?: number;
}>(), { animate: false, busy: false, cps: 70 });

const emit = defineEmits<{ (e: 'progress'): void }>();

const anim = useAnimStore();
const sound = useSoundStore();
const active = props.animate && anim.text;

const pos = ref(active ? 0 : props.text.length);
const shownLength = computed(() => active ? Math.min(props.text.length, Math.floor(pos.value)) : props.text.length);
const shown = computed(() => props.text.slice(0, shownLength.value));
const typing = computed(() => shownLength.value < props.text.length);

// driven by requestAnimationFrame and the clock, so it types at the same speed at 60 or 120 Hz
let raf = 0;
let last = 0;

function frame(t: number)
{
    const dt = last ? Math.min(100, t - last) : 16;
    last = t;
    pos.value = typewriterAdvance(pos.value, props.text.length, dt, props.cps);
    if (pos.value < props.text.length) raf = requestAnimationFrame(frame);
    else { raf = 0; last = 0; }
}

function kick()
{
    if (!active || raf || pos.value >= props.text.length) return;
    last = 0;
    raf = requestAnimationFrame(frame);
}

// a soft tick every few characters, never more often than the ear can use
let lastTick = 0;
watch(shownLength, (n, was) =>
{
    emit('progress');
    if (n <= was) return;
    const now = performance.now();
    if (now - lastTick >= 45) { lastTick = now; sound.play('tick'); }
});

watch(() => props.text, kick);
onMounted(kick);
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
    <span>{{ shown }}<span v-if="typing || busy" class="cursor" /></span>
</template>

<style scoped lang="scss">
.cursor {
    display: inline-block;
    width: 0.6em;
    height: 1em;
    margin-left: 2px;
    vertical-align: text-bottom;
    background: var(--ph);
    animation: blink $dur-cursor steps(2) infinite;
}

@keyframes blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
</style>
