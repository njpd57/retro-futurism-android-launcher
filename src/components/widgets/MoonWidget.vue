<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { moonArt, moonCycle, moonIllumination, moonName } from '@/utils/moon';

const now = useNow({ interval: 60_000 });
const cycle = computed(() => moonCycle(now.value));
const art = computed(() => moonArt(cycle.value).join('\n'));
</script>

<template>
    <div class="moon">
        <pre>{{ art }}</pre>
        <div>{{ moonName(cycle) }}</div>
        <div class="dim">ILUMINADA {{ Math.round(moonIllumination(cycle) * 100) }}%</div>
    </div>
</template>

<style scoped lang="scss">
.moon { text-align: center; }
pre { margin: 0; font: inherit; line-height: 1; display: inline-block; text-align: left; }
.dim { color: var(--ph-dim); }
</style>
