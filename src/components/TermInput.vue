<script setup lang="ts">
import { ref } from 'vue';

/**
 * Text field of the terminal. Unlike `v-model`, it reports every `input` event (v-model skips them while an
 * Android keyboard is composing a word) and on Enter it hands over the value read from the element itself, so a
 * word still being composed is never lost. Enter shows "done" on the keyboard, so it doesn't jump to the next field.
 */
withDefaults(defineProps<{ modelValue: string; enterkeyhint?: 'done' | 'go' | 'search' | 'send'; type?: string }>(), { enterkeyhint: 'done', type: 'text' });
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'submit', value: string): void }>();

const el = ref<HTMLInputElement | null>(null);

function onInput(e: Event)
{
    emit('update:modelValue', (e.target as HTMLInputElement).value);
}

function onEnter(e: KeyboardEvent)
{
    const value = (e.target as HTMLInputElement).value;
    emit('update:modelValue', value);
    emit('submit', value);
}

defineExpose({ focus: () => el.value?.focus() });
</script>

<template>
    <input
        ref="el"
        class="term-input"
        :type="type"
        :value="modelValue"
        :enterkeyhint="enterkeyhint"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        @input="onInput"
        @keydown.enter.prevent="onEnter" />
</template>

<style scoped lang="scss">
.term-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ph-dim);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
    min-width: 0;

    &::placeholder { color: var(--ph-dim); }
}
</style>
