<script setup lang="ts">
import { computed } from 'vue';
import type { GameState } from '@/games/isolation/game';
import { PLAN_KEY, planRows } from '@/games/isolation/plan';

const props = defineProps<{ state: GameState }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const rows = computed(() => planRows(props.state));
// the plan is as wide as the deck: shrink the letters so that the widest decks fit the screen
const size = computed(() => `${Math.min(1, 21 / Math.max(21, props.state.grid.w))}em`);
</script>

<template>
    <div class="plan">
        <div class="top">
            <span class="title">PLANO · {{ state.title }}</span>
            <button class="key pressable" @click="emit('close')">[CERRAR]</button>
        </div>
        <pre class="grid" :style="{ fontSize: size }">{{ rows.join('\n') }}</pre>
        <div class="legend">{{ PLAN_KEY.join(' · ') }}</div>
        <div class="legend">EL TIEMPO NO SE DETIENE.</div>
    </div>
</template>

<style scoped lang="scss">
.plan {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 4px;
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

.grid {
    flex: 1;
    min-height: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font: inherit;
    line-height: 1.02;
    white-space: pre;
    @include glow;
}

.legend { color: var(--ph-dim); font-size: 0.7em; text-align: center; }

.key {
    font: inherit;
    color: var(--ph);
    background: none;
    border: none;
    padding: 2px 6px;
    @include glow;
    &:active { @include inverse; }
}
</style>
