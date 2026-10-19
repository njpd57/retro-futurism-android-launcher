<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useOwnStatusBar } from '@/composables/useOwnStatusBar';
import { useMotherStore } from '@/stores/useMotherStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
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
import MotherTerminal from '@/components/MotherTerminal.vue';
import NotificationWindow from '@/components/NotificationWindow.vue';
import StatusBar from '@/components/StatusBar.vue';
import PromptBar from '@/components/PromptBar.vue';
import SoftKeys, { type SoftKey } from '@/components/SoftKeys.vue';
import SettingsPanel from '@/components/SettingsPanel.vue';
import TermMenu from '@/components/TermMenu.vue';
import TopBar from '@/components/TopBar.vue';
import { useAppShortcuts } from '@/composables/useAppShortcuts';

const insets = useWindowInsetsStore();
const appsStore = useAppsStore();
const settings = useSettingsStore();
const toggles = useTogglesStore();
const bridgeEvents = useBridgeEventStore();
const launchStore = useLaunchStore();

const notifications = useNotificationsStore();
const mother = useMotherStore();
const notificationsOpen = ref(false);

useOwnStatusBar(computed(() => settings.ownStatusBar));

const query = ref('');
const prompt = ref<InstanceType<typeof PromptBar> | null>(null);
const editing = ref(false);
const settingsOpen = ref(false);
const menuApp = ref<InstalledAppInfo | null>(null);
const { shortcuts: menuShortcuts, start: startShortcut } = useAppShortcuts(computed(() => menuApp.value?.packageName ?? null));

const MIN_STATUS_BAR_PX = 24;
const statusBarHeight = computed(() => Math.max(insets.statusBarsIgnoringVisibility.top, MIN_STATUS_BAR_PX));
// with our own status bar it draws in the top inset, so the page doesn't pad for it
const insetTop = computed(() => settings.ownStatusBar ? 0 : insets.statusBarsIgnoringVisibility.top);

function openStatusBar()
{
    if (notifications.supported)
        notificationsOpen.value = true;
    else
        Bridge.requestExpandNotificationShade();
}
const insetBottom = computed(() => Math.max(insets.navigationBars.bottom, insets.ime.bottom));

const results = computed(() => searchApps(appsStore.apps.values(), query.value, settings.hiddenApps));
const softKeys = computed<SoftKey[]>(() => settings.activeTab === 'panel'
    ? [
        { label: editing.value ? 'LISTO' : 'EDITAR', action: () => { editing.value = !editing.value; } },
        { label: 'NOTIF', action: () => { notificationsOpen.value = true; } },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]
    : settings.activeTab === 'mother'
    ? [
        mother.busy ? { label: 'ABORTAR', action: () => mother.abort() } : { label: 'BORRAR', action: () => mother.clear() },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]
    : [
        { label: 'BUSCAR', action: () => prompt.value?.focus() },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]);

const overlayOpen = computed(() => settingsOpen.value || menuApp.value !== null || notificationsOpen.value);

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
    notificationsOpen.value = false;
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
        editing.value = false;
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
            <StatusBar v-if="settings.ownStatusBar" :style="{ height: px(statusBarHeight) }" @open="openStatusBar" />
            <TopBar :tab="settings.activeTab" @open-settings="settingsOpen = true" @select-tab="settings.activeTab = $event" @open-notifications="notificationsOpen = true" />
            <Dashboard v-if="settings.activeTab === 'panel'" :editing="editing" @menu="menuApp = $event" />
            <MotherTerminal v-else-if="settings.activeTab === 'mother'" />
            <AppList v-else :apps="results" :highlight-first="query.length > 0" @launch="launch" @menu="menuApp = $event" />
            <PromptBar v-if="settings.activeTab !== 'mother'" ref="prompt" v-model="query" @submit="launchFirst" />
            <SoftKeys :keys="softKeys" />
        </div>

        <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />
        <NotificationWindow v-if="notificationsOpen" @close="notificationsOpen = false" />

        <TermMenu v-if="menuApp" :title="menuApp.label.toUpperCase()" @close="menuApp = null">
            <MenuItem v-for="sc in menuShortcuts" :key="sc.id" @click="menuAction(() => startShortcut(sc.id))">
                <span>» {{ sc.shortLabel.toUpperCase() }}</span>
            </MenuItem>
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
}
</style>
