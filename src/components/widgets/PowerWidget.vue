<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import GaugeBar from '../gauges/GaugeBar.vue';

const status = useSystemStatusStore();

const level = computed(() => status.battery?.level ?? null);
const state = computed(() =>
{
    const b = status.battery;
    if (!b) return 'SIN DATOS';
    if (b.isCharging) return `CARGANDO ${b.pluggedType?.toUpperCase() ?? ''}`.trim();
    return b.level <= 15 ? 'BATERÍA BAJA' : 'EN BATERÍA';
});
</script>

<template>
    <div>
        <div v-if="level !== null" class="meter"><span>BAT</span><GaugeBar :fraction="level / 100" :segments="10" /><span>{{ level }}%</span></div>
        <div v-else>BAT --</div>
        <div class="dim" :class="{ low: level !== null && level <= 15 && !status.battery?.isCharging }">{{ state }}</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.meter { display: flex; align-items: center; gap: 8px; > svg { flex: 1; min-width: 0; } }
.low { color: var(--ph); animation: blink 1s steps(2) infinite; }

@keyframes blink { 50% { opacity: 0.25; } }
</style>
