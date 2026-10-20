import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, watch } from "vue";
import { changes, cleanRuleName, evaluate, MAX_RULES, normalizeRules, overlay, TEMPLATES, type Rule, type RuleContext } from "@/protocols/rules";
import { selectPanel } from "@/utils/dashboardLayout";
import { useLogStore } from "./useLogStore";
import { useSettingsStore } from "./useSettingsStore";
import { useShipClockStore } from "./useShipClockStore";
import { useSystemStatusStore } from "./useSystemStatusStore";

/**
 * PROTOCOLOS DE TURNO: rules of the form "if the hour / charging / battery / Wi-Fi are so, then change the panel,
 * the phosphor, the visible apps...". The rules never touch the user's own settings; `useEffectiveSettings` reads
 * what they add. Only the panel is switched, once, when a protocol starts, so swiping still works afterwards.
 */
export const useProtocolsStore = defineStore('protocols', () =>
{
    const settings = useSettingsStore();
    const system = useSystemStatusStore();
    const clock = useShipClockStore();
    const log = useLogStore();

    const rules = useLocalStorage<Rule[]>('settings.protocols', []);
    rules.value = normalizeRules(rules.value);

    const context = computed<RuleContext>(() => ({
        now: clock.now,
        charging: system.battery ? system.battery.isCharging : null,
        battery: system.battery ? system.battery.level : null,
        wifi: system.connectivity ? system.connectivity.type === 'wifi' : null,
    }));

    const active = computed(() => evaluate(rules.value, context.value));
    const effect = computed(() => overlay(rules.value, active.value));

    watch(active, (after, before) =>
    {
        const { started, ended } = changes(before ?? [], after);
        for (const id of ended) log.push('PRT', `${rules.value.find(r => r.id === id)?.name ?? 'PROTOCOLO'} FINALIZADO`);
        for (const id of started)
        {
            const rule = rules.value.find(r => r.id === id);
            if (!rule) continue;
            log.push('PRT', `${rule.name} ACTIVO`);
            const panel = [...rule.then].reverse().find(e => e.type === 'panel');
            if (panel && panel.type === 'panel') settings.layouts = selectPanel(settings.layouts, panel.index);
        }
    }, { immediate: true });

    const newId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

    function update(id: string, patch: Partial<Omit<Rule, 'id'>>)
    {
        rules.value = rules.value.map(r => r.id === id ? { ...r, ...patch, ...(patch.name !== undefined ? { name: cleanRuleName(patch.name) || r.name } : {}) } : r);
    }

    function remove(id: string)
    {
        rules.value = rules.value.filter(r => r.id !== id);
    }

    /** Adds a rule from a template (or an empty one) and returns its id; null at the limit. */
    function add(template?: number): string | null
    {
        if (rules.value.length >= MAX_RULES) return null;
        const base = template !== undefined ? TEMPLATES[template] : { name: 'NUEVO', enabled: true, when: [], then: [] };
        const id = newId();
        rules.value = [...rules.value, { ...JSON.parse(JSON.stringify(base)), id }];
        return id;
    }

    return { rules, active, effect, update, remove, add };
});
