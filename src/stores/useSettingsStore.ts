import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { DEFAULT_LAYOUT, type DashboardItem } from "@/utils/dashboardLayout";

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
    const showIcons = useLocalStorage('settings.showIcons', false);
    const soundUi = useLocalStorage('settings.soundUi', false);
    const soundAmbient = useLocalStorage('settings.soundAmbient', false);
    const volume = useLocalStorage('settings.volume', 0.5);
    const labelCase = useLocalStorage<LabelCase>('settings.labelCase', 'upper');
    const showType = useLocalStorage('settings.showType', true);
    const hiddenApps = useLocalStorage<string[]>('settings.hiddenApps', []);
    const favorites = useLocalStorage<string[]>('settings.favorites', []);
    const dashboard = useLocalStorage<DashboardItem[]>('settings.dashboard', DEFAULT_LAYOUT);
    const ownStatusBar = useLocalStorage('settings.ownStatusBar', false);
    const activeTab = useLocalStorage<Tab>('settings.activeTab', 'panel');

    function hideApp(packageName: string)
    {
        if (!hiddenApps.value.includes(packageName))
            hiddenApps.value = [...hiddenApps.value, packageName];
    }

    function unhideApp(packageName: string)
    {
        hiddenApps.value = hiddenApps.value.filter(p => p !== packageName);
    }

    function toggleFavorite(packageName: string)
    {
        favorites.value = favorites.value.includes(packageName)
            ? favorites.value.filter(p => p !== packageName)
            : [...favorites.value, packageName];
    }

    return { soundUi, soundAmbient, volume, sweep, curvature, showIcons, ownStatusBar, dashboard, favorites, activeTab, toggleFavorite, phosphor, bloom, scanlines, flicker, vignette, labelCase, showType, hiddenApps, hideApp, unhideApp };
});
