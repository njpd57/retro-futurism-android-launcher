<script setup lang="ts">
import { BAG_MAX, FUEL_MAX, MATERIAL_LABEL, RECIPES, canCraft, needsText, type Bag, type Material } from '@/games/isolation/crafting';
import type { CraftInput } from '@/games/isolation/game';
import { bar } from '@/utils/tui';

defineProps<{ bag: Bag }>();

const emit = defineEmits<{
    (e: 'craft', input: CraftInput): void;
    (e: 'close'): void;
}>();

const MATERIALS = Object.keys(MATERIAL_LABEL) as Material[];
const INPUT = { decoy: 'craftDecoy', flare: 'craftFlare', fuel: 'craftFuel' } as const;
</script>

<template>
    <div class="bag">
        <div class="top">
            <span class="title">OBJETOS · EL TIEMPO NO SE DETIENE</span>
            <button class="key pressable" @click="emit('close')">[CERRAR]</button>
        </div>
        <div v-for="m in MATERIALS" :key="m" class="row">
            <span>{{ MATERIAL_LABEL[m].padEnd(8, ' ') }}</span>
            <span>{{ bar(bag[m] / BAG_MAX, BAG_MAX) }} {{ bag[m] }}/{{ BAG_MAX }}</span>
        </div>
        <div class="row dim">
            <span>SEÑUELOS ×{{ bag.decoys }}</span>
            <span>BENGALAS ×{{ bag.flares }}</span>
            <span>{{ bag.flamer ? `FUEGO ${bar(bag.fuel / FUEL_MAX, FUEL_MAX)}` : 'FUEGO ---' }}</span>
        </div>
        <button
            v-for="r in RECIPES" :key="r.id" class="recipe pressable" :class="{ off: !canCraft(bag, r) }"
            @click="emit('craft', INPUT[r.id])">
            <span>[{{ r.label }}]</span>
            <span class="needs">{{ needsText(r) }}</span>
        </button>
    </div>
</template>

<style scoped lang="scss">
.bag {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    background: var(--ph-bg);
    border-top: 1px solid var(--ph);
}

.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    .title { @include inverse; padding: 0 6px; font-size: 0.85em; }
}

.row { display: flex; justify-content: space-between; white-space: pre; }
.dim { color: var(--ph-dim); }

.key, .recipe {
    font: inherit;
    color: var(--ph);
    background: none;
    border: none;
    @include glow;
    &:active { @include inverse; }
}
.key { padding: 2px 6px; }

.recipe {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 4px;
    border-top: 1px solid var(--ph-dim);
    text-align: left;
    .needs { color: var(--ph-dim); }
    &:active .needs { color: inherit; }
    &.off { color: var(--ph-dim); text-shadow: none; }
}
</style>
