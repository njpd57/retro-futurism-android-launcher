<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useWeatherStore } from '@/stores/useWeatherStore';
import { sparkline } from '@/utils/tui';
import { dailyRows, weatherText } from '@/utils/weather';

const weather = useWeatherStore();

const rows = computed(() => weather.forecast?.daily ? dailyRows(weather.forecast.daily) : []);
const spark = computed(() => rows.value.length ? sparkline(rows.value.map(r => r.max)) : '');

// a forecast cached before the 7-day data existed is refreshed once
onMounted(() =>
{
    if (weather.city && weather.forecast && !weather.forecast.daily) weather.refresh(true);
});
</script>

<template>
    <div>
        <div v-if="!weather.city" class="dim">SIN CIUDAD: ELÍGELA EN EL WIDGET ALARMA · CLIMA</div>
        <template v-else-if="rows.length">
            <div class="dim">{{ weather.city.name.toUpperCase() }} · MÁX {{ spark }}</div>
            <div v-for="r in rows" :key="r.day + r.max" class="row">
                <span>{{ r.day }}</span>
                <span>{{ r.min }}/{{ r.max }}°</span>
                <span class="text">{{ weatherText(r.code) }}</span>
            </div>
            <div v-if="weather.failed" class="dim">DATOS ANTIGUOS (SIN ENLACE)</div>
        </template>
        <div v-else class="dim">{{ weather.failed ? 'SIN ENLACE' : 'CONSULTANDO…' }}</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.row { display: flex; gap: 10px; white-space: nowrap; > span:first-child { width: 2.6em; } > .text { color: var(--ph-dim); overflow: hidden; text-overflow: ellipsis; } }
</style>
