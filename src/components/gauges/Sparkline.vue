<script setup lang="ts">
import { computed } from 'vue';
import { sparkBars, sparkLine, toPoints } from '@/utils/gauge';

const props = withDefaults(defineProps<{
    values: readonly (number | null)[];
    min?: number;
    max?: number;
    /** `bars`: one column per value (a lost sample is a tick on the floor); `line`: a polyline through them. */
    mode?: 'bars' | 'line';
}>(), { mode: 'bars' });

const bars = computed(() => sparkBars(props.values, props.min, props.max));
const points = computed(() => toPoints(sparkLine(props.values.filter((v): v is number => v !== null))));
</script>

<template>
    <svg class="sparkline" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <line class="floor" x1="0" y1="19.5" x2="100" y2="19.5" />
        <template v-if="mode === 'bars'">
            <template v-for="(b, i) in bars" :key="i">
                <rect v-if="!b.missing" :x="b.x" :y="b.y" :width="b.w" :height="b.h" />
                <rect v-else class="lost" :x="b.x" :y="17" :width="b.w" :height="3" />
            </template>
        </template>
        <polyline v-else :points="points" />
    </svg>
</template>

<style scoped lang="scss">
.sparkline {
    display: block;
    width: 100%;
    height: 1.4em;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    .floor { stroke: var(--ph-dim); stroke-opacity: 0.5; stroke-width: 1px; vector-effect: non-scaling-stroke; }
    rect { fill: var(--ph); }
    rect.lost { fill: none; stroke: var(--ph-dim); stroke-width: 1px; vector-effect: non-scaling-stroke; }
    polyline { fill: none; stroke: var(--ph); stroke-width: 1.5px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
}
</style>
