<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { displayName, SORT_MODES } from '@/utils/appSearch';
import { indexLetter, letterAt, presentLetters } from '@/utils/alphaIndex';
import { buildRows } from '@/utils/folders';
import { isNewApp } from '@/utils/newApps';
import AppRow from './AppRow.vue';

const props = defineProps<{ apps: InstalledAppInfo[]; highlightFirst: boolean; searching: boolean }>();
defineEmits<{ (e: 'launch', app: InstalledAppInfo): void; (e: 'menu', app: InstalledAppInfo): void }>();

const settings = useSettingsStore();
const appsStore = useAppsStore();
const usage = useUsageStore();

const openFolders = ref(new Set<string>());
function toggleFolder(name: string)
{
    const next = new Set(openFolders.value);
    if (!next.delete(name)) next.add(name);
    openFolders.value = next;
}

// folders only organize the browsing view; a search is always flat
const rows = computed(() => props.searching
    ? props.apps.map(app => ({ type: 'app' as const, app, depth: 0 as const }))
    : buildRows(props.apps, settings.folders, openFolders.value));

const usageByPackage = computed(() => Object.fromEntries(usage.apps.map(a => [a.packageName, a.totalTimeMs])));
const now = Date.now();
const sortLabel = computed(() => SORT_MODES.find(m => m.id === settings.sortMode)?.label ?? '');

function nextSort()
{
    const i = SORT_MODES.findIndex(m => m.id === settings.sortMode);
    settings.sortMode = SORT_MODES[(i + 1) % SORT_MODES.length].id;
}

// A–Z strip: only when browsing alphabetically
const scroller = ref<HTMLElement | null>(null);
const letters = computed(() => props.searching || settings.sortMode !== 'alpha' ? [] : presentLetters(
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
    <div class="app-list-wrap">
        <div ref="scroller" class="app-list">
            <div v-if="!searching" class="toolbar">
                <span class="pressable" @click="nextSort">ORDEN: {{ sortLabel }}</span>
                <span class="pressable" @click="settings.listMode = settings.listMode === 'long' ? 'simple' : 'long'">{{ settings.listMode === 'long' ? '[LS -L]' : '[LISTA]' }}</span>
            </div>
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
                    @launch="$emit('launch', row.app)"
                    @menu="$emit('menu', row.app)" />
            </template>
            <div v-if="!apps.length" class="empty">SIN RESULTADOS</div>
            <slot />
        </div>

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

    > .folder {
        display: flex;
        justify-content: space-between;
        padding: 3px 10px;
        font-weight: bold;

        &:active { @include inverse; }
    }
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
