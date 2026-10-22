<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

// The phone's camera is MOTHER's eye: two brackets frame the hole, and the camera itself is the pupil.
const props = defineProps<{ busy: boolean; alert: boolean; pulse: number }>();
const emit = defineEmits<{ (e: 'open'): void }>();

const WINK_MS = 600;

const wink = ref(false);
let timer: number | undefined;

// a new signal: the brackets close on the eye and open again
watch(() => props.pulse, () =>
{
    window.clearTimeout(timer);
    wink.value = false;
    requestAnimationFrame(() => { wink.value = true; });
    timer = window.setTimeout(() => { wink.value = false; }, WINK_MS);
});

onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
    <div class="mother-eye pressable" :class="{ busy, alert, wink }" @click="emit('open')">
        <span class="bracket left">[</span>
        <span class="bracket right">]</span>
    </div>
</template>

<style scoped lang="scss">
.mother-eye {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    color: var(--ph-dim);

    .bracket { padding: 0 2px; }

    &.busy .bracket { color: var(--ph); animation: eye-blink 0.5s steps(1, end) infinite; }
    &.alert .bracket { @include inverse; animation: eye-blink 1s steps(1, end) infinite; }
    &.wink .left { color: var(--ph); animation: wink-left 0.6s steps(3, end); }
    &.wink .right { color: var(--ph); animation: wink-right 0.6s steps(3, end); }
    &:active .bracket { @include inverse; }
}

@keyframes eye-blink {
    50% { opacity: 0.25; }
}

@keyframes wink-left {
    50% { transform: translateX(0.6em); }
}

@keyframes wink-right {
    50% { transform: translateX(-0.6em); }
}

@media (prefers-reduced-motion: reduce) {
    .mother-eye .bracket { animation: none !important; }
}
</style>
