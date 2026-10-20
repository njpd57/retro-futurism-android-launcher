<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useOwnStatusBar } from '@/composables/useOwnStatusBar';
import { useMotherStore } from '@/stores/useMotherStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useAppsStore, type InstalledAppInfo } from '@/stores/useAppsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useEffectiveSettings } from '@/stores/useEffectiveSettings';
import { useUsageStore } from '@/stores/useUsageStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
import { useWindowInsetsStore } from '@/stores/useWindowInsetsStore';
import { nextSortMode, searchApps } from '@/utils/appSearch';
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
import AlertStrip from '@/components/AlertStrip.vue';
import QuarantineGate from '@/components/QuarantineGate.vue';
import QuarantineMenu from '@/components/QuarantineMenu.vue';
import { useQuarantineStore } from '@/stores/useQuarantineStore';
import BootSequence from '@/components/BootSequence.vue';
import ExtraResults from '@/components/ExtraResults.vue';
import MotherOrganizer from '@/components/MotherOrganizer.vue';
import { useOrganizerStore } from '@/stores/useOrganizerStore';
import ImageViewer from '@/components/ImageViewer.vue';
import { useImagesStore } from '@/stores/useImagesStore';
import IsolationGame from '@/components/isolation/IsolationGame.vue';
import MarinesGame from '@/components/marines/MarinesGame.vue';
import { useIsolationStore } from '@/stores/useIsolationStore';
import { useMarinesStore } from '@/stores/useMarinesStore';
import { useAppsViewStore } from '@/stores/useAppsViewStore';
import { useSettingsViewStore } from '@/stores/useSettingsViewStore';
import { parseSlash } from '@/mother/slash';
import MotherSessions from '@/components/MotherSessions.vue';
import AppRename from '@/components/AppRename.vue';
import AppFolderMenu from '@/components/AppFolderMenu.vue';
import IdleClock from '@/components/IdleClock.vue';
import StasisPod from '@/components/StasisPod.vue';
import { useNow } from '@vueuse/core';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { stasisActive } from '@/utils/stasis';
import { useIdleStore } from '@/stores/useIdleStore';
import { useAppShortcuts } from '@/composables/useAppShortcuts';
import { useCommandConsole } from '@/composables/useCommandConsole';
import { isCommandInput } from '@/utils/commands';
import { COMMANDS, matchCommands, type CommandDef } from '@/utils/commandRegistry';
import CommandList from '@/components/CommandList.vue';
import { useSwipe } from '@/composables/useSwipe';
import { neighbour } from '@/utils/swipe';
import { selectPanel } from '@/utils/dashboardLayout';
import type { Tab } from '@/stores/useSettingsStore';
import { prefersReducedMotion } from '@/composables/useReducedMotion';

const insets = useWindowInsetsStore();
const appsStore = useAppsStore();
const settings = useSettingsStore();
const toggles = useTogglesStore();
const bridgeEvents = useBridgeEventStore();
const launchStore = useLaunchStore();

const notifications = useNotificationsStore();
const mother = useMotherStore();
const notificationsOpen = ref(false);
const sessionsOpen = ref(false);
const organizer = useOrganizerStore();
const imagesStore = useImagesStore();
const isolation = useIsolationStore();
const marines = useMarinesStore();
const appsView = useAppsViewStore();
const settingsView = useSettingsViewStore();

useOwnStatusBar(computed(() => settings.ownStatusBar));

const query = ref('');
const prompt = ref<InstanceType<typeof PromptBar> | null>(null);
const editing = ref(false);
const settingsOpen = ref(false);
const menuApp = ref<InstalledAppInfo | null>(null);
const renameApp = ref<InstalledAppInfo | null>(null);
const folderApp = ref<InstalledAppInfo | null>(null);
const quarantineApp = ref<InstalledAppInfo | null>(null);
const quarantine = useQuarantineStore();
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

