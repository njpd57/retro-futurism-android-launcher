<script setup lang="ts">
const query = defineModel<string>({ required: true });
defineEmits<{ (e: 'submit'): void }>();
</script>

<template>
    <div class="prompt-bar">
        <span class="caret">&gt;</span>
        <input
            v-model="query"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="go"
            placeholder="buscar"
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
