<script setup lang="ts">
import { ref } from 'vue';

const query = defineModel<string>({ required: true });
defineEmits<{ (e: 'submit'): void }>();

const input = ref<HTMLInputElement | null>(null);

// v-model ignores `input` events while an IME is composing, and Android keyboards keep the current word in
// composition, so the list would only update on a space. Reading the value on every event avoids that.
function onInput(e: Event)
{
    query.value = (e.target as HTMLInputElement).value;
}
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
    <div class="prompt-bar">
        <span class="caret">&gt;</span>
        <input
            ref="input"
            :value="query"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="go"
            placeholder="buscar o > orden"
            @input="onInput"
            @keydown.enter.prevent="$emit('submit')" />
    </div>
</template>

<style scoped lang="scss">
.prompt-bar {
    display: flex;
    gap: 8px;
    padding: 4px 10px;
    border-top: 1px solid var(--ph);
    flex: none;

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
        caret-shape: block;
        user-select: text;

        &::placeholder { color: var(--ph-dim); }
    }
}
</style>
