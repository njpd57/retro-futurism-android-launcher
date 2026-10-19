<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { INTRO, newGame, reduce, type NostromoState } from '@/games/nostromo';

const props = defineProps<{ id: string }>();

const MAX_LINES = 60;

interface Save { state: NostromoState; lines: string[] }

function fresh(): Save
{
    const state = newGame();
    return { state, lines: [...INTRO, '', ...reduce(state, 'mirar').output] };
}

// one game per widget instance
const save = useLocalStorage<Save>(`widget.nostromo.${props.id}`, fresh());
const input = ref('');
const log = ref<HTMLElement | null>(null);

function submit()
{
    const text = input.value.trim();
    input.value = '';
    if (!text) return;

    const r = reduce(save.value.state, text);
    const lines = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === 'reiniciar' ? r.output : [...save.value.lines, `> ${text}`, ...r.output];
    save.value = { state: r.state, lines: lines.slice(-MAX_LINES) };
}

function scrollDown() { nextTick(() => { if (log.value) log.value.scrollTop = log.value.scrollHeight; }); }
watch(() => save.value.lines.length, scrollDown, { immediate: true, flush: 'post' });
</script>

<template>
    <div>
        <div ref="log" class="log">
            <div v-for="(line, i) in save.lines" :key="i" class="line" :class="{ cmd: line.startsWith('>') }">{{ line || ' ' }}</div>
        </div>
        <div class="prompt">
            <span>&gt;</span>
            <input
                v-model="input"
                type="text"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                enterkeyhint="send"
                placeholder="comando"
                @keydown.enter.prevent="submit" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.log { height: 9 * 1.15em; overflow-y: auto; scrollbar-width: none; font-size: 0.85em; &::-webkit-scrollbar { display: none; } }
.line { text-transform: uppercase; }
.cmd { color: var(--ph-dim); }
.prompt {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--ph-dim);
    padding-top: 2px;

    > input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        outline: none;
        color: inherit;
        font: inherit;
        text-shadow: inherit;
        caret-color: var(--ph);
        user-select: text;

        &::placeholder { color: var(--ph-dim); }
    }
}
</style>