const effective = useEffectiveSettings();
const usageStore = useUsageStore();
const searchOptions = computed(() => ({
    sort: settings.sortMode,
    aliases: settings.aliases,
    firstSeen: appsStore.firstSeen,
    usage: Object.fromEntries(usageStore.apps.map(a => [a.packageName, a.totalTimeMs])),
}));
const results = computed(() => isCommandInput(query.value) ? [] : searchApps(appsStore.apps.values(), query.value, effective.hiddenApps, searchOptions.value));
const softKeys = computed<SoftKey[]>(() => settings.activeTab === 'panel'
    ? [
        { label: editing.value ? 'LISTO' : 'EDITAR', action: () => { editing.value = !editing.value; } },
        { label: 'MOTHER', action: () => { settings.activeTab = 'mother'; } },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]
    : settings.activeTab === 'mother'
    ? [
        mother.busy ? { label: 'ABORTAR', action: () => mother.abort() } : { label: 'BORRAR', action: () => mother.clear() },
        { label: 'SESIONES', action: () => { sessionsOpen.value = true; } },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]
    : appsView.box !== null && !query.value
    ? [
        { label: 'ATRÁS', action: () => appsView.close() },
        { label: 'ORDEN', action: () => { settings.sortMode = nextSortMode(settings.sortMode); } },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]
    : [
        { label: 'BUSCAR', action: () => prompt.value?.focus() },
        { label: 'AJUSTES', action: () => { settingsOpen.value = true; } },
    ]);

const overlayOpen = computed(() => settingsOpen.value || menuApp.value !== null || renameApp.value !== null || folderApp.value !== null || quarantineApp.value !== null || quarantine.pending !== null || notificationsOpen.value || sessionsOpen.value || organizer.open || imagesStore.open || isolation.open || marines.open);

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

const TAB_ORDER: Tab[] = ['panel', 'apps', 'mother'];
const screenEl = ref<HTMLElement | null>(null);
const swipe = useSwipe(screenEl, kind =>
{
    if (kind === 'pull-down') { openStatusBar(); return; }
    const step = kind === 'left' ? 1 : -1;
    // on the panel tab, swipes move through the panels first
    if (settings.activeTab === 'panel')
    {
        const target = settings.layouts.active + step;
        if (target >= 0 && target < settings.layouts.panels.length) { settings.layouts = selectPanel(settings.layouts, target); return; }
    }
    const next = neighbour(TAB_ORDER, settings.activeTab, step);
    if (next) settings.activeTab = next;
}, () => !overlayOpen.value && !editing.value);

// boot screen once per load; never with reduced motion
const booting = ref(settings.bootSequence && !prefersReducedMotion());

const idleStore = useIdleStore();
const alarmStore = useAlarmStore();
// HIPERSUEÑO: the rest screen at night, with an alarm set, is a pod counting down to it. Decided when the screen rests.
const clock = useNow({ interval: 60_000 });
// `> estasis` shows the pod at once (to see it without waiting for the night): until the next alarm, or 7 hours if none is set
const stasisPreview = ref<number | null>(null);
const stasisPreviewWake = () => alarmStore.nextAlarm?.triggerTime ?? Date.now() + 7 * 3_600_000;
const stasisWake = computed(() => settings.hypersleep && stasisActive(clock.value, alarmStore.nextAlarm?.triggerTime ?? null) ? alarmStore.nextAlarm!.triggerTime : null);

const commandConsole = useCommandConsole({ query, apps: () => appsStore.apps.values(), launch, organize: request => organizer.show(request), showImages: () => imagesStore.show(), showGame: () => isolation.show(), showMarines: () => marines.show(), showStasis: () => { stasisPreview.value = stasisPreviewWake(); } });

// the typed text goes to the MOTHER chat as a question
function askMother(text: string)
{
    query.value = '';
    settings.activeTab = 'mother';
    const slash = parseSlash(text);
    if (slash?.type === 'sessions') { sessionsOpen.value = true; return; }
    if (slash?.type === 'organize') { organizer.show(slash.request); return; }
    if (slash?.type === 'play') { isolation.show(); return; }
    mother.send(text);
}

