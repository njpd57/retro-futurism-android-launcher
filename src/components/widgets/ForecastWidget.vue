<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useWeatherStore } from '@/stores/useWeatherStore';
import CityPicker from '../CityPicker.vue';
import Sparkline from '../gauges/Sparkline.vue';
import { dailyRows, weatherText } from '@/utils/weather';

const weather = useWeatherStore();
const picking = ref(false);

const rows = computed(() => weather.forecast?.daily ? dailyRows(weather.forecast.daily) : []);
const maxes = computed(() => rows.value.map(r => r.max));

// a forecast cached before the 7-day data existed is refreshed once
onMounted(() =>
{
    if (weather.city && weather.forecast && !weather.forecast.daily) weather.refresh(true);
});
</script>

<template>
    <div>
        <div v-if="!weather.city" class="action pressable" @click="picking = true">[ELEGIR CIUDAD]</div>
        <template v-else-if="rows.length">
            <div class="dim pressable" @click="picking = true">{{ weather.city.name.toUpperCase() }} · MÁX</div>
            <Sparkline mode="line" :values="maxes" />
            <div v-for="r in rows" :key="r.day + r.max" class="row">
                <span>{{ r.day }}</span>
                <span>{{ r.min }}/{{ r.max }}°</span>
                <span class="text">{{ weatherText(r.code) }}</span>
            </div>
            <div v-if="weather.failed" class="dim">DATOS ANTIGUOS · {{ weather.lastError }}</div>
        </template>
        <template v-else>
            <div class="dim pressable" @click="picking = true">{{ weather.city.name.toUpperCase() }} ›</div>
            <div class="dim">{{ weather.failed ? `SIN ENLACE · ${weather.lastError}` : 'CONSULTANDO…' }}</div>
            <div v-if="weather.failed" class="action pressable" @click="weather.refresh(true)">[REINTENTAR]</div>
        </template>

        <CityPicker v-if="picking" @close="picking = false" />
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.action { padding: 2px 0; &:active { @include inverse; } }
.row { display: flex; gap: 10px; white-space: nowrap; > span:first-child { width: 2.6em; } > .text { color: var(--ph-dim); overflow: hidden; text-overflow: ellipsis; } }
</style>
