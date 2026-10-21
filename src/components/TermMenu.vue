<script setup lang="ts">
import TuiWindow from './TuiWindow.vue';
import { useAnimStore } from '@/stores/useAnimStore';

const anim = useAnimStore();

defineProps<{ title: string; large?: boolean }>();
defineEmits<{ (e: 'close'): void }>();
</script>

<template>
    <div class="term-menu-backdrop" :class="{ large, opening: anim.transitions }" @click.self="$emit('close')">
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

    // wider margins for menus with lots of content; the window still fits its content
    &.large { padding: calc(6px + var(--inset-top, 0px)) 6px calc(6px + var(--inset-bottom, 0px)); }
}

.term-menu {
    width: 100%;
    max-height: 100%;

    // menus use all the height they're given instead of the widget cap
    :deep(.body) { max-height: none; }
}

// opening: the dimmer fades in and the window draws open from a line, like the tube switching on
.opening {
    animation: menu-dim 0.16s linear both;
    > .term-menu { animation: menu-open 0.16s linear both; transform-origin: center; }
}

@keyframes menu-dim {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes menu-open {
    from { transform: scale(1, 0.03); opacity: 0.5; }
    to { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .opening, .opening > .term-menu { animation: none; }
}
</style>
