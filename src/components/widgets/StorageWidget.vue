<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { formatBytes } from '@/utils/tui';
import GaugeBar from '../gauges/GaugeBar.vue';

const status = useSystemStatusStore();

const used = computed(() => status.storage ? status.storage.totalBytes - status.storage.freeBytes : 0);
const fraction = computed(() => status.storage ? used.value / status.storage.totalBytes : 0);
</script>

<template>
    <div>
        <template v-if="status.storage">
            <div class="meter"><span>MEM</span><GaugeBar :fraction="fraction" :segments="10" /><span>{{ Math.round(fraction * 100) }}%</span></div>
            <div class="dim">USADO {{ formatBytes(used) }}</div>
            <div class="dim">LIBRE {{ formatBytes(status.storage.freeBytes) }}</div>
        </template>
        <div v-else class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.meter { display: flex; align-items: center; gap: 8px; > svg { flex: 1; min-width: 0; } }
</style>
