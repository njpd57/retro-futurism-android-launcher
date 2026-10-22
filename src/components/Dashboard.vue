<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { MAX_PANELS, SIZE_CELLS, activePanel, addPanel, addWidgetToActive, cycleSize, dropAfter, defaultLayoutSet, duplicateWidget, LAYOUT_TEMPLATES, templateSet, moveWidget, moveWidgetTo, moveWidgetToPanel, pushHistory, removeActivePanel, removeWidget, renameDeck, selectPanel, sizeOf, toggleMinimized, type LayoutSet } from '@/utils/dashboardLayout';
import { bendK, correctPoint } from '@/utils/curvature';
import { elementAtPoint } from '@/utils/pointUnder';
import { autoScrollSpeed } from '@/utils/dragDrop';
import { tick } from '@/utils/haptics';
import { grownSize, pickGrown } from '@/utils/attention';
import { useAttentionStore } from '@/stores/useAttentionStore';
import { WIDGETS } from '@/widgets/registry';
import DeckPlan from './DeckPlan.vue';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';
import TermInput from './TermInput.vue';
import TuiWindow from './TuiWindow.vue';
import WidgetBoundary from './WidgetBoundary.vue';
import WidgetCatalog from './WidgetCatalog.vue';

const props = defineProps<{ editing: boolean }>();
defineEmits<{ (e: 'menu', app: InstalledAppInfo): void }>();

// windows that appear once the dashboard has settled (a widget added, another panel selected) unfold; the first
// render stays still because the tab wipe already covers it
const settled = ref(false);
let settleTimer = 0;
onMounted(() => { settleTimer = window.setTimeout(() => { settled.value = true; }, 400); });
onBeforeUnmount(() => window.clearTimeout(settleTimer));

const settings = useSettingsStore();
const attention = useAttentionStore();
const adding = ref(false);
const root = ref<HTMLElement | null>(null);
/** Id of the window just added; it blinks for a moment so you can see where it landed. */
const flashing = ref<string | null>(null);
let flashTimer: number | undefined;

// A layout can reference a kind that no longer exists in the registry.
const items = computed(() => settings.dashboard.filter(i => i.kind in WIDGETS));

// ---- living windows: one whose subject needs a look grows a size. The set only changes while no finger is down,
// so nothing is rearranged under a touch, and never while editing.
const touching = ref(false);
const grown = ref<Set<string>>(new Set());
const wanted = computed(() => settings.liveWidgets && !props.editing
    ? pickGrown(items.value.filter(i => !i.minimized).map(i => ({ id: i.id, kind: i.kind, size: sizeOf(i, WIDGETS[i.kind].sizes), sizes: WIDGETS[i.kind].sizes })), attention.live)
    : new Set<string>());
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x));
function applyGrown() { if (!touching.value && !sameSet(grown.value, wanted.value)) grown.value = wanted.value; }
watch([wanted, touching], applyGrown, { immediate: true });
const attentionOf = (kind: string) => attention.live[kind] ?? 'idle';

/** Grid placement of a window: the columns and rows its size takes. A minimized one keeps its columns and only shows its bar. */
function placement(item: { id: string; size?: import('@/utils/dashboardLayout').WidgetSize; minimized: boolean; kind: string })
{
    const base = sizeOf(item, WIDGETS[item.kind].sizes);
    const cells = SIZE_CELLS[grown.value.has(item.id) && !item.minimized ? grownSize(base, WIDGETS[item.kind].sizes) : base];
    return { gridColumn: `span ${cells.cols}`, gridRow: item.minimized ? 'span 1' : `span ${cells.rows}` };
}

// ---- undo: every edit pushes the previous layout set; leaving the edit mode forgets them ----
const history = ref<LayoutSet[]>([]);
watch(() => props.editing, on => { if (!on) { history.value = []; stopDrag(); } });

function commit(next: LayoutSet)
{
    history.value = pushHistory(history.value, JSON.parse(JSON.stringify(settings.layouts)) as LayoutSet);
    settings.layouts = next;
}

// the ship's plan: every deck as a compartment, to jump between them without swiping
const planOpen = ref(false);
function pick(index: number)
{
    settings.layouts = selectPanel(settings.layouts, index);
    planOpen.value = false;
}
watch(() => props.editing, () => { planOpen.value = false; });

// whole sets of decks to start from; applying one is one undoable edit
const templates = ref(false);
function applyTemplate(id: string)
{
    const t = LAYOUT_TEMPLATES.find(x => x.id === id);
    if (t) commit(templateSet(t));
    templates.value = false;
}

