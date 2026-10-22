<script setup lang="ts">
import type { Lamp, LampId } from '@/utils/bridgeConsole';

defineProps<{ lamps: readonly Lamp[] }>();
const emit = defineEmits<{ (e: 'press', id: LampId): void }>();
</script>

<template>
    <div class="annunciator">
        <span
            v-for="l in lamps"
            :key="l.id"
            class="lamp pressable"
            :class="{ on: l.on, blink: l.blink }"
            @click="emit('press', l.id)">{{ l.id }}</span>
    </div>
</template>

<style scoped lang="scss">
.annunciator {
    display: flex;
    align-items: center;
    gap: 0.25em;
    height: 100%;

    .lamp {
        padding: 0 2px;
        color: var(--ph-dim);
        opacity: 0.55;
        text-shadow: none;
    }

    .lamp.on { @include inverse; opacity: 1; }
    .lamp.blink { animation: lamp-blink 1s steps(1, end) infinite; }
    .lamp:active { @include inverse; opacity: 1; }
}

@keyframes lamp-blink {
    50% { background: transparent; color: var(--ph); box-shadow: none; }
}

@media (prefers-reduced-motion: reduce) {
    .annunciator .lamp.blink { animation: none; }
}
</style>
