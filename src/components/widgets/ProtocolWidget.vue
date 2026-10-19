<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { dayKey } from '@/utils/day';
import { addItem, isDone, progress, removeItem, toggleItem, type ProtocolItem } from '@/utils/protocol';
import { bar } from '@/utils/tui';

const props = defineProps<{ id: string }>();

const items = useLocalStorage<ProtocolItem[]>(`widget.protocol.${props.id}`, []);
// the day rolls over at midnight: ticks from other days no longer count
const now = useNow({ interval: 60_000 });
const today = computed(() => dayKey(now.value));
const stats = computed(() => progress(items.value, today.value));

const draft = ref('');
function add()
{
    items.value = addItem(items.value, draft.value);
    draft.value = '';
}
</script>

<template>
    <div>
        <div v-if="items.length" class="dim">{{ bar(stats.fraction, 12) }} {{ stats.done }}/{{ stats.total }}</div>
        <div v-else class="dim">SIN TAREAS DEL DÍA</div>

        <div v-for="(item, i) in items" :key="i" class="item">
            <span class="check pressable" @click="items = toggleItem(items, i, today)">{{ isDone(item, today) ? '[X]' : '[ ]' }} {{ item.text.toUpperCase() }}</span>
            <span class="rm pressable" @click="items = removeItem(items, i)">[-]</span>
        </div>

        <div class="add">
            <span>+</span>
            <input v-model="draft" type="text" maxlength="28" autocomplete="off" spellcheck="false" placeholder="TAREA" @keydown.enter="add" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.item { display: flex; justify-content: space-between; gap: 8px; }
.check { flex: 1; min-width: 0; &:active { @include inverse; } }
.rm { color: var(--ph-dim); &:active { @include inverse; } }
.add {
    display: flex;
    gap: 6px;
    padding-top: 2px;

    > input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--ph-dim);
        outline: none;
        color: inherit;
        font: inherit;
        text-shadow: inherit;
        user-select: text;

        &::placeholder { color: var(--ph-dim); }
    }
}
</style>
