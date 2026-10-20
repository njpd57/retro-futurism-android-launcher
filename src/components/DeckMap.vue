<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import { DOOR_OPEN_STEP, DOOR_STEP_MS, deckRows, doorFrame, roomName } from '@/utils/deckMap';

interface Room { id: string; label: string; count: number; usageFraction: number; hasNew: boolean; kind: 'system' | 'folder' }

const props = defineProps<{ boxes: Room[]; dropState: (b: Room) => 'none' | 'ready' | 'over'; indexed?: boolean }>();
const emit = defineEmits<{ (e: 'open', id: string): void }>();

const rows = () => deckRows(props.boxes);

// tapping a compartment slides its door open, one frame at a time, and then goes in
const door = ref<{ id: string; step: number } | null>(null);
let timer: number | undefined;

function enter(id: string)
{
    if (door.value) return; // a door is already opening
    if (prefersReducedMotion()) { emit('open', id); return; }
    door.value = { id, step: 0 };
    timer = window.setInterval(() =>
    {
        if (!door.value) return;
        if (door.value.step < DOOR_OPEN_STEP) { door.value = { id, step: door.value.step + 1 }; return; }
        window.clearInterval(timer);
        door.value = null;
        emit('open', id);
    }, DOOR_STEP_MS);
}

onBeforeUnmount(() => window.clearInterval(timer));

const stepOf = (id: string) => door.value?.id === id ? door.value.step : 0;
const bar = (f: number) => '▓'.repeat(Math.round(f * 6)) + '░'.repeat(6 - Math.round(f * 6));
</script>

<template>
    <div class="deck" :class="{ indexed }">
        <div class="hint">PLANO DE LA NAVE · TOCA UNA SALA PARA ENTRAR</div>
        <div v-for="(row, i) in rows()" :key="i" class="row">
            <template v-for="(room, side) in [row.left, row.right]" :key="side">
                <div
                    v-if="room"
                    class="room pressable"
                    :class="[side === 0 ? 'left' : 'right', { system: room.kind === 'system' }, room.kind === 'folder' ? `drop-${dropState(room)}` : '']"
                    :data-drop-box="room.kind === 'folder' ? room.id : undefined"
                    @click="enter(room.id)">
                    <div class="text">
                        <div class="name">{{ roomName(room) }}<span v-if="room.hasNew">*</span></div>
                        <div class="meta">({{ room.count }}) {{ bar(room.usageFraction) }}</div>
                    </div>
                    <span class="door">{{ doorFrame(stepOf(room.id), side === 0 ? 'left' : 'right') }}</span>
                </div>
                <div v-else class="room empty" />
                <div v-if="side === 0" class="corridor"><div class="line" /></div>
            </template>
        </div>
    </div>
</template>

<style scoped lang="scss">
// a corridor down the middle with a compartment on each side; the corridor is a double line, doors face it
.deck {
    padding: 0 10px 6px;

    &.indexed { padding-right: 32px; }

    > .hint { padding-bottom: 4px; color: var(--ph-dim); font-size: 0.8em; white-space: nowrap; overflow: hidden; }
}

.row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr);
}

.corridor {
    display: flex;
    justify-content: center;

    > .line { width: 0; border-left: 3px double var(--ph-dim); }
}

.room {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin-bottom: 6px;
    padding: 2px 6px 3px;
    border: 1px solid var(--ph);
    @include box-glow(0.6);

    &.empty { visibility: hidden; }
    &.right { flex-direction: row-reverse; }
    &.system { border-color: var(--ph-dim); }
    &:active { @include inverse; }

    // while an app is carried: folders that accept it are dashed, the one under the finger is lit
    &.drop-ready { border-style: dashed; }
    &.drop-over { @include inverse; }

    > .text { flex: 1; min-width: 0; }
    .name { font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { color: var(--ph-dim); font-size: 0.8em; letter-spacing: 1px; white-space: nowrap; }
    &:active .meta, &.drop-over .meta { color: inherit; }
    > .door { flex: none; letter-spacing: 0; }
}
</style>
