<script setup lang="ts">
import { computed, ref } from 'vue';
import TermInput from '../TermInput.vue';
import { useSentinelStore } from '@/stores/useSentinelStore';
import { MAX_SITES, siteLabel, sitesSummary } from '@/utils/sentinel';
import { formatClock } from '@/utils/tui';
import { latencyStats } from '@/utils/telemetry';

defineProps<{ id: string }>();

const sentinel = useSentinelStore();
const summary = computed(() => sitesSummary(sentinel.sites.map(sentinel.stateOf)));

const editing = ref(false);
const draft = ref('');
const bad = ref(false);

function add()
{
    if (!draft.value.trim()) return;
    if (!sentinel.add(draft.value)) { bad.value = true; return; }
    draft.value = '';
    bad.value = false;
}

function glyph(url: string)
{
    const s = sentinel.stateOf(url).status;
    return s === 'up' ? '▓' : s === 'down' ? '░' : '▒';
}

function detail(url: string)
{
    const s = sentinel.stateOf(url);
    if (s.status === 'down') return `CAÍDO ${formatClock(new Date(s.since))}`;
    if (s.status === 'unknown') return '…';
    const last = latencyStats(sentinel.history[url] ?? []).last;
    return last === null ? '' : `${last} MS`;
}
</script>

<template>
    <div class="sentinel">
        <div class="head" :class="{ alarm: summary.down > 0 }">
            <span>{{ summary.down ? `${summary.down} CAÍDO${summary.down > 1 ? 'S' : ''}` : `${summary.up}/${summary.total} EN LÍNEA` }}</span>
            <span class="action pressable" @click="editing = !editing">{{ editing ? '[LISTO]' : '[EDITAR]' }}</span>
        </div>
        <div v-for="url in sentinel.sites" :key="url" class="site pressable" :class="{ down: sentinel.stateOf(url).status === 'down' }" @click="editing ? sentinel.remove(url) : sentinel.probe(url)">
            <span class="glyph">{{ editing ? '[X]' : glyph(url) }}</span>
            <span class="name">{{ siteLabel(url) }}</span>
            <span class="detail">{{ detail(url) }}</span>
        </div>
        <div v-if="!sentinel.sites.length" class="dim">SIN SITIOS</div>
        <template v-if="editing && sentinel.sites.length < MAX_SITES">
            <TermInput v-model="draft" placeholder="DOMINIO" @submit="add" />
            <div v-if="bad" class="dim">SITIO NO VÁLIDO O REPETIDO</div>
            <span class="action pressable" @click="add">[AÑADIR]</span>
        </template>
    </div>
</template>

<style scoped lang="scss">
.sentinel { height: 100%; container-type: inline-size; }
.dim { color: var(--ph-dim); }
.head { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; &.alarm { @include inverse; padding: 0 4px; } }
.action { display: inline-block; &:active { @include inverse; } }
.site {
    display: flex;
    gap: 8px;
    white-space: nowrap;
    &.down { @include inverse; }
    &:active { @include inverse; }
    .glyph { flex: none; }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .detail { color: var(--ph-dim); flex: none; }
    &.down .detail { color: inherit; }
}
input {
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ph-dim);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
}
@container (max-width: 160px) { .detail { display: none; } }
</style>
