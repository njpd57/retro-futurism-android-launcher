<script setup lang="ts">
import { ref } from 'vue';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { useWeatherStore } from '@/stores/useWeatherStore';
import { formatClock, formatDateTui, sparkline } from '@/utils/tui';
import { weatherText } from '@/utils/weather';
import CityPicker from '../CityPicker.vue';

const alarm = useAlarmStore();
const weather = useWeatherStore();

const picking = ref(false);

function alarmLabel(triggerTime: number)
{
    const d = new Date(triggerTime);
    const sameDay = d.toDateString() === new Date().toDateString();
    return `${sameDay ? 'HOY' : formatDateTui(d)} ${formatClock(d)}`;
}
</script>

<template>
    <div>
        <div v-if="alarm.supported" class="row" @click="alarm.openAlarms()">
            ALARMA {{ alarm.nextAlarm ? alarmLabel(alarm.nextAlarm.triggerTime) : '--' }}
        </div>
        <div v-else class="dim">ALARMA NO DISPONIBLE</div>

        <div class="row" @click="picking = true">
            <template v-if="weather.city">{{ weather.city.name.toUpperCase() }} ›</template>
            <template v-else>[ELEGIR CIUDAD]</template>
        </div>

        <template v-if="weather.city">
            <div v-if="weather.forecast">
                <span class="temp">{{ Math.round(weather.forecast.temperature) }}°C</span> {{ weatherText(weather.forecast.code) }}
                <div class="spark">{{ sparkline(weather.forecast.hourly) }}</div>
            </div>
            <div v-else class="dim">{{ weather.failed ? `SIN ENLACE · ${weather.lastError}` : 'CONSULTANDO…' }}</div>
            <div v-if="weather.failed && weather.forecast" class="dim">DATOS ANTIGUOS · {{ weather.lastError }}</div>
            <div v-if="weather.failed" class="row" @click="weather.refresh(true)">[REINTENTAR]</div>
        </template>

        <CityPicker v-if="picking" @close="picking = false" />
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.row { padding: 1px 0; &:active { @include inverse; } }
.temp { font-size: 1.5em; }
.spark { letter-spacing: 2px; }
</style>
