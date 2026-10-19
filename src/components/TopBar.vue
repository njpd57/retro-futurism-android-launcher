<script setup lang="ts">
import { useNow } from '@vueuse/core';
import type { Tab } from '@/stores/useSettingsStore';
import { formatClock, formatDateTui } from '@/utils/tui';

defineProps<{ tab: Tab }>();
defineEmits<{ (e: 'open-settings'): void; (e: 'select-tab', tab: Tab): void }>();

const now = useNow({ interval: 1000 });

const TABS: { id: Tab; label: string }[] = [
    { id: 'panel', label: 'PANEL' },
    { id: 'apps', label: 'APPS' },
    { id: 'mother', label: 'MOTHER' },
];
</script>

<template>
    <div class="top-bar">
        <span class="date" @click="$emit('open-settings')">{{ formatDateTui(now) }}</span>
        <span class="tabs">
            <span v-for="t in TABS" :key="t.id" class="tab" :class="{ active: tab === t.id }" @click="$emit('select-tab', t.id)">{{ tab === t.id ? `[${t.label}]` : ` ${t.label} ` }}</span>
        </span>
        <span class="time" @click="$emit('open-settings')">{{ formatClock(now) }}</span>
    </div>
</template>

<style scoped lang="scss">
.top-bar {
    @include inverse;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 2px 10px;
    flex: none;
    white-space: nowrap;

    > .tabs { display: flex; gap: 4px; }
    > .tabs > .tab { padding: 0 2px; white-space: pre; }
    > .tabs > .tab.active { font-weight: bold; }
}
</style>
