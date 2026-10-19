<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { isTaskLine, toggleTaskLine } from '@/utils/notes';
import MenuItem from '../MenuItem.vue';
import TermMenu from '../TermMenu.vue';

const props = defineProps<{ id: string }>();

// one text per widget instance
const text = useLocalStorage(`widget.notes.${props.id}`, '[ ] primera tarea\nnotas aquí');
const editing = ref(false);
const draft = ref('');

const lines = computed(() => text.value.split('\n'));

function edit()
{
    draft.value = text.value;
    editing.value = true;
}

function save()
{
    text.value = draft.value;
    editing.value = false;
}
</script>

<template>
    <div>
        <div v-for="(line, i) in lines" :key="i" class="line" :class="{ task: isTaskLine(line) }" @click="text = toggleTaskLine(text, i)">
            <span class="num">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="code">{{ line || ' ' }}</span>
        </div>
        <div class="edit" @click="edit">// EDITAR</div>

        <TermMenu v-if="editing" title="NOTAS" @close="editing = false">
            <textarea v-model="draft" spellcheck="false" autocapitalize="off" rows="8" />
            <MenuItem @click="save"><span>GUARDAR</span></MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.line { display: flex; gap: 8px; font-size: 0.85em; &.task:active { @include inverse; } }
.num { color: var(--ph-dim); flex: none; }
.code { white-space: pre-wrap; word-break: break-word; }
.edit { margin-top: 4px; color: var(--ph-dim); }

textarea {
    width: 100%;
    background: transparent;
    border: 1px solid var(--ph);
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    padding: 4px;
    outline: none;
    resize: none;
    user-select: text;
}
</style>
