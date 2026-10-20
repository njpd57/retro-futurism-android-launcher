<script setup lang="ts">
import { computed } from 'vue';
import { barSegments } from '@/utils/gauge';

const props = withDefaults(defineProps<{ fraction: number; segments?: number }>(), { segments: 10 });

const rects = computed(() => barSegments(props.fraction, props.segments));
</script>

<template>
    <svg class="gauge-bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <rect v-for="(s, i) in rects" :key="i" :x="s.x" :y="s.y" :width="s.w" :height="s.h" :class="{ on: s.on }" />
    </svg>
</template>

<style scoped lang="scss">
.gauge-bar {
    display: block;
    width: 100%;
    height: 0.75em;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    rect { fill: var(--ph-dim); fill-opacity: 0.3; }
    rect.on { fill: var(--ph); fill-opacity: 1; }
}
</style>
