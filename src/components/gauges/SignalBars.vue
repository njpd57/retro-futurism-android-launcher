<script setup lang="ts">
import { computed } from 'vue';
import { signalGeometry } from '@/utils/gauge';

const props = withDefaults(defineProps<{ level: number | null; max?: number }>(), { max: 4 });

const bars = computed(() => signalGeometry(props.level, props.max));
</script>

<template>
    <svg class="signal-bars" viewBox="0 0 20 14" aria-hidden="true">
        <rect v-for="(b, i) in bars" :key="i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :class="{ on: b.on }" />
    </svg>
</template>

<style scoped lang="scss">
.signal-bars {
    display: inline-block;
    height: 1.05em;
    width: auto;
    vertical-align: baseline;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    rect { fill: var(--ph-dim); fill-opacity: 0.3; }
    rect.on { fill: var(--ph); fill-opacity: 1; }
}
</style>
