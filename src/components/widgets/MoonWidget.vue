<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { moonCycle, moonIllumination, moonName, moonPath } from '@/utils/moon';

const now = useNow({ interval: 60_000 });
const cycle = computed(() => moonCycle(now.value));
const lit = computed(() => moonPath(cycle.value));
</script>

<template>
    <div class="moon">
        <svg viewBox="-1.1 -1.1 2.2 2.2" preserveAspectRatio="xMidYMid meet">
            <defs>
                <!-- the dark side: scan lines of dim phosphor, like the tube itself -->
                <pattern id="moon-dark" width="2" height="0.07" patternUnits="userSpaceOnUse">
                    <rect width="2" height="0.025" />
                </pattern>
            </defs>
            <circle class="dark" r="1" fill="url(#moon-dark)" />
            <path class="lit" :d="lit" />
            <circle class="rim" r="1" />
        </svg>
        <div class="name">{{ moonName(cycle) }}</div>
        <div class="dim illum">ILUMINADA {{ Math.round(moonIllumination(cycle) * 100) }}%</div>
    </div>
</template>

<style scoped lang="scss">
.moon { display: flex; flex-direction: column; align-items: center; height: 100%; min-height: 0; text-align: center; }
svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    filter: drop-shadow(0 0 calc(3px * var(--bloom)) var(--ph-glow));

    pattern rect { fill: var(--ph-dim); }
    .lit { fill: var(--ph); }
    .rim { fill: none; stroke: var(--ph); stroke-opacity: 0.8; stroke-width: 1.2px; vector-effect: non-scaling-stroke; }
}
.name { flex: none; white-space: nowrap; }
.dim { color: var(--ph-dim); flex: none; }
// a 1x1 window has room for the disc and the name only
@container (max-height: 11em) { .illum { display: none; } }
</style>
