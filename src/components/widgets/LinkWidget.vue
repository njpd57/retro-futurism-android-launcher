<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { signalBars } from '@/utils/tui';

const status = useSystemStatusStore();

const TYPE_LABEL = { wifi: 'WIFI', cellular: 'MÓVIL', ethernet: 'ETH', other: 'OTRO', none: 'SIN ENLACE' } as const;
const ARROWS = { none: '  ', in: '↓ ', out: ' ↑', inout: '↓↑', dormant: '  ' } as const;

const c = computed(() => status.connectivity);
</script>

<template>
    <div>
        <template v-if="c">
            <div>{{ TYPE_LABEL[c.type] }} <span v-if="c.type === 'wifi'">{{ signalBars(c.wifiLevel) }}</span> {{ ARROWS[c.dataActivity] }}</div>
            <div class="dim">MÓVIL {{ signalBars(c.cellularLevel) }}</div>
        </template>
        <div v-else>SIN DATOS</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
</style>
