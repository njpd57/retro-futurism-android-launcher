<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import SignalBars from '../gauges/SignalBars.vue';

const status = useSystemStatusStore();

const TYPE_LABEL = { wifi: 'WIFI', cellular: 'MÓVIL', ethernet: 'ETH', other: 'OTRO', none: 'SIN ENLACE' } as const;
const ARROWS = { none: '  ', in: '↓ ', out: ' ↑', inout: '↓↑', dormant: '  ' } as const;

const c = computed(() => status.connectivity);
</script>

<template>
    <div>
        <template v-if="c">
            <div class="line">{{ TYPE_LABEL[c.type] }} <SignalBars v-if="c.type === 'wifi'" :level="c.wifiLevel" /> <span class="arrows">{{ ARROWS[c.dataActivity] }}</span></div>
            <div class="line dim">MÓVIL <SignalBars :level="c.cellularLevel" /></div>
        </template>
        <div v-else>SIN DATOS</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.line { display: flex; align-items: center; gap: 8px; white-space: pre; }
.arrows { white-space: pre; }
</style>
