import { defineStore } from "pinia";
import { computed } from "vue";
import { isNight, NIGHT_MAX_BLOOM } from "@/utils/nightShift";
import { useProtocolsStore } from "./useProtocolsStore";
import { useSettingsStore } from "./useSettingsStore";
import { useShipClockStore } from "./useShipClockStore";

/**
 * What the screen actually uses: the user's settings with the active protocols laid over them. The user's own
 * values are never changed, so when a protocol ends everything is as they left it.
 */
export const useEffectiveSettings = defineStore('effectiveSettings', () =>
{
    const settings = useSettingsStore();
    const protocols = useProtocolsStore();
    const clock = useShipClockStore();

    /** red phosphor and less bloom: the night shift by schedule, or a protocol asking for it */
    const night = computed(() => protocols.effect.nightShift || (settings.nightShift && isNight(clock.now)));
    const phosphor = computed(() => protocols.effect.phosphor ?? (night.value ? 'red' : settings.phosphor));
    const bloom = computed(() => night.value ? Math.min(settings.bloom, NIGHT_MAX_BLOOM) : settings.bloom);

    /** the apps the user hid plus the ones in the folders a protocol hides */
    const hiddenApps = computed(() =>
    {
        const folders = protocols.effect.hiddenFolders;
        if (!folders.length) return settings.hiddenApps;
        const extra = folders.flatMap(f => settings.folders[f] ?? []);
        return [...new Set([...settings.hiddenApps, ...extra])];
    });

    const bigClock = computed(() => protocols.effect.bigClock);

    return { night, phosphor, bloom, hiddenApps, bigClock };
});