const deckName = ref('');
watch(() => [props.editing, settings.layouts.active], () => { deckName.value = settings.layouts.names[settings.layouts.active] ?? ''; }, { immediate: true });
function rename(value: string)
{
    const next = renameDeck(settings.layouts, settings.layouts.active, value);
    if (next !== settings.layouts) commit(next);
    deckName.value = settings.layouts.names[settings.layouts.active];
}

const setWith = (items: ReturnType<typeof activePanel>): LayoutSet => ({ ...settings.layouts, panels: settings.layouts.panels.map((p, i) => i === settings.layouts.active ? items : p) });

function undo()
{
    const prev = history.value[history.value.length - 1];
    if (!prev) return;
    history.value = history.value.slice(0, -1);
    settings.layouts = prev;
}

// ---- drag: hold the title bar, drop on a window (insert there) or on a panel tab (move to that panel) ----
const dragId = ref<string | null>(null);
const hover = ref<{ kind: 'window'; id: string; after: boolean } | { kind: 'panel'; index: number } | null>(null);
let lastPoint: { x: number; y: number } | null = null;
let scrollTimer: number | undefined;
const tubeRect = () => settings.curvature ? document.querySelector('.crt-screen .tube')?.getBoundingClientRect() ?? null : null;

function startDrag(id: string)
{
    dragId.value = id;
    hover.value = null;
    lastPoint = null;
    if (settings.haptics) tick();
    window.clearInterval(scrollTimer);
    scrollTimer = window.setInterval(autoScroll, 16);
}

function stopDrag()
{
    window.clearInterval(scrollTimer);
    scrollTimer = undefined;
    dragId.value = null;
    hover.value = null;
    lastPoint = null;
}

function targetAt(x: number, y: number): typeof hover.value
{
    const k = bendK(settings.curvatureBend);
    const rect = tubeRect();
    const el = elementAtPoint(x, y, rect, k);
    const tab = el?.closest<HTMLElement>('[data-drop-panel]');
    if (tab) return { kind: 'panel', index: Number(tab.dataset.dropPanel) };
    const win = el?.closest<HTMLElement>('[data-widget-id]');
    const id = win?.dataset.widgetId;
    if (!win || !id || id === dragId.value) return null;
    const p = rect ? correctPoint(x, y, rect, k) : { x, y };
    const b = win.getBoundingClientRect();
    return { kind: 'window', id, after: dropAfter((p.x - b.left) / b.width, (p.y - b.top) / b.height) };
}

function moveDrag(x: number, y: number)
{
    lastPoint = { x, y };
    const t = targetAt(x, y);
    const same = JSON.stringify(t) === JSON.stringify(hover.value);
    if (!same && t && settings.haptics) tick(6);
    hover.value = t;
}

function dropDrag(x: number, y: number)
{
    const id = dragId.value;
    const t = targetAt(x, y);
    stopDrag();
    if (!id || !t) return;
    if (t.kind === 'panel') commit(moveWidgetToPanel(settings.layouts, id, t.index));
    else commit(setWith(moveWidgetTo(settings.dashboard, id, t.id, t.after)));
    reveal(id);
}

function autoScroll()
{
    const el = root.value;
    if (!el || !lastPoint) return;
    const box = el.getBoundingClientRect();
    const speed = autoScrollSpeed(lastPoint.y, box.top, box.bottom);
    if (speed) { el.scrollTop += speed; moveDrag(lastPoint.x, lastPoint.y); }
}

onBeforeUnmount(stopDrag);

function resize(id: string, kind: string)
{
    commit(setWith(cycleSize(settings.dashboard, id, WIDGETS[kind].sizes)));
    reveal(id);
}

