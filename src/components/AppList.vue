<script setup lang="ts">
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import AppRow from './AppRow.vue';

defineProps<{ apps: InstalledAppInfo[]; highlightFirst: boolean }>();
defineEmits<{ (e: 'launch', app: InstalledAppInfo): void; (e: 'menu', app: InstalledAppInfo): void }>();
</script>

<template>
    <div class="app-list">
        <AppRow
            v-for="(app, i) in apps"
            :key="app.packageName"
            :app="app"
            :highlighted="highlightFirst && i === 0"
            @launch="$emit('launch', app)"
            @menu="$emit('menu', app)" />
        <div v-if="!apps.length" class="empty">SIN RESULTADOS</div>
    </div>
</template>

<style scoped lang="scss">
.app-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: none;
    padding: 4px 0;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }

    > .empty { padding: 3px 10px; opacity: 0.6; }
}
</style>
