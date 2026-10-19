<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { bar, formatBytes } from '@/utils/tui';

const status = useSystemStatusStore();

const used = computed(() => status.storage ? status.storage.totalBytes - status.storage.freeBytes : 0);
const fraction = computed(() => status.storage ? used.value / status.storage.totalBytes : 0);
</script>

<template>
    <div>
        <template v-if="status.storage">
            <div>MEM {{ bar(fraction, 8) }} {{ Math.round(fraction * 100) }}%</div>
            <div class="dim">USADO {{ formatBytes(used) }}</div>
            <div class="dim">LIBRE {{ formatBytes(status.storage.freeBytes) }}</div>
        </template>
        <div v-else class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
</style>
