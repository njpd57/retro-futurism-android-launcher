<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
    <section class="tui-panel">
        <h2 class="title">{{ title }}</h2>
        <div class="content">
            <slot />
        </div>
    </section>
</template>

<style scoped lang="scss">
.tui-panel {
    position: relative;
    margin-top: 0.6em;
    border: 1px solid var(--ph);
    @include box-glow(0.6);

    > .title {
        @include inverse;
        position: absolute;
        top: -0.6em;
        left: 8px;
        margin: 0;
        padding: 0 6px;
        font: inherit;
        line-height: 1.1;
        letter-spacing: 1px;
    }

    > .content { padding: 0.8em 8px 4px; }
}
</style>
