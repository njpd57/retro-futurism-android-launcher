<script setup lang="ts">
defineProps<{ title: string }>();
defineEmits<{ (e: 'close'): void }>();
</script>

<template>
    <div class="term-menu-backdrop" @click.self="$emit('close')">
        <div class="term-menu">
            <div class="title">{{ title }}</div>
            <div class="body">
                <slot />
            </div>
        </div>
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
    display: flex;
    flex-direction: column;
    background: var(--ph-bg);
    border: 2px solid var(--ph);
    @include box-glow;

    > .title { @include inverse; padding: 2px 10px; flex: none; }
    > .body { min-height: 0; overflow-y: auto; padding: 4px 0; overscroll-behavior: none; touch-action: pan-y; }
}
</style>
