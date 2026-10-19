<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import { bar } from '@/utils/tui';

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
        <div v-if="level !== null">BAT {{ bar(level / 100, 8) }} {{ level }}%</div>
        <div v-else>BAT --</div>
        <div class="dim" :class="{ low: level !== null && level <= 15 && !status.battery?.isCharging }">{{ state }}</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.low { color: var(--ph); animation: blink 1s steps(2) infinite; }

@keyframes blink { 50% { opacity: 0.25; } }
</style>
