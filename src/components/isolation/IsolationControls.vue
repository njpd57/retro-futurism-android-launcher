<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { FUEL_MAX } from '@/games/isolation/crafting';
import type { Input } from '@/games/isolation/game';
import { bar } from '@/utils/tui';

defineProps<{
    /** label of the [USAR] key, null when there is nothing to use */
    use: string | null;
    tracker: boolean;
    hidden: boolean;
    decoys: number;
    flares: number;
    /** flamethrower shots left; null without the flamethrower */
    fuel: number | null;
}>();

const emit = defineEmits<{
    (e: 'input', input: Input): void;
    /** walking while a key is held down; null when released */
    (e: 'hold', input: Input | null): void;
}>();

const HOLD_MS = 300;

// A tap moves one cell through `click` (CrtScreen corrects it for the curvature). Holding the key past
// HOLD_MS keeps walking until it is released; the click that ends a hold is ignored.
let holdTimer: number | undefined;
let holding = false;
let swallowClick = false;

function press(input: Input)
{
    release();
    swallowClick = false;
    holdTimer = window.setTimeout(() =>
    {
        holding = true;
        emit('hold', input);
    }, HOLD_MS);
}

function release()
{
    window.clearTimeout(holdTimer);
    if (!holding) return;
    holding = false;
    swallowClick = true;
    emit('hold', null);
}

function tap(input: Input)
{
    if (swallowClick)
    {
        swallowClick = false;
        return;
    }
    emit('input', input);
}

onBeforeUnmount(release);
</script>

<template>
    <div class="controls" @contextmenu.prevent>
        <button class="key pressable" :class="{ off: hidden }" @click="tap('left')">◄</button>
        <button
            class="key pressable" :class="{ off: hidden }"
            @touchstart.passive="press('forward')" @touchend="release" @touchcancel="release" @click="tap('forward')">
            ▲ AVANZAR
        </button>
        <button class="key pressable" :class="{ off: hidden }" @click="tap('right')">►</button>

        <button class="key pressable" :class="{ off: !use }" @click="tap('use')">{{ use ?? 'USAR' }}</button>
        <button
            class="key pressable" :class="{ off: hidden }"
            @touchstart.passive="press('back')" @touchend="release" @touchcancel="release" @click="tap('back')">
            ▼ ATRÁS
        </button>
        <button class="key pressable" :class="{ on: tracker }" @click="tap('tracker')">RASTREADOR</button>

        <button class="key pressable" :class="{ off: hidden || !decoys }" @click="tap('throwDecoy')">SEÑUELO ×{{ decoys }}</button>
        <button class="key pressable" :class="{ off: hidden || !flares }" @click="tap('throwFlare')">BENGALA ×{{ flares }}</button>
        <button class="key pressable" :class="{ off: hidden || !fuel }" @click="tap('fire')">
            FUEGO {{ fuel === null ? '---' : bar(fuel / FUEL_MAX, FUEL_MAX) }}
        </button>
    </div>
</template>

<style scoped lang="scss">
.controls {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr;
    gap: 8px;
    // keep the keys off the curved edges of the tube
    padding: 0 10px;
    user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
}

.key {
    font: inherit;
    color: var(--ph);
    background: var(--ph-bg);
    border: 1px solid var(--ph);
    padding: 14px 4px;
    text-align: center;
    @include glow;
    @include box-glow(0.5);

    &:active, &.on { @include inverse; }
    &.off { color: var(--ph-dim); border-color: var(--ph-dim); box-shadow: none; }
}
</style>
