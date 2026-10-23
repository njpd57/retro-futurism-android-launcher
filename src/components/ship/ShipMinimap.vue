<script setup lang="ts">
import { computed } from 'vue';
import { miniMap } from '@/ship3d/minimap';
import { roomLevel, type ScreenReading } from '@/ship3d/readings';
import { STANDS } from '@/ship3d/glide';
import { isHall } from '@/ship3d/zones';
import type { ShipPose } from '@/stores/useShipStore';

const props = defineProps<{ pose: ShipPose; readings: Record<string, ScreenReading> }>();
/** tapping a room takes the camera there */
const emit = defineEmits<{ go: [room: string] }>();

const SCALE = 1.2;
const map = computed(() => miniMap(props.pose, SCALE));
const level = (zone: string) => roomLevel(props.readings, zone);
</script>

<template>
    <div class="minimap" data-no-swipe>
        <svg :width="map.w" :height="map.h" :viewBox="`0 0 ${map.w} ${map.h}`">
            <polygon v-for="r in map.rooms" :key="r.id" class="room" :class="[isHall(r.zone) ? 'hall' : level(r.zone), { go: r.id in STANDS }]"
                :points="r.points" @click.stop="r.id in STANDS && emit('go', r.id)" />
            <polygon class="you" :points="map.you" />
        </svg>
    </div>
</template>

<style scoped lang="scss">
.minimap {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 3px;
    background: var(--ph-bg);
    border: 1px solid var(--ph-dim);
    line-height: 0;

    svg { display: block; }
}

.room {
    fill: transparent;
    stroke: var(--ph-dim);
    stroke-width: 1;

    &.hall { fill: var(--ph-dim); fill-opacity: 0.3; stroke: none; }
    &.go { cursor: pointer; &:active { fill: var(--ph); } }
    &.notice { stroke: var(--ph); stroke-width: 2; }
    &.urgent { stroke: var(--ph); stroke-width: 2; animation: urgent 1s steps(1) infinite; }
}

.you { fill: var(--ph); }

@keyframes urgent { 50% { opacity: 0.2; } }

@media (prefers-reduced-motion: reduce) {
    .room.urgent { animation: none; }
}
</style>
