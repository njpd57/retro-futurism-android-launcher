<script setup lang="ts">
export interface SoftKey
{
    label: string;
    action: () => void;
}

defineProps<{ keys: SoftKey[] }>();
</script>

<template>
    <div class="soft-keys">
        <button v-for="k in keys" :key="k.label" type="button" @click="k.action()">{{ k.label }}</button>
    </div>
</template>

<style scoped lang="scss">
.soft-keys {
    display: flex;
    gap: 8px;
    padding: 4px 10px 6px;
    flex: none;

    > button {
        flex: 1;
        min-width: 0;
        padding: 3px 4px;
        border: 1px solid var(--ph);
        background: var(--ph-bg);
        color: inherit;
        font: inherit;
        text-shadow: inherit;
        letter-spacing: 1px;
        @include box-glow(0.6);

        &:active { @include inverse; }
    }
}
</style>
