<script setup lang="ts">
import { computed } from 'vue';
import { ACHIEVEMENTS } from '@/games/marines/achievements';
import { MISSIONS } from '@/games/marines/campaign';
import { useMarinesStore } from '@/stores/useMarinesStore';
import { bar, formatDuration } from '@/utils/tui';

defineProps<{ id: string }>();

const marines = useMarinesStore();

// the best of every arena
const best = computed(() => Object.values(marines.records).reduce((a, r) => ({ wave: Math.max(a.wave, r.wave), score: Math.max(a.score, r.score) }), { wave: 0, score: 0 }));
const won = computed(() => MISSIONS.filter(m => marines.campaign[m.id]).length);
const earned = computed(() => Object.keys(marines.achievements).length);
</script>

<template>
    <div class="marines-widget pressable" @click="marines.show()">
        <div class="dim">LV-426 · ESPERANZA DE HADLEY</div>
        <div v-if="best.wave">RÉCORD OLEADA {{ best.wave }} · {{ best.score }} PTS</div>
        <div v-else class="dim">SIN PARTIDAS</div>
        <div>CAMPAÑA {{ bar(won / MISSIONS.length, 5) }} {{ won }}/{{ MISSIONS.length }}</div>
        <div>LOGROS {{ bar(earned / ACHIEVEMENTS.length, 5) }} {{ earned }}/{{ ACHIEVEMENTS.length }}</div>
        <div v-if="marines.stats.runs" class="dim">{{ marines.stats.kills }} BAJAS · {{ formatDuration(marines.stats.timeMs) }}</div>
        <div class="enter">[ENTRAR]</div>
    </div>
</template>

<style scoped lang="scss">
.marines-widget {
    display: flex;
    flex-direction: column;
    gap: 2px;
    .dim { color: var(--ph-dim); }
    .enter { margin-top: 4px; }
}
</style>
