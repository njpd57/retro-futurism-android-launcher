import { defineStore } from "pinia";
import { computed, reactive, watch } from "vue";
import { attentionByKind, liveKinds } from "@/utils/attention";
import { useBridgeConsoleStore } from "./useBridgeConsoleStore";
import { useShipClockStore } from "./useShipClockStore";
import { useSystemStatusStore } from "./useSystemStatusStore";

/** What each live window needs right now (radar: signals, alarm: the alarm, power: the reserve), for `Dashboard` to grow them. */
export const useAttentionStore = defineStore('attention', () =>
{
    const console_ = useBridgeConsoleStore();
    const status = useSystemStatusStore();
    const clock = useShipClockStore();

    const attention = computed(() => attentionByKind(console_.lamps, status.battery ? { level: status.battery.level, isCharging: status.battery.isCharging } : null));

    /** When each kind went from idle to needing a look. */
    const raisedAt = reactive<Record<string, number>>({});
    watch(attention, (now, before) =>
    {
        for (const [kind, a] of Object.entries(now))
        {
            if (a === 'idle') delete raisedAt[kind];
            else if (!before || before[kind] === 'idle' || raisedAt[kind] === undefined) raisedAt[kind] = Date.now();
        }
    }, { immediate: true });

    const live = computed(() => liveKinds(attention.value, raisedAt, clock.now.getTime()));

    return { attention, live };
});
