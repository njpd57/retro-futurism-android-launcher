import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { DEFAULT_LAYOUT, type DashboardItem } from "@/utils/dashboardLayout";

export type Phosphor = 'amber' | 'green';
export type LabelCase = 'upper' | 'normal';
export type Tab = 'panel' | 'apps' | 'mother';

export const useSettingsStore = defineStore('settings', () =>
{
    const phosphor = useLocalStorage<Phosphor>('settings.phosphor', 'amber');
    const bloom = useLocalStorage('settings.bloom', 0.7);
    const scanlines = useLocalStorage('settings.scanlines', true);
    const flicker = useLocalStorage('settings.flicker', true);
    const vignette = useLocalStorage('settings.vignette', true);
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

    return { ownStatusBar, dashboard, favorites, activeTab, toggleFavorite, phosphor, bloom, scanlines, flicker, vignette, labelCase, showType, hiddenApps, hideApp, unhideApp };
});