const promptFocused = ref(false);
// the whole list while the prompt is focused and empty, or after `ayuda`; while typing, the commands that match
const showCommandList = computed(() => (promptFocused.value && !query.value.trim()) || commandConsole.command.value?.type === 'help');
const commandMatches = computed(() => commandConsole.command.value ? [] : matchCommands(query.value, 'console'));

function pickCommand(def: CommandDef)
{
    query.value = def.args ? `${def.name} ` : def.name;
    prompt.value?.focus();
    if (!def.args) commandConsole.run();
}

function launchFirst()
{
    if (commandConsole.run()) return;
    if (results.value.length)
        launch(results.value[0]);
}

function closeOverlays()
{
    notificationsOpen.value = false;
    settingsOpen.value = false;
    menuApp.value = null;
    renameApp.value = null;
    folderApp.value = null;
    quarantineApp.value = null;
    quarantine.cancel();
    sessionsOpen.value = false;
    organizer.close();
    imagesStore.close();
    isolation.close();
    marines.close();
}

function menuAction(action: (packageName: string) => void)
{
    const packageName = menuApp.value?.packageName;
    // the overlays close first: an app in quarantine opens its gate from the action, and closing would cancel it
    closeOverlays();
    if (packageName) action(packageName);
}

// Bridge forwards the back button to the WebView history: one entry per layer that back should close
// (the open overlay and the open box of the APPS tab). Closing a layer from the UI pops its entry with
// history.back(); `expectedPops` makes the popstate that causes skip the handler.
let overlayPushed = false;
let boxPushed = false;
let expectedPops = 0;

function syncHistory(open: boolean, pushed: boolean)
{
    if (open && !pushed)
        history.pushState({}, '');
    else if (!open && pushed)
    {
        expectedPops++;
        history.back();
    }
    return open;
}

watch(overlayOpen, open => { overlayPushed = syncHistory(open, overlayPushed); });
watch(() => appsView.box !== null, open => { boxPushed = syncHistory(open, boxPushed); });

// the box belongs to the APPS tab: leaving it closes the box so back never closes something out of sight
watch(() => settings.activeTab, tab => { if (tab !== 'apps') appsView.close(); });

function onPopState()
{
    if (expectedPops > 0)
    {
        expectedPops--;
        return;
    }
    if (overlayPushed)
    {
        // inside the settings page, back steps out of the submenu or section first; the entry is pushed again
        if (settingsOpen.value && settingsView.back())
        {
            history.pushState({}, '');
            return;
        }
        overlayPushed = false;
        closeOverlays();
    }
    else if (boxPushed)
    {
        boxPushed = false;
        appsView.close();
    }
}

