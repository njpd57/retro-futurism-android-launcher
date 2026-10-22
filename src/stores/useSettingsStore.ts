import type { SoundProfileId } from "@/audio/profiles";
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";
import type { SortMode } from "@/utils/appSearch";
import type { Folders } from "@/utils/folders";
import type { ImageFilter } from "@/utils/crtFilter";
import { activePanel, createLayoutSet, normalizeLayoutSet, setActivePanelItems, type DashboardItem, type LayoutSet } from "@/utils/dashboardLayout";

export type Phosphor = 'amber' | 'green' | 'white' | 'blue' | 'red';
export const PHOSPHORS: { id: Phosphor; label: string }[] = [
    { id: 'amber', label: 'ÁMBAR' },
    { id: 'green', label: 'VERDE' },
    { id: 'white', label: 'BLANCO P4' },
    { id: 'blue', label: 'AZUL' },
    { id: 'red', label: 'ROJO' },
];
export type LabelCase = 'upper' | 'normal';
export type Tab = 'panel' | 'apps' | 'mother';

export const useSettingsStore = defineStore('settings', () =>
{
    const phosphor = useLocalStorage<Phosphor>('settings.phosphor', 'amber');
    const bloom = useLocalStorage('settings.bloom', 0.7);
    const scanlines = useLocalStorage('settings.scanlines', true);
    const flicker = useLocalStorage('settings.flicker', true);
    const vignette = useLocalStorage('settings.vignette', true);
    const sweep = useLocalStorage('settings.sweep', true);
    // the picture collapses to a dot when the launcher is paused and flashes back on
    const tubePower = useLocalStorage('settings.tubePower', true);
    // now and then the tube degausses on its own
    const autoDegauss = useLocalStorage('settings.autoDegauss', true);
    // phosphor persistence: a barely visible ghost of the fixed frame lines that grows with the hours of use
    const phosphorBurn = useLocalStorage('settings.phosphorBurn', false);
    const burnMinutes = useLocalStorage('settings.burnMinutes', 0);
    // animation categories (all off under prefers-reduced-motion, see useAnimStore)
    const animText = useLocalStorage('settings.animText', true);
    const animTransitions = useLocalStorage('settings.animTransitions', true);
    const animAmbient = useLocalStorage('settings.animAmbient', true);
    const curvature = useLocalStorage('settings.curvature', false);
    // curvature tuning, all 0..100: SVG bend, corner radius and edge darkness
    const curvatureBend = useLocalStorage('settings.curvatureBend', 50);
    const curvatureCorners = useLocalStorage('settings.curvatureCorners', 50);
    const curvatureShade = useLocalStorage('settings.curvatureShade', 50);
    const showIcons = useLocalStorage('settings.showIcons', false);
    const soundUi = useLocalStorage('settings.soundUi', false);
    const soundAmbient = useLocalStorage('settings.soundAmbient', false);
    const volume = useLocalStorage('settings.volume', 0.5);
    // per-channel levels (on top of `volume`), the UI timbre and the notification sound
    const volumeUi = useLocalStorage('settings.volumeUi', 1);
    const volumeAmbient = useLocalStorage('settings.volumeAmbient', 1);
    const volumeGame = useLocalStorage('settings.volumeGame', 1);
    // per-sound levels inside each channel (see audio/mix.ts); only the sounds that differ from 1 are kept
    const soundMix = useLocalStorage<Record<string, number>>('settings.soundMix', {});
    const soundProfile = useLocalStorage<SoundProfileId>('settings.soundProfile', 'terminal');
    const soundNotify = useLocalStorage('settings.soundNotify', false);
    const labelCase = useLocalStorage<LabelCase>('settings.labelCase', 'upper');
    const showType = useLocalStorage('settings.showType', true);
    const hiddenApps = useLocalStorage<string[]>('settings.hiddenApps', []);
    const favorites = useLocalStorage<string[]>('settings.favorites', []);
    // The single layout used before panels existed is migrated into panel 1 the first time.
    let legacy: DashboardItem[] | null = null;
    try { legacy = JSON.parse(localStorage.getItem('settings.dashboard') ?? 'null'); } catch { /* ignore */ }
    const layouts = useLocalStorage<LayoutSet>('settings.layouts', createLayoutSet(legacy));
    layouts.value = normalizeLayoutSet(layouts.value, legacy);
    /** The visible panel's windows. */
    const dashboard = computed({
        get: () => activePanel(normalizeLayoutSet(layouts.value)),
        set: items => { layouts.value = setActivePanelItems(normalizeLayoutSet(layouts.value), items); },
    });
    const ownStatusBar = useLocalStorage('settings.ownStatusBar', false);
    /** Percent of the status bar left empty for the camera; 0 = measured from the display cutout. */
    const cameraWidth = useLocalStorage('settings.cameraWidth', 0);
    /** MOTHER's teletype under the bridge console. */
    const ticker = useLocalStorage('settings.ticker', true);
    /** Windows whose subject needs a look (signals, alarm, low battery) grow a size for a while. */
    const liveWidgets = useLocalStorage('settings.liveWidgets', true);
    const sortMode = useLocalStorage<SortMode>('settings.sortMode', 'alpha');
    const listMode = useLocalStorage<'simple' | 'long'>('settings.listMode', 'simple');
    const aliases = useLocalStorage<Record<string, string>>('settings.aliases', {});
    const folders = useLocalStorage<Folders>('settings.folders', {});
    /** Folders of the APPS tab as boxes (true) or as an inline accordion (false). */
    // how the folder boxes are drawn: a grid of boxes, or the compartments of a deck plan
    const appsLayout = useLocalStorage<'boxes' | 'deck'>('settings.appsLayout', 'boxes');
    const folderBoxes = useLocalStorage('settings.folderBoxes', true);
    const idleMinutes = useLocalStorage('settings.idleMinutes', 0);
    const bootSequence = useLocalStorage('settings.bootSequence', true);
    const haptics = useLocalStorage('settings.haptics', false);
    const nightShift = useLocalStorage('settings.nightShift', false);
    // at night with an alarm set, the rest screen is a cryo pod counting down to it
    const hypersleep = useLocalStorage('settings.hypersleep', true);
    // ALERTAS DE A BORDO: each kind on its own, and the klaxon (it only sounds if the UI sound is on)
    const alertsEvent = useLocalStorage('settings.alertsEvent', true);
    const alertsBattery = useLocalStorage('settings.alertsBattery', true);
    const alertsAlarm = useLocalStorage('settings.alertsAlarm', true);
    const alertsKlaxon = useLocalStorage('settings.alertsKlaxon', false);
    const activeTab = useLocalStorage<Tab>('settings.activeTab', 'panel');
    const imageFilter = useLocalStorage<ImageFilter>('settings.imageFilter', 'phosphor');

    function hideApp(packageName: string)
    {
        if (!hiddenApps.value.includes(packageName))
            hiddenApps.value = [...hiddenApps.value, packageName];
    }

    function unhideApp(packageName: string)
    {
        hiddenApps.value = hiddenApps.value.filter(p => p !== packageName);
    }

    function setAlias(packageName: string, alias: string)
    {
        const { [packageName]: _old, ...rest } = aliases.value;
        aliases.value = alias.trim() ? { ...rest, [packageName]: alias.trim() } : rest;
    }

    function toggleFavorite(packageName: string)
    {
        favorites.value = favorites.value.includes(packageName)
            ? favorites.value.filter(p => p !== packageName)
            : [...favorites.value, packageName];
    }

    return { alertsEvent, alertsBattery, alertsAlarm, alertsKlaxon, imageFilter, sortMode, listMode, aliases, folders, folderBoxes, appsLayout, layouts, idleMinutes, bootSequence, haptics, nightShift, hypersleep, soundUi, soundAmbient, volume, volumeUi, volumeAmbient, volumeGame, soundMix, soundProfile, soundNotify, sweep, tubePower, autoDegauss, phosphorBurn, burnMinutes, animText, animTransitions, animAmbient, curvature, curvatureBend, curvatureCorners, curvatureShade, showIcons, ownStatusBar, cameraWidth, ticker, liveWidgets, dashboard, favorites, activeTab, toggleFavorite, setAlias, phosphor, bloom, scanlines, flicker, vignette, labelCase, showType, hiddenApps, hideApp, unhideApp };
});
