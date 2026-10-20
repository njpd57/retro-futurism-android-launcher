<script setup lang="ts">
import { computed } from 'vue';
import { levelOf, modeOf, CAMPAIGN_LENGTH } from '@/games/isolation/campaign';
import { LOGS } from '@/games/isolation/logs';
import { ACHIEVEMENTS } from '@/games/isolation/progress';
import { useIsolationStore } from '@/stores/useIsolationStore';
import { bar } from '@/utils/tui';

defineProps<{ id: string }>();

const isolation = useIsolationStore();

const current = computed(() => isolation.suspended ?? isolation.save);
const where = computed(() =>
{
    const c = current.value;
    if (!c) return null;
    return modeOf(c.deck) === 'infinite' ? `SECTOR ${levelOf(c.deck)}` : `CUBIERTA ${levelOf(c.deck)}/${CAMPAIGN_LENGTH}`;
});
const p = computed(() => isolation.progress);
</script>

<template>
    <div class="isolation-widget pressable" @click="isolation.show()">
        <div class="dim">USCSS NOSTROMO · 1 ORGANISMO</div>
        <div v-if="where">{{ isolation.suspended ? 'SUSPENDIDA' : 'GUARDADA' }} · {{ where }}</div>
        <div v-else class="dim">SIN PARTIDA</div>
        <div v-if="p.best">MEJOR SECTOR {{ p.best.level }} · {{ p.best.score }} PTS</div>
        <div>REGISTROS {{ bar(p.logs.length / LOGS.length, 6) }} {{ p.logs.length }}/{{ LOGS.length }}</div>
        <div>LOGROS {{ bar(p.achievements.length / ACHIEVEMENTS.length, 6) }} {{ p.achievements.length }}/{{ ACHIEVEMENTS.length }}</div>
        <div class="enter">{{ current ? '[CONTINUAR]' : '[JUGAR]' }}</div>
    </div>
</template>

<style scoped lang="scss">
.isolation-widget {
    display: flex;
    flex-direction: column;
    gap: 2px;
    .dim { color: var(--ph-dim); }
    .enter { margin-top: 4px; }
}
</style>