// Home pressed while already home.
bridgeEvents.addEventListener(ev =>
{
    if (ev.name === 'newIntent')
    {
        closeOverlays();
        appsView.close();
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
    swipe.attach();
    toggles.drawSystemWallpaperBehindWebView = false;
    toggles.overscrollEffects = 'none';
});

onUnmounted(() =>
{
    window.removeEventListener('popstate', onPopState);
    swipe.detach();
    toggles.drawSystemWallpaperBehindWebView = previous.wallpaper;
    toggles.overscrollEffects = previous.overscroll;
});
</script>

<template>
    <CrtScreen :style="{ '--inset-top': px(insetTop), '--inset-bottom': px(insetBottom) }">
        <div
            ref="screenEl"
            class="screen"
            :style="{ 'padding-top': px(insetTop), 'padding-bottom': px(insetBottom) }">
            <StatusBar v-if="settings.ownStatusBar" :style="{ height: px(statusBarHeight) }" @open="openStatusBar" />
            <TopBar :tab="settings.activeTab" @open-settings="settingsOpen = true" @select-tab="settings.activeTab = $event" @open-notifications="notificationsOpen = true" />
            <AlertStrip />
            <Dashboard v-if="settings.activeTab === 'panel'" :editing="editing" @menu="menuApp = $event" />
            <MotherTerminal v-else-if="settings.activeTab === 'mother'" @sessions="sessionsOpen = true" />
            <CommandList v-else-if="showCommandList" :commands="COMMANDS.console" @pick="pickCommand" />
            <template v-else>
                <div v-if="commandConsole.command.value" class="console" :class="{ bare: !isCommandInput(query) }">
                    <div v-for="line in commandConsole.lines.value" :key="line">» {{ line }}</div>
                </div>
                <CommandList v-else-if="commandMatches.length" compact :commands="commandMatches" @pick="pickCommand" />
                <AppList v-if="!isCommandInput(query)" :apps="results" :searching="query.length > 0" :highlight-first="query.length > 0" @launch="launch" @menu="menuApp = $event" @mother="organizer.show()" @images="imagesStore.show()" @new-folder="folderApp = $event">
                    <ExtraResults v-if="query.trim()" :query="query" :top-app="results[0] ?? null" @ask="askMother" />
                </AppList>
            </template>
            <PromptBar v-if="settings.activeTab !== 'mother'" ref="prompt" v-model="query" @submit="launchFirst" @focus="promptFocused = $event" />
            <SoftKeys :keys="softKeys" />
        </div>

        <BootSequence v-if="booting" @done="booting = false" />
        <StasisPod v-if="stasisPreview !== null" :wake-at="stasisPreview" @wake="stasisPreview = null" />
        <template v-if="idleStore.idle">
            <StasisPod v-if="stasisWake !== null" :wake-at="stasisWake" @wake="idleStore.wake()" />
            <IdleClock v-else @wake="idleStore.wake()" />
        </template>
        <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />
        <NotificationWindow v-if="notificationsOpen" @close="notificationsOpen = false" />

        <MotherOrganizer v-if="organizer.open" />
        <ImageViewer v-if="imagesStore.open" />
        <IsolationGame v-if="isolation.open" />
        <MarinesGame v-if="marines.open" />
        <MotherSessions v-if="sessionsOpen" @close="sessionsOpen = false" />
        <AppRename v-if="renameApp" :app="renameApp" @close="renameApp = null" />
        <AppFolderMenu v-if="folderApp" :app="folderApp" @close="folderApp = null" />
        <QuarantineMenu v-if="quarantineApp" :app="quarantineApp" @close="quarantineApp = null" />
        <QuarantineGate v-if="quarantine.pending" />

        <TermMenu v-if="menuApp" :title="menuApp.label.toUpperCase()" @close="menuApp = null">
            <MenuItem v-for="sc in menuShortcuts" :key="sc.id" @click="menuAction(() => startShortcut(sc.id))">
                <span>» {{ sc.shortLabel.toUpperCase() }}</span>
            </MenuItem>
            <MenuItem @click="menuAction(p => launchStore.launch(p, menuApp?.label))"><span>ABRIR</span></MenuItem>
            <MenuItem @click="menuAction(p => settings.toggleFavorite(p))">
                <span>{{ settings.favorites.includes(menuApp.packageName) ? 'DESFIJAR' : 'FIJAR' }}</span>
            </MenuItem>
            <MenuItem @click="menuAction(p => Bridge.requestOpenAppInfo(p))"><span>INFO</span></MenuItem>
            <MenuItem @click="renameApp = menuApp; menuApp = null"><span>RENOMBRAR</span></MenuItem>
            <MenuItem @click="folderApp = menuApp; menuApp = null"><span>CARPETA</span></MenuItem>
            <MenuItem @click="quarantineApp = menuApp; menuApp = null"><span>CUARENTENA</span><span>{{ quarantine.has(menuApp.packageName) ? '[X]' : '' }}</span></MenuItem>
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

    > .console { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 10px; }
    > .console.bare { flex: none; max-height: 30%; border-bottom: 1px solid var(--ph-dim); }
}
</style>
