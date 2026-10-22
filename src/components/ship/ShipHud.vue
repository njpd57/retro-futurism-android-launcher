<script setup lang="ts">
import { ref } from 'vue';
import MenuItem from '@/components/MenuItem.vue';
import TermMenu from '@/components/TermMenu.vue';
import { STANDS } from '@/ship3d/glide';
import { zoneName, type AlertRoom } from '@/ship3d/hud';
import type { Zone } from '@/ship3d/world';

/** Where you are and what that room says; the room that wants you, a tap away; and a list of every room to go to. */
defineProps<{ line: string; alert: AlertRoom | null; turn: 'left' | 'right' | 'ahead'; here: Zone | undefined }>();
const emit = defineEmits<{ go: [room: string] }>();

const routes = ref(false);
const ROOMS = Object.keys(STANDS);

function go(room: string)
{
    routes.value = false;
    emit('go', room);
}
</script>

<template>
    <div class="hud" data-no-swipe @touchstart.stop @mousedown.stop>
        <button class="line pressable" @click="routes = true">{{ line }}</button>
        <button v-if="alert" class="alert pressable" :class="alert.level" @click="go(alert.zone)">
            <span v-if="turn === 'left'">◄ </span>▲ {{ alert.name }}<span v-if="turn === 'right'"> ►</span>
        </button>
    </div>
    <!-- outside the strip, so it covers the whole view -->
    <TermMenu v-if="routes" title="RUTA" @close="routes = false">
        <MenuItem v-for="r in ROOMS" :key="r" @click="r !== here && go(r)">
            <span>{{ zoneName(r as Zone) }}</span><span>{{ r === here ? 'AQUÍ' : '»' }}</span>
        </MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.hud {
    position: absolute;
    top: 6px;
    left: 52px;
    max-width: calc(100% - 52px - 128px);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

button {
    font: inherit;
    color: var(--ph);
    background: var(--ph-bg);
    border: 1px solid var(--ph-dim);
    padding: 2px 8px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    @include glow;

    &:active { @include inverse; }
}

.alert {
    border-color: var(--ph);

    &.urgent { @include inverse; animation: urgent 1s steps(1) infinite; }
}

@keyframes urgent { 50% { opacity: 0.35; } }

@media (prefers-reduced-motion: reduce) {
    .alert.urgent { animation: none; }
}
</style>