function add(kind: string)
{
    commit(addWidgetToActive(settings.layouts, kind));
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
    <div ref="root" class="dashboard" @touchstart.passive="touching = true" @touchend.passive="touching = false" @touchcancel.passive="touching = false">
        <div v-if="settings.layouts.panels.length > 1 || editing" class="panel-tabs">
            <span
                v-for="(_, i) in settings.layouts.panels"
                :key="i"
                class="panel-tab pressable"
                :data-drop-panel="i"
                :class="{ active: i === settings.layouts.active, target: hover?.kind === 'panel' && hover.index === i }"
                @click="i === settings.layouts.active && settings.layouts.panels.length > 1 ? (planOpen = !planOpen) : pick(i)">{{ i === settings.layouts.active ? `[${settings.layouts.names[i]}]` : ` ${settings.layouts.names[i]} ` }}</span>
            <span v-if="settings.layouts.panels.length > 1" class="panel-tab pressable" :class="{ active: planOpen }" @click="planOpen = !planOpen">{{ planOpen ? '[▦]' : ' ▦ ' }}</span>
            <template v-if="editing">
                <span v-if="settings.layouts.panels.length < MAX_PANELS" class="panel-tab pressable" @click="commit(addPanel(settings.layouts))">[+P]</span>
                <span v-if="settings.layouts.panels.length > 1" class="panel-tab pressable" @click="commit(removeActivePanel(settings.layouts))">[-P]</span>
                <span v-if="history.length" class="panel-tab pressable undo" @click="undo">[DESHACER]</span>
            </template>
        </div>

        <DeckPlan v-if="planOpen" @pick="pick" />

        <div v-if="editing && !planOpen" class="rename">
            <span>NOMBRE</span>
            <TermInput v-model="deckName" maxlength="10" @submit="rename" @blur="rename(deckName)" />
        </div>

        <div v-show="!planOpen" class="grid">
            <TuiWindow
                v-for="item in items"
                :key="item.id"
                :title="WIDGETS[item.kind].title"
                :data-widget-id="item.id"
                fill
                :pop="settled"
                :style="placement(item)"
                :class="{
                    flash: flashing === item.id,
                    lifted: dragId === item.id,
                    alive: grown.has(item.id),
                    urgent: grown.has(item.id) && attentionOf(item.kind) === 'urgent',
                    'drop-before': hover?.kind === 'window' && hover.id === item.id && !hover.after,
                    'drop-after': hover?.kind === 'window' && hover.id === item.id && hover.after,
                }"
                :minimized="item.minimized"
                :closable="editing"
                :movable="editing"
                :resizable="editing && WIDGETS[item.kind].sizes.length > 1"
                @resize="resize(item.id, item.kind)"
                @toggle="settings.dashboard = toggleMinimized(settings.dashboard, item.id)"
                @close="commit(setWith(removeWidget(settings.dashboard, item.id)))"
                @move="commit(setWith(moveWidget(settings.dashboard, item.id, $event)))"
                @duplicate="commit(duplicateWidget(settings.layouts, item.id)); reveal(settings.dashboard[settings.dashboard.findIndex(i => i.id === item.id) + 1]?.id)"
                @drag-start="startDrag(item.id)"
                @drag-move="moveDrag"
                @drag-drop="dropDrag"
                @drag-cancel="stopDrag">
                <WidgetBoundary :name="WIDGETS[item.kind].title">
                    <component :is="WIDGETS[item.kind].component" v-bind="WIDGETS[item.kind].props" :id="item.id" @menu="$emit('menu', $event)" />
                </WidgetBoundary>
            </TuiWindow>
        </div>

        <div v-if="editing && !planOpen" class="add" @click="adding = true">[+ AÑADIR VENTANA]</div>
        <div v-if="editing && !planOpen" class="add" @click="templates = true">[PLANTILLAS]</div>

        <TermMenu v-if="templates" title="PLANTILLAS" @close="templates = false">
            <MenuItem v-for="t in LAYOUT_TEMPLATES" :key="t.id" @click="applyTemplate(t.id)"><span>{{ t.label }}</span><span class="dim">{{ t.decks.length }} {{ t.decks.length === 1 ? 'CUBIERTA' : 'CUBIERTAS' }}</span></MenuItem>
            <MenuItem @click="commit(defaultLayoutSet()); templates = false"><span>FÁBRICA</span><span class="dim">4 CUBIERTAS</span></MenuItem>
            <div class="note">REEMPLAZA TODAS LAS CUBIERTAS. [DESHACER] LAS RECUPERA MIENTRAS SIGAS EN EDITAR.</div>
        </TermMenu>

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

    > .panel-tabs { display: flex; flex-wrap: wrap; gap: 0 6px; white-space: pre; }
    > .rename { display: flex; gap: 8px; align-items: center; > span { flex: none; } > :deep(input) { flex: 1; min-width: 0; } }
    .panel-tab.active { font-weight: bold; }
    .panel-tab:active, .panel-tab.target { @include inverse; }

    .lifted { opacity: 0.45; }
    // a window that asks for attention: brighter frame; an urgent one blinks it in steps
    .alive { border-color: var(--ph); @include box-glow(1.4); }
    .urgent { animation: alive-blink 1s steps(1) infinite; }
    // where the dropped window will land: a lit edge on the side it will take
    .drop-before { box-shadow: inset 0.35em 0 0 var(--ph); }
    .drop-after { box-shadow: inset -0.35em 0 0 var(--ph); }

    .flash { animation: flash 0.3s steps(1) 4; }

    .note { color: var(--ph-dim); padding: 4px 6px; }
    .dim { color: var(--ph-dim); }

    > .add { padding: 6px; text-align: center; border: 1px dashed var(--ph); }
}

@keyframes alive-blink {
    50% { border-color: var(--ph-dim); }
}

@keyframes flash {
    50% { background: var(--ph); }
}

@media (prefers-reduced-motion: reduce) {
    .dashboard .flash, .dashboard .urgent { animation: none; }
}
</style>
