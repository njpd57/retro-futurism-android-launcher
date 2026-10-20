<script setup lang="ts">
import { computed, ref } from 'vue';
import { useIsolationStore } from '@/stores/useIsolationStore';
import { infiniteUnlocked, ACHIEVEMENTS } from '@/games/isolation/progress';
import { ENDINGS, LOGS } from '@/games/isolation/logs';
import { bar, formatDuration } from '@/utils/tui';

const emit = defineEmits<{ (e: 'close'): void }>();
const isolation = useIsolationStore();

const TABS = ['REGISTROS', 'LOGROS', 'ESTADÍSTICAS'] as const;
const tab = ref<(typeof TABS)[number]>('REGISTROS');
const open = ref<string | null>(null);

const p = computed(() => isolation.progress);
const has = (id: string) => p.value.logs.includes(id);
const toggle = (id: string) => { if (has(id)) open.value = open.value === id ? null : id; };
const endingsSeen = computed(() => Object.entries(ENDINGS).filter(([id]) => p.value.endings.includes(id as keyof typeof ENDINGS)));
</script>

<template>
    <div class="archive">
        <div class="top">
            <span class="title">AISLAMIENTO · ARCHIVO</span>
            <button class="key pressable" @click="emit('close')">[CERRAR]</button>
        </div>
        <div class="tabs">
            <button v-for="t in TABS" :key="t" class="key pressable" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
        </div>

        <div class="body" data-no-swipe>
            <template v-if="tab === 'REGISTROS'">
                <div class="dim">{{ bar(p.logs.length / LOGS.length, 12) }} {{ p.logs.length }}/{{ LOGS.length }} · SE LEEN EN LOS TERMINALES</div>
                <div v-for="(l, i) in LOGS" :key="l.id" class="entry">
                    <button class="row pressable" :class="{ off: !has(l.id) }" @click="toggle(l.id)">
                        <span>{{ String(i + 1).padStart(2, '0') }}</span>
                        <span v-if="has(l.id)">{{ l.author }} · {{ l.title }}</span>
                        <span v-else>███ · SIN LEER</span>
                    </button>
                    <div v-if="open === l.id" class="text"><div v-for="line in l.lines" :key="line">{{ line }}</div></div>
                </div>
                <template v-if="endingsSeen.length">
                    <div class="dim sub">FINALES</div>
                    <div v-for="[id, e] in endingsSeen" :key="id" class="entry">
                        <button class="row pressable" @click="toggle(`end-${id}`)"><span>»</span><span>{{ e.title }}</span></button>
                        <div v-if="open === `end-${id}`" class="text"><div v-for="line in e.lines" :key="line">{{ line || '&nbsp;' }}</div></div>
                    </div>
                </template>
            </template>

            <template v-else-if="tab === 'LOGROS'">
                <div class="dim">{{ bar(p.achievements.length / ACHIEVEMENTS.length, 10) }} {{ p.achievements.length }}/{{ ACHIEVEMENTS.length }}</div>
                <div v-for="a in ACHIEVEMENTS" :key="a.id" class="entry">
                    <div class="row" :class="{ off: !p.achievements.includes(a.id) }">
                        <span>{{ p.achievements.includes(a.id) ? '[X]' : '[ ]' }}</span>
                        <span>{{ a.title }}</span>
                    </div>
                    <div class="hint dim">{{ a.hint }}</div>
                </div>
            </template>

            <template v-else>
                <div class="stat"><span>TIEMPO DE JUEGO</span><span>{{ formatDuration(p.stats.timeMs) }}</span></div>
                <div class="stat"><span>CUBIERTAS SUPERADAS</span><span>{{ p.stats.decks }}</span></div>
                <div class="stat"><span>TRIPULANTES PERDIDOS</span><span>{{ p.stats.deaths }}</span></div>
                <div class="stat"><span>CAMPAÑAS TERMINADAS</span><span>{{ p.stats.campaigns }}</span></div>
                <div class="stat"><span>DISPAROS DE LANZALLAMAS</span><span>{{ p.stats.fires }}</span></div>
                <div class="stat"><span>MODO INFINITO</span><span>{{ infiniteUnlocked(p) ? 'ABIERTO' : 'BLOQUEADO' }}</span></div>
                <div v-if="p.best" class="stat"><span>MEJOR SECTOR</span><span>{{ p.best.level }} · {{ p.best.score }} PTS</span></div>
                <div v-if="p.best" class="stat dim"><span>SEMILLA</span><span>{{ String(p.best.seed).padStart(5, '0') }}</span></div>
            </template>
        </div>
    </div>
</template>

<style scoped lang="scss">
.archive {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: var(--ph-bg);
}

.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    .title { @include inverse; padding: 0 6px; font-size: 0.85em; }
}

.tabs { display: flex; flex-wrap: wrap; gap: 4px; }

.key, .row {
    font: inherit;
    color: var(--ph);
    background: none;
    border: none;
    padding: 2px 6px;
    text-align: left;
    @include glow;
    &:active, &.on { @include inverse; }
}

.body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.entry { border-top: 1px solid var(--ph-dim); }
.row { display: flex; gap: 10px; width: 100%; padding: 4px 2px; &.off { color: var(--ph-dim); text-shadow: none; } }
.text { padding: 2px 4px 6px 30px; color: var(--ph); font-size: 0.9em; }
.hint { padding: 0 2px 4px 34px; font-size: 0.8em; }
.dim { color: var(--ph-dim); }
.sub { margin-top: 8px; }
.stat { display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid var(--ph-dim); padding: 4px 2px; }
</style>
