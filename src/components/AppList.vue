<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useAppsViewStore } from '@/stores/useAppsViewStore';
import { displayName, nextSortMode, SORT_MODES } from '@/utils/appSearch';
import { buildBoxes, looseApps } from '@/utils/appGroups';
import { indexLetter, letterAt, presentLetters } from '@/utils/alphaIndex';
import { assignToFolder, buildRows, folderOf } from '@/utils/folders';
import { autoScrollSpeed, dropAction, NEW_FOLDER_BAR_PX, NEW_FOLDER_ID } from '@/utils/dragDrop';
import { elementAtPoint } from '@/utils/pointUnder';
import { bendK, correctPoint } from '@/utils/curvature';
import { tick } from '@/utils/haptics';
import { isNewApp } from '@/utils/newApps';
import AppRow from './AppRow.vue';
import FolderBox from './FolderBox.vue';
import DeckMap from './DeckMap.vue';

const props = defineProps<{ apps: InstalledAppInfo[]; highlightFirst: boolean; searching: boolean }>();
const emit = defineEmits<{ (e: 'launch', app: InstalledAppInfo): void; (e: 'menu', app: InstalledAppInfo): void; (e: 'mother'): void; (e: 'images'): void; (e: 'new-folder', app: InstalledAppInfo): void }>();

const settings = useSettingsStore();
const appsStore = useAppsStore();
const usage = useUsageStore();

const view = useAppsViewStore();
const launchStore = useLaunchStore();

const openFolders = ref(new Set<string>());
function toggleFolder(name: string)
{
    const next = new Set(openFolders.value);
    if (!next.delete(name)) next.add(name);
    openFolders.value = next;
}

const usageByPackage = computed(() => Object.fromEntries(usage.apps.map(a => [a.packageName, a.totalTimeMs])));
const now = Date.now();

// folders as boxes: the root shows the boxes and the apps in no folder; opening a box lists only its apps
const boxMode = computed(() => settings.folderBoxes && !props.searching);
const boxes = computed(() => buildBoxes(props.apps, {
    folders: settings.folders,
    favorites: settings.favorites,
    recents: launchStore.recents,
    firstSeen: appsStore.firstSeen,
    usage: usageByPackage.value,
    now,
}));
const openBox = computed(() => boxMode.value ? boxes.value.find(b => b.id === view.box) ?? null : null);

// the open box vanished (emptied folder, no favorites left)
watch([boxes, boxMode], () =>
{
    if (view.box !== null && !openBox.value) view.close();
});
watch(() => view.box, async () =>
{
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = 0;
});

// folders only organize the browsing view; a search is always flat
const rows = computed(() =>
{
    if (props.searching) return props.apps.map(app => ({ type: 'app' as const, app, depth: 0 as const }));
    if (!boxMode.value) return buildRows(props.apps, settings.folders, openFolders.value);
    const list = openBox.value ? openBox.value.apps : looseApps(props.apps, settings.folders);
    return list.map(app => ({ type: 'app' as const, app, depth: 0 as const }));
});

const sortLabel = computed(() => SORT_MODES.find(m => m.id === settings.sortMode)?.label ?? '');

function nextSort()
{
    settings.sortMode = nextSortMode(settings.sortMode);
}

// A–Z strip: only when browsing alphabetically
const scroller = ref<HTMLElement | null>(null);
const wrap = ref<HTMLElement | null>(null);

// Dragging an app into a folder box: a lifted row follows the finger as a ghost, the box under it lights up, and the
// list scrolls by itself near its edges so the boxes (at the top) can be reached from far down the list.
// It only exists while the boxes are on screen; elsewhere a long press just opens the menu.
const canDrag = computed(() => boxMode.value && !openBox.value);
const dragged = ref<InstalledAppInfo | null>(null);
const ghost = ref({ x: 0, y: 0 });
const hover = ref<string | null>(null);
let lastPoint: { x: number; y: number } | null = null;
let scrollTimer: number | undefined;

const tubeRect = () => settings.curvature ? document.querySelector('.crt-screen .tube')?.getBoundingClientRect() ?? null : null;

function startDrag(app: InstalledAppInfo)
{
    dragged.value = app;
    hover.value = null;
    lastPoint = null;
    window.clearInterval(scrollTimer);
    scrollTimer = window.setInterval(autoScroll, 16);
}

function stopDrag()
{
    window.clearInterval(scrollTimer);
    scrollTimer = undefined;
    dragged.value = null;
    hover.value = null;
    lastPoint = null;
}

