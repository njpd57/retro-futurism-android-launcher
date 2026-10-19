<script setup lang="ts">
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import AppShortlistWidget from './widgets/AppShortlistWidget.vue';
import ClockWidget from './widgets/ClockWidget.vue';
import LinkWidget from './widgets/LinkWidget.vue';
import LogWidget from './widgets/LogWidget.vue';
import PowerWidget from './widgets/PowerWidget.vue';
import ScopeWidget from './widgets/ScopeWidget.vue';

defineEmits<{ (e: 'menu', app: InstalledAppInfo): void }>();
</script>

<template>
    <div class="dashboard">
        <ClockWidget />
        <div class="stack">
            <PowerWidget />
            <LinkWidget />
        </div>
        <ScopeWidget class="span-2" />
        <AppShortlistWidget mode="favorites" @menu="$emit('menu', $event)" />
        <AppShortlistWidget mode="recent" @menu="$emit('menu', $event)" />
        <LogWidget class="span-2" />
    </div>
</template>

<style scoped lang="scss">
.dashboard {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: none;
    scrollbar-width: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 6px 10px;
    padding: 6px 10px 10px;

    &::-webkit-scrollbar { display: none; }

    > .span-2 { grid-column: 1 / -1; }
    > .stack { display: flex; flex-direction: column; gap: 6px; }
}
</style>
