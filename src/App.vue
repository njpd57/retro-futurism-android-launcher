<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useAppsStore, type InstalledAppInfo } from '@/stores/useAppsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
import { useWindowInsetsStore } from '@/stores/useWindowInsetsStore';
import { searchApps } from '@/utils/appSearch';
import { px } from '@/utils/el-utils';
import AppList from '@/components/AppList.vue';
import CrtScreen from '@/components/CrtScreen.vue';
import Dashboard from '@/components/Dashboard.vue';
import MenuItem from '@/components/MenuItem.vue';
import PromptBar from '@/components/PromptBar.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import TermMenu from '@/components/TermMenu.vue';
import TopBar from '@/components/TopBar.vue';

const insets = useWindowInsetsStore();
const appsStore = useAppsStore();
const settings = useSettingsStore();
const toggles = useTogglesStore();
const bridgeEvents = useBridgeEventStore();
const launchStore = useLaunchStore();

const query = ref('');
const settingsOpen = ref(false);
const menuApp = ref<InstalledAppInfo | null>(null);

const insetTop = computed(() => insets.statusBarsIgnoringVisibility.top);
const insetBottom = computed(() => Math.max(insets.navigationBars.bottom, insets.ime.bottom));

const results = computed(() => searchApps(appsStore.apps.values(), query.value, settings.hiddenApps));
const overlayOpen = computed(() => settingsOpen.value || menuApp.value !== null);

function launch(app: InstalledAppInfo)
{
    launchStore.launch(app.packageName, app.label);
    query.value = '';
}

// typing from the panel goes to the app list
watch(query, q =>
{
    if (q && settings.activeTab === 'panel')
        settings.activeTab = 'apps';
});

function launchFirst()
{
    if (results.value.length)
        launch(results.value[0]);
}

function closeOverlays()
{
    settingsOpen.value = false;
    menuApp.value = null;
}

function menuAction(action: (packageName: string) => void)
{
    if (menuApp.value)
        action(menuApp.value.packageName);
    closeOverlays();
}

// Bridge forwards the back button to the WebView history: one entry per open overlay.
let historyEntryPushed = false;

watch(overlayOpen, open =>
{
    if (open && !historyEntryPushed)
    {
        history.pushState({}, '');
        historyEntryPushed = true;
    }
    else if (!open && historyEntryPushed)
    {
        historyEntryPushed = false;
        history.back();
    }
});

function onPopState()
{
    if (historyEntryPushed)
    {
        historyEntryPushed = false;
        closeOverlays();
    }
}

// Home pressed while already home.
bridgeEvents.addEventListener(ev =>
{
    if (ev.name === 'newIntent')
    {
        closeOverlays();
        query.value = '';
        settings.activeTab = 'panel';
    }
});

// An opaque screen of our own, no WebView overscroll glow. The previous values are restored on teardown.
const previous = {
    wallpaper: toggles.drawSystemWallpaperBehindWebView,
    overscroll: toggles.overscrollEffects,
};

onMounted(() =>
{
    window.addEventListener('popstate', onPopState);
    toggles.drawSystemWallpaperBehindWebView = false;
    toggles.overscrollEffects = 'none';
});

onUnmounted(() =>
{
    window.removeEventListener('popstate', onPopState);
    toggles.drawSystemWallpaperBehindWebView = previous.wallpaper;
    toggles.overscrollEffects = previous.overscroll;
});
</script>

<template>
    <CrtScreen :style="{ '--inset-top': px(insetTop), '--inset-bottom': px(insetBottom) }">
        <div
            class="screen"
            :style="{ 'padding-top': px(insetTop), 'padding-bottom': px(insetBottom) }">
            <TopBar :tab="settings.activeTab" @open-settings="settingsOpen = true" @select-tab="settings.activeTab = $event" />
            <Dashboard v-if="settings.activeTab === 'panel'" @menu="menuApp = $event" />
            <AppList v-else :apps="results" :highlight-first="query.length > 0" @launch="launch" @menu="menuApp = $event" />
            <PromptBar v-model="query" @submit="launchFirst" />
            <div class="help">TOCA PARA ABRIR · MANTÉN PARA OPCIONES</div>
        </div>

        <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />

        <TermMenu v-if="menuApp" :title="menuApp.label.toUpperCase()" @close="menuApp = null">
            <MenuItem @click="menuAction(p => launchStore.launch(p, menuApp?.label))"><span>ABRIR</span></MenuItem>
            <MenuItem @click="menuAction(p => settings.toggleFavorite(p))">
                <span>{{ settings.favorites.includes(menuApp.packageName) ? 'DESFIJAR' : 'FIJAR' }}</span>
            </MenuItem>
            <MenuItem @click="menuAction(p => Bridge.requestOpenAppInfo(p))"><span>INFO</span></MenuItem>
            <MenuItem @click="menuAction(p => settings.hideApp(p))"><span>OCULTAR</span></MenuItem>
            <MenuItem @click="menuAction(p => Bridge.requestAppUninstall(p))"><span>DESINSTALAR</span></MenuItem>
        </TermMenu>
    </CrtScreen>
</template>

<style scoped lang="scss">
.screen {
    display: flex;
    flex-direction: column;
    height: 100%;

    > .help {
        flex: none;
        padding: 2px 10px 4px;
        font-size: 18px;
        color: var(--ph-dim);
        text-align: center;
    }
}
</style>
