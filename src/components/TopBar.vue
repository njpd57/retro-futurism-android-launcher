<script setup lang="ts">
import { useNow } from '@vueuse/core';
import type { Tab } from '@/stores/useSettingsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { formatClock, formatDateTui } from '@/utils/tui';

defineProps<{ tab: Tab }>();
defineEmits<{ (e: 'open-settings'): void; (e: 'select-tab', tab: Tab): void; (e: 'open-notifications'): void }>();

const notifications = useNotificationsStore();

const now = useNow({ interval: 1000 });

const TABS: { id: Tab; label: string }[] = [
    { id: 'panel', label: 'PANEL' },
    { id: 'apps', label: 'APPS' },
    { id: 'mother', label: 'MOTHER' },
];
</script>

<template>
    <div class="top-bar">
        <span class="date">{{ formatDateTui(now) }}</span>
        <span class="tabs">
            <span v-for="t in TABS" :key="t.id" class="tab" :class="{ active: tab === t.id }" @click="$emit('select-tab', t.id)">{{ tab === t.id ? `[${t.label}]` : ` ${t.label} ` }}</span>
        </span>
        <span v-if="notifications.alerts" class="alerts" @click="$emit('open-notifications')">!{{ notifications.alerts }}</span>
        <span class="time">{{ formatClock(now) }}</span>
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

    > .alerts { font-weight: bold; animation: alert-blink 1s steps(1) infinite; }
    > .tabs { display: flex; gap: 4px; }
    > .tabs > .tab { padding: 0 2px; white-space: pre; }
    > .tabs > .tab.active { font-weight: bold; }
}

@keyframes alert-blink { 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .top-bar > .alerts { animation: none; } }
</style>
