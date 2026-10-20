import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { DEFAULT_BUDGET_MIN, normalizeQuarantine, type Quarantine } from "@/utils/quarantine";
import { useUsageStore } from "./useUsageStore";

/** CUARENTENA: apps that ask for authorization before they open. The gate itself is `QuarantineGate`. */
export const useQuarantineStore = defineStore('quarantine', () =>
{
    const usage = useUsageStore();

    const apps = useLocalStorage<Quarantine>('settings.quarantine', {});
    apps.value = normalizeQuarantine(apps.value);

    /** the launch waiting for the user's authorization */
    const pending = ref<{ packageName: string; label: string; startedAt: number } | null>(null);

    const has = (packageName: string) => packageName in apps.value;
    const budgetOf = (packageName: string) => apps.value[packageName] ?? 0;

    function set(packageName: string, budgetMin = DEFAULT_BUDGET_MIN)
    {
        apps.value = { ...apps.value, [packageName]: budgetMin };
    }

    function release(packageName: string)
    {
        const { [packageName]: _gone, ...rest } = apps.value;
        apps.value = rest;
    }

    function request(packageName: string, label: string)
    {
        usage.sync();
        pending.value = { packageName, label, startedAt: Date.now() };
    }

    function cancel() { pending.value = null; }

    const usedMs = computed(() => (packageName: string) => usage.apps.find(a => a.packageName === packageName)?.totalTimeMs ?? 0);

    return { apps, pending, has, budgetOf, set, release, request, cancel, usedMs };
});