function updateHover()
{
    if (!lastPoint) return;
    const el = elementAtPoint(lastPoint.x, lastPoint.y, tubeRect(), bendK(settings.curvatureBend));
    const id = el?.closest<HTMLElement>('[data-drop-box]')?.dataset.dropBox ?? null;
    if (id !== hover.value && id !== null && settings.haptics) tick(6);
    hover.value = id;
}

function moveDrag(x: number, y: number)
{
    lastPoint = { x, y };
    // the ghost is painted inside the curved tube, so it is placed where the finger is *seen*, not where it touches
    const rect = tubeRect();
    const p = rect ? correctPoint(x, y, rect, bendK(settings.curvatureBend)) : { x, y };
    const box = wrap.value?.getBoundingClientRect();
    if (box) ghost.value = { x: p.x - box.left, y: p.y - box.top };
    updateHover();
}

function autoScroll()
{
    const box = wrap.value?.getBoundingClientRect();
    if (!box || !lastPoint || !scroller.value) return;
    const speed = autoScrollSpeed(lastPoint.y, box.top, box.bottom - NEW_FOLDER_BAR_PX);
    if (!speed) return;
    scroller.value.scrollTop += speed;
    updateHover(); // what is under the finger changes as the list moves
}

function dropDrag(x: number, y: number)
{
    const app = dragged.value;
    lastPoint = { x, y };
    updateHover();
    const action = app ? dropAction(hover.value, boxes.value, folderOf(settings.folders, app.packageName)) : { type: 'none' as const };
    stopDrag();
    if (!app) return;
    if (action.type === 'folder')
    {
        settings.folders = assignToFolder(settings.folders, app.packageName, action.name);
        if (settings.haptics) tick();
    }
    else if (action.type === 'new') emit('new-folder', app);
}

function dropState(b: { id: string; kind: 'system' | 'folder' }): 'none' | 'ready' | 'over'
{
    if (!dragged.value || b.kind !== 'folder') return 'none';
    return hover.value === b.id ? 'over' : 'ready';
}

onBeforeUnmount(stopDrag);
// (the recents box is ordered by recency, so letters would not match)
const letters = computed(() => props.searching || settings.sortMode !== 'alpha' || openBox.value?.id === 'sys:recents' ? [] : presentLetters(
    rows.value.filter(r => r.type === 'app' && r.depth === 0).map(r => displayName((r as { app: InstalledAppInfo }).app, settings.aliases))));
const activeLetter = ref<string | null>(null);

function jump(e: PointerEvent)
{
    const strip = e.currentTarget as HTMLElement;
    const box = strip.getBoundingClientRect();
    const letter = letterAt(letters.value, (e.clientY - box.top) / box.height);
    if (!letter) return;
    activeLetter.value = letter;
    scroller.value?.querySelector<HTMLElement>(`[data-letter="${letter}"]`)?.scrollIntoView({ block: 'start' });
}

function onStripDown(e: PointerEvent)
{
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    jump(e);
}
function onStripMove(e: PointerEvent)
{
    if (activeLetter.value) jump(e);
}
</script>

