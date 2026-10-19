<script setup lang="ts">
import { ref } from 'vue';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { useWeatherStore, type City } from '@/stores/useWeatherStore';
import { formatClock, formatDateTui, sparkline } from '@/utils/tui';
import { weatherText } from '@/utils/weather';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';

const alarm = useAlarmStore();
const weather = useWeatherStore();

const picking = ref(false);
const query = ref('');
const results = ref<City[]>([]);
const searchState = ref<'idle' | 'loading' | 'error'>('idle');

async function search()
{
    if (!query.value.trim()) return;
    searchState.value = 'loading';
    try
    {
        results.value = await weather.searchCity(query.value.trim());
        searchState.value = 'idle';
    }
    catch (err)
    {
        console.error(err);
        searchState.value = 'error';
    }
}

function pick(c: City)
{
    weather.setCity(c);
    picking.value = false;
}

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
            <div v-else class="dim">{{ weather.failed ? 'SIN ENLACE' : 'CONSULTANDO…' }}</div>
            <div v-if="weather.failed && weather.forecast" class="dim">DATOS ANTIGUOS (SIN ENLACE)</div>
        </template>

        <TermMenu v-if="picking" title="CIUDAD" @close="picking = false">
            <div class="search">
                <span>&gt;</span>
                <input v-model="query" type="text" autocomplete="off" spellcheck="false" placeholder="buscar ciudad" enterkeyhint="search" @keydown.enter.prevent="search" />
            </div>
            <MenuItem @click="search"><span>BUSCAR</span></MenuItem>
            <div v-if="searchState === 'loading'" class="dim pad">BUSCANDO…</div>
            <div v-else-if="searchState === 'error'" class="dim pad">SIN ENLACE</div>
            <MenuItem v-for="c in results" :key="`${c.lat},${c.lon}`" @click="pick(c)"><span>{{ c.name.toUpperCase() }}</span></MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.pad { padding: 4px 0; }
.row { padding: 1px 0; &:active { @include inverse; } }
.temp { font-size: 1.5em; }
.spark { letter-spacing: 2px; }

.search {
    display: flex;
    gap: 8px;
    padding: 4px 0;

    > input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; border-bottom: 1px solid var(--ph); color: inherit; font: inherit; text-shadow: inherit; user-select: text; }
}
</style>
