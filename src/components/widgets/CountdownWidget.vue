<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { formatCountdown, parseDateInput, type Countdown } from '@/utils/countdown';

const props = defineProps<{ id: string }>();

const state = useLocalStorage<Countdown>(`widget.countdown.${props.id}`, { label: '', target: null });
const now = useNow({ interval: 10_000 });
const text = computed(() => state.value.target === null ? '' : formatCountdown(state.value.target, now.value.getTime()));

const editing = ref(state.value.target === null);
const labelDraft = ref(state.value.label);
const dateDraft = ref('');

function save()
{
    const target = parseDateInput(dateDraft.value);
    if (target === null) return;
    state.value = { label: labelDraft.value.trim().slice(0, 20).toUpperCase(), target };
    editing.value = false;
}
</script>

<template>
    <div>
        <template v-if="editing">
            <div class="dim">OBJETIVO Y FECHA</div>
            <input v-model="labelDraft" type="text" maxlength="20" autocomplete="off" spellcheck="false" placeholder="NOMBRE" />
            <input v-model="dateDraft" type="date" />
            <div class="action pressable" @click="save">[FIJAR]</div>
        </template>
        <template v-else>
            <div v-if="state.label" class="dim">{{ state.label }}</div>
            <div class="count">{{ text }}</div>
            <div class="action pressable" @click="editing = true">[CAMBIAR]</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.count { font-size: 1.15em; letter-spacing: 1px; }
.action { padding: 2px 0; &:active { @include inverse; } }

input {
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ph-dim);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
    margin-bottom: 4px;
    color-scheme: dark;

    &::placeholder { color: var(--ph-dim); }
}
</style>
