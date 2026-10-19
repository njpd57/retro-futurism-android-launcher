<script setup lang="ts">
import TuiWindow from './TuiWindow.vue';

defineProps<{ title: string }>();
defineEmits<{ (e: 'close'): void }>();
</script>

<template>
    <div class="term-menu-backdrop" @click.self="$emit('close')">
        <TuiWindow class="term-menu" :title="title" :minimizable="false" closable @close="$emit('close')">
            <slot />
        </TuiWindow>
    </div>
</template>

<style scoped lang="scss">
.term-menu-backdrop {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    // keep clear of the system bars (set by App.vue)
    padding: calc(16px + var(--inset-top, 0px)) 16px calc(16px + var(--inset-bottom, 0px));
    background: rgba(0, 0, 0, 0.6);
}

.term-menu {
    width: 100%;
    max-height: 100%;

    // menus use all the height they're given instead of the widget cap
    :deep(.body) { max-height: none; }
}
</style>
