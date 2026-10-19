<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { addWidget, moveWidget, removeWidget, toggleMinimized } from '@/utils/dashboardLayout';
import { WIDGETS } from '@/widgets/registry';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';
import TuiWindow from './TuiWindow.vue';

defineProps<{ editing: boolean }>();
defineEmits<{ (e: 'menu', app: InstalledAppInfo): void }>();

const settings = useSettingsStore();
const adding = ref(false);

// A layout can reference a kind that no longer exists in the registry.
const items = computed(() => settings.dashboard.filter(i => i.kind in WIDGETS));

function add(kind: string)
{
    settings.dashboard = addWidget(settings.dashboard, kind);
    adding.value = false;
}
</script>

<template>
    <div class="dashboard">
        <TuiWindow
            v-for="item in items"
            :key="item.id"
            :title="WIDGETS[item.kind].title"
            :class="{ 'span-2': WIDGETS[item.kind].span === 2 }"
            :minimized="item.minimized"
            :closable="editing"
            :movable="editing"
            @toggle="settings.dashboard = toggleMinimized(settings.dashboard, item.id)"
            @close="settings.dashboard = removeWidget(settings.dashboard, item.id)"
            @move="settings.dashboard = moveWidget(settings.dashboard, item.id, $event)">
            <component :is="WIDGETS[item.kind].component" v-bind="WIDGETS[item.kind].props" :id="item.id" @menu="$emit('menu', $event)" />
        </TuiWindow>

        <div v-if="editing" class="add span-2" @click="adding = true">[+ AÑADIR VENTANA]</div>

        <TermMenu v-if="adding" title="AÑADIR VENTANA" @close="adding = false">
            <MenuItem v-for="(def, kind) in WIDGETS" :key="kind" @click="add(kind)"><span>{{ def.title }}</span><span>+</span></MenuItem>
        </TermMenu>
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
    grid-auto-flow: dense;
    align-content: start;
    gap: 10px;
    padding: 8px 10px 10px;

    &::-webkit-scrollbar { display: none; }

    .span-2 { grid-column: 1 / -1; }

    > .add { padding: 6px; text-align: center; border: 1px dashed var(--ph); }
}
</style>
