<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { formatClock, formatDateTui, formatDayName, formatDuration } from '@/utils/tui';
import TuiPanel from '../TuiPanel.vue';

const now = useNow({ interval: 1000 });

// ms since the page loaded
const uptime = computed(() => (now.value, formatDuration(performance.now())));
</script>

<template>
    <TuiPanel title="SISTEMA">
        <div class="clock">{{ formatClock(now, true) }}</div>
        <div>{{ formatDayName(now) }} {{ formatDateTui(now, true) }}</div>
        <div class="dim">UPTIME {{ uptime }}</div>
    </TuiPanel>
</template>

<style scoped lang="scss">
.clock { font-size: 2em; line-height: 1; letter-spacing: 2px; }
.dim { color: var(--ph-dim); }
</style>