<template>
    <div ref="wrap" class="app-list-wrap">
        <div ref="scroller" class="app-list">
            <div v-if="openBox" class="box-head pressable" @click="view.close()">
                <span>‹ {{ openBox.label }}</span><span>({{ openBox.count }})</span>
            </div>
            <div v-if="!searching" class="toolbar">
                <span class="pressable" @click="nextSort">ORDEN: {{ sortLabel }}</span>
                <template v-if="!openBox">
                    <span class="pressable" @click="$emit('mother')">[MOTHER]</span>
                    <span class="pressable" @click="$emit('images')">[IMÁGENES]</span>
                </template>
                <span class="pressable" @click="settings.listMode = settings.listMode === 'long' ? 'simple' : 'long'">{{ settings.listMode === 'long' ? '[LS -L]' : '[LISTA]' }}</span>
            </div>
            <DeckMap
                v-if="boxMode && !openBox && boxes.length && settings.appsLayout === 'deck'"
                :boxes="boxes"
                :drop-state="dropState"
                :indexed="letters.length > 1"
                @open="view.open($event)" />
            <div v-else-if="boxMode && !openBox && boxes.length" class="boxes" :class="{ indexed: letters.length > 1 }">
                <FolderBox
                    v-for="b in boxes"
                    :key="b.id"
                    :label="b.label"
                    :count="b.count"
                    :fraction="b.usageFraction"
                    :has-new="b.hasNew"
                    :system="b.kind === 'system'"
                    :box-id="b.id"
                    :drop-state="dropState(b)"
                    @open="view.open(b.id)" />
            </div>
            <div v-if="boxMode && !openBox && boxes.length && rows.length" class="divider">── SIN CARPETA ──</div>
            <div v-if="settings.listMode === 'long' && !searching" class="head"><span>NOMBRE</span><span class="usage">USO</span><span>TIPO</span></div>

            <template v-for="row in rows" :key="row.type === 'folder' ? `f:${row.name}` : row.app.packageName">
                <div v-if="row.type === 'folder'" class="folder pressable" @click="toggleFolder(row.name)">
                    <span>{{ row.open ? '▼' : '»' }} {{ row.name }}/</span><span>({{ row.count }})</span>
                </div>
                <AppRow
                    v-else
                    :app="row.app"
                    :depth="row.depth"
                    :highlighted="highlightFirst && row.app === apps[0]"
                    :is-new="isNewApp(appsStore.firstSeen[row.app.packageName], now)"
                    :usage-ms="usageByPackage[row.app.packageName]"
                    :can-drag="canDrag && row.depth === 0"
                    :dragged="dragged === row.app"
                    @launch="$emit('launch', row.app)"
                    @menu="$emit('menu', row.app)"
                    @drag-start="startDrag(row.app)"
                    @drag-move="moveDrag"
                    @drag-drop="dropDrag"
                    @drag-cancel="stopDrag" />
            </template>
            <div v-if="!apps.length" class="empty">SIN RESULTADOS</div>
            <slot />
        </div>

        <div v-if="dragged" class="ghost" :style="{ left: ghost.x + 'px', top: ghost.y + 'px' }">{{ displayName(dragged, settings.aliases) }}</div>
        <div
            v-if="dragged"
            class="new-folder"
            :class="{ over: hover === NEW_FOLDER_ID }"
            :data-drop-box="NEW_FOLDER_ID"
            :style="{ height: NEW_FOLDER_BAR_PX + 'px' }">[+ NUEVA CARPETA]</div>
        <div
            v-if="letters.length > 1"
            class="index"
            data-no-swipe
            @pointerdown="onStripDown"
            @pointermove="onStripMove"
            @pointerup="activeLetter = null"
            @pointercancel="activeLetter = null">
            <span v-for="l in letters" :key="l" :class="{ active: l === activeLetter }">{{ l }}</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.app-list-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
}

.app-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: none;
    padding: 4px 0;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }

    > .empty { padding: 3px 10px; opacity: 0.6; }

    > .toolbar {
        display: flex;
        justify-content: space-between;
        padding: 0 10px 4px;
        color: var(--ph-dim);
        font-size: 0.8em;
        white-space: nowrap;

        > span:active { @include inverse; }
    }

    > .head {
        display: flex;
        justify-content: space-between;
        padding: 0 10px 2px;
        color: var(--ph-dim);
        font-size: 0.8em;
        border-bottom: 1px solid var(--ph-dim);
        margin-bottom: 2px;

        > span:first-child { flex: 1; }
        > .usage { width: 4.5em; text-align: right; margin-right: 12px; }
    }

    > .box-head {
        display: flex;
        justify-content: space-between;
        padding: 3px 10px;
        margin-bottom: 4px;
        font-weight: bold;
        @include inverse;
    }

    > .boxes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
        padding: 0 10px 6px;

        &.indexed { padding-right: 32px; }
    }

    > .divider {
        padding: 0 10px 2px;
        color: var(--ph-dim);
        font-size: 0.8em;
        white-space: nowrap;
        overflow: hidden;
    }

    > .folder {
        display: flex;
        justify-content: space-between;
        padding: 3px 10px;
        font-weight: bold;

        &:active { @include inverse; }
    }
}

// the app being carried: an inverse row centred above the finger so the thumb does not hide it
.ghost {
    @include inverse;
    position: absolute;
    z-index: 3;
    transform: translate(-50%, -150%);
    max-width: 70%;
    padding: 3px 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
}

.new-folder {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ph-bg);
    border-top: 1px dashed var(--ph);

    &.over { @include inverse; }
}

// thin letter strip on the right edge; the only place with touch-action none
.index {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    font-size: 0.6em;
    line-height: 1;
    color: var(--ph-dim);
    touch-action: none;
    z-index: 1;

    > .active { @include inverse; }
}
</style>
