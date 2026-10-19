<script setup lang="ts">
import { ref } from 'vue';
import { useWeatherStore, type City } from '@/stores/useWeatherStore';
import { describeFetchError } from '@/utils/fetchJson';
import MenuItem from './MenuItem.vue';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const weather = useWeatherStore();

const query = ref('');
const results = ref<City[]>([]);
const state = ref<'idle' | 'loading' | 'error' | 'empty'>('idle');
const errorText = ref('');

async function search()
{
    const q = query.value.trim();
    if (!q) return;
    state.value = 'loading';
    try
    {
        results.value = await weather.searchCity(q);
        state.value = results.value.length ? 'idle' : 'empty';
    }
    catch (err)
    {
        console.error(err);
        errorText.value = describeFetchError(err);
        state.value = 'error';
    }
}

function pick(c: City)
{
    weather.setCity(c);
    emit('close');
}
</script>

<template>
    <TermMenu title="CIUDAD" @close="emit('close')">
        <div class="search">
            <span>&gt;</span>
            <TermInput v-model="query" enterkeyhint="search" placeholder="buscar ciudad" @submit="search" />
        </div>
        <MenuItem @click="search"><span>BUSCAR</span></MenuItem>
        <div v-if="state === 'loading'" class="dim pad">BUSCANDO…</div>
        <div v-else-if="state === 'error'" class="dim pad">SIN ENLACE · {{ errorText }}</div>
        <div v-else-if="state === 'empty'" class="dim pad">SIN RESULTADOS</div>
        <MenuItem v-for="c in results" :key="`${c.lat},${c.lon}`" @click="pick(c)"><span>{{ c.name.toUpperCase() }}</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.pad { padding: 4px 0; }
.search { display: flex; gap: 8px; padding: 4px 0; > .term-input { flex: 1; } }
</style>
