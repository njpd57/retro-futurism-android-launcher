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
    const curvature = useLocalStorage('settings.curvature', false);
    // curvature tuning, all 0..100: SVG bend, corner radius and edge darkness
    const curvatureBend = useLocalStorage('settings.curvatureBend', 50);
    const curvatureCorners = useLocalStorage('settings.curvatureCorners', 50);
    const curvatureShade = useLocalStorage('settings.curvatureShade', 50);
    const showIcons = useLocalStorage('settings.showIcons', false);
    const soundUi = useLocalStorage('settings.soundUi', false);
    const soundAmbient = useLocalStorage('settings.soundAmbient', false);
    const volume = useLocalStorage('settings.volume', 0.5);
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
    const sortMode = useLocalStorage<SortMode>('settings.sortMode', 'alpha');
    const listMode = useLocalStorage<'simple' | 'long'>('settings.listMode', 'simple');
    const aliases = useLocalStorage<Record<string, string>>('settings.aliases', {});
    const folders = useLocalStorage<Folders>('settings.folders', {});
    /** Folders of the APPS tab as boxes (true) or as an inline accordion (false). */
    const folderBoxes = useLocalStorage('settings.folderBoxes', true);
    const idleMinutes = useLocalStorage('settings.idleMinutes', 0);
    const bootSequence = useLocalStorage('settings.bootSequence', true);
    const haptics = useLocalStorage('settings.haptics', false);
    const nightShift = useLocalStorage('settings.nightShift', false);
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

    return { imageFilter, sortMode, listMode, aliases, folders, folderBoxes, layouts, idleMinutes, bootSequence, haptics, nightShift, soundUi, soundAmbient, volume, sweep, curvature, curvatureBend, curvatureCorners, curvatureShade, showIcons, ownStatusBar, dashboard, favorites, activeTab, toggleFavorite, setAlias, phosphor, bloom, scanlines, flicker, vignette, labelCase, showType, hiddenApps, hideApp, unhideApp };
});
