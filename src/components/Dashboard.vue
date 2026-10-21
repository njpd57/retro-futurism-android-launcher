<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { MAX_PANELS, SIZE_CELLS, activePanel, addPanel, addWidgetToActive, cycleSize, moveWidget, removeActivePanel, removeWidget, selectPanel, sizeOf, toggleMinimized } from '@/utils/dashboardLayout';
import { WIDGETS } from '@/widgets/registry';
import TuiWindow from './TuiWindow.vue';
import WidgetBoundary from './WidgetBoundary.vue';
import WidgetCatalog from './WidgetCatalog.vue';

defineProps<{ editing: boolean }>();
defineEmits<{ (e: 'menu', app: InstalledAppInfo): void }>();

// windows that appear once the dashboard has settled (a widget added, another panel selected) unfold; the first
// render stays still because the tab wipe already covers it
const settled = ref(false);
let settleTimer = 0;
onMounted(() => { settleTimer = window.setTimeout(() => { settled.value = true; }, 400); });
onBeforeUnmount(() => window.clearTimeout(settleTimer));

const settings = useSettingsStore();
const adding = ref(false);
const root = ref<HTMLElement | null>(null);
/** Id of the window just added; it blinks for a moment so you can see where it landed. */
const flashing = ref<string | null>(null);
let flashTimer: number | undefined;

// A layout can reference a kind that no longer exists in the registry.
const items = computed(() => settings.dashboard.filter(i => i.kind in WIDGETS));

/** Grid placement of a window: the columns and rows its size takes. A minimized one keeps its columns and only shows its bar. */
function placement(item: { size?: import('@/utils/dashboardLayout').WidgetSize; minimized: boolean; kind: string })
{
    const cells = SIZE_CELLS[sizeOf(item, WIDGETS[item.kind].sizes)];
    return { gridColumn: `span ${cells.cols}`, gridRow: item.minimized ? 'span 1' : `span ${cells.rows}` };
}

function resize(id: string, kind: string)
{
    settings.dashboard = cycleSize(settings.dashboard, id, WIDGETS[kind].sizes);
    reveal(id);
}

function add(kind: string)
{
    settings.layouts = addWidgetToActive(settings.layouts, kind);
    adding.value = false;
    const panel = activePanel(settings.layouts);
    reveal(panel[panel.length - 1]?.id);
}

// The new window is appended at the end of the panel, possibly far below the fold.
async function reveal(id: string | undefined)
{
    if (!id) return;
    await nextTick();
    root.value?.querySelector(`[data-widget-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
    flashing.value = id;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => { flashing.value = null; }, 1200);
}
</script>

<template>
    <div ref="root" class="dashboard">
        <div v-if="settings.layouts.panels.length > 1 || editing" class="panel-tabs">
            <span
                v-for="(_, i) in settings.layouts.panels"
                :key="i"
                class="panel-tab pressable"
                :class="{ active: i === settings.layouts.active }"
                @click="settings.layouts = selectPanel(settings.layouts, i)">{{ i === settings.layouts.active ? `[P${i + 1}]` : ` P${i + 1} ` }}</span>
            <template v-if="editing">
                <span v-if="settings.layouts.panels.length < MAX_PANELS" class="panel-tab pressable" @click="settings.layouts = addPanel(settings.layouts)">[+P]</span>
                <span v-if="settings.layouts.panels.length > 1" class="panel-tab pressable" @click="settings.layouts = removeActivePanel(settings.layouts)">[-P]</span>
            </template>
        </div>

        <div class="grid">
            <TuiWindow
                v-for="item in items"
                :key="item.id"
                :title="WIDGETS[item.kind].title"
                :data-widget-id="item.id"
                fill
                :pop="settled"
                :style="placement(item)"
                :class="{ flash: flashing === item.id }"
                :minimized="item.minimized"
                :closable="editing"
                :movable="editing"
                :resizable="editing && WIDGETS[item.kind].sizes.length > 1"
                @resize="resize(item.id, item.kind)"
                @toggle="settings.dashboard = toggleMinimized(settings.dashboard, item.id)"
                @close="settings.dashboard = removeWidget(settings.dashboard, item.id)"
                @move="settings.dashboard = moveWidget(settings.dashboard, item.id, $event)">
                <WidgetBoundary :name="WIDGETS[item.kind].title">
                    <component :is="WIDGETS[item.kind].component" v-bind="WIDGETS[item.kind].props" :id="item.id" @menu="$emit('menu', $event)" />
                </WidgetBoundary>
            </TuiWindow>
        </div>

        <div v-if="editing" class="add" @click="adding = true">[+ AÑADIR VENTANA]</div>

        <WidgetCatalog v-if="adding" :present="settings.dashboard.map(i => i.kind)" @add="add" @close="adding = false" />
    </div>
</template>

<style scoped lang="scss">
.dashboard {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: none;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 10px 10px;

    &::-webkit-scrollbar { display: none; }

    > * { flex: none; }

    > .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-flow: dense;
        // one cell is about square on a phone: two columns of this height
        grid-auto-rows: 7.5em;
        gap: 10px;
    }

    > .panel-tabs { display: flex; gap: 6px; white-space: pre; }
    .panel-tab.active { font-weight: bold; }
    .panel-tab:active { @include inverse; }

    .flash { animation: flash 0.3s steps(1) 4; }

    > .add { padding: 6px; text-align: center; border: 1px dashed var(--ph); }
}

@keyframes flash {
    50% { background: var(--ph); }
}

@media (prefers-reduced-motion: reduce) {
    .dashboard .flash { animation: none; }
}
</style>
