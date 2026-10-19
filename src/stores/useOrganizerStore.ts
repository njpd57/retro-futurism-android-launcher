import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { chatJson } from "@/mother/api";
import { applyPlan, buildOrganizeMessages, describePlan, isPlanEmpty, parsePlan, type OrganizePlan, type OrganizeState } from "@/mother/organizer";
import { searchApps } from "@/utils/appSearch";
import { describeFetchError } from "@/utils/fetchJson";
import { useAppsStore } from "./useAppsStore";
import { useLogStore } from "./useLogStore";
import { useMotherStore } from "./useMotherStore";
import { useSettingsStore } from "./useSettingsStore";

export type OrganizerPhase = 'ask' | 'thinking' | 'preview' | 'applied' | 'error';

/**
 * MOTHER organizes the apps: folders and favorites from a request in plain words. Only the numbered names of the
 * visible apps are sent to the API, and nothing changes until the user accepts the preview. One undo is kept.
 */
export const useOrganizerStore = defineStore('organizer', () =>
{
    const mother = useMotherStore();
    const appsStore = useAppsStore();
    const settings = useSettingsStore();
    const log = useLogStore();

    const open = ref(false);
    const phase = ref<OrganizerPhase>('ask');
    const request = ref('');
    const error = ref('');
    const plan = ref<OrganizePlan | null>(null);
    const lines = ref<string[]>([]);
    const previous = ref<OrganizeState | null>(null);

    // the apps that were sent, in the order of their numbers
    let packages: string[] = [];
    let labels: string[] = [];
    let controller: AbortController | null = null;

    const canUndo = computed(() => previous.value !== null);

    /** Opens the window; with a request it runs at once. */
    function show(text = '')
    {
        open.value = true;
        if (phase.value === 'thinking') return;
        phase.value = 'ask';
        error.value = '';
        plan.value = null;
        request.value = text;
        if (text.trim()) run(text);
    }

    function close()
    {
        controller?.abort();
        open.value = false;
        phase.value = 'ask';
    }

    async function run(text: string)
    {
        request.value = text.trim();
        if (!request.value) return;
        if (!mother.hasKey) { fail('CLAVE API NO CONFIGURADA'); return; }

        const visible = searchApps(appsStore.apps.values(), '', settings.hiddenApps, { aliases: settings.aliases });
        packages = visible.map(a => a.packageName);
        labels = visible.map(a => a.label);
        if (!packages.length) { fail('SIN APPS QUE ORGANIZAR'); return; }

        phase.value = 'thinking';
        error.value = '';
        controller = new AbortController();
        log.push('MTR', 'ORGANIZANDO APPS');

        try
        {
            const raw = await chatJson(mother.apiKey, mother.model.trim() || 'gpt-4o-mini', buildOrganizeMessages(labels, request.value), controller.signal);
            const parsed = parsePlan(raw, Math.min(labels.length, 300));
            if (!parsed.ok) { fail(parsed.error); return; }
            if (isPlanEmpty(parsed.plan)) { fail('MOTHER NO ENCUENTRA QUÉ CAMBIAR. PRUEBA OTRA PETICIÓN.'); return; }

            plan.value = parsed.plan;
            lines.value = describePlan(parsed.plan, labels);
            phase.value = 'preview';
        }
        catch (err)
        {
            console.error(err);
            fail((err as Error).name === 'AbortError' ? 'ANULADO' : describeFetchError(err));
        }
        finally
        {
            controller = null;
        }
    }

    function fail(text: string)
    {
        error.value = text;
        phase.value = 'error';
    }

    /** [APLICAR] */
    function apply()
    {
        if (!plan.value || phase.value !== 'preview') return;
        previous.value = { folders: settings.folders, favorites: settings.favorites };
        const next = applyPlan(previous.value, plan.value, packages);
        settings.folders = next.folders;
        settings.favorites = next.favorites;
        log.push('MTR', 'APPS ORGANIZADAS');
        phase.value = 'applied';
    }

    /** [DESHACER] */
    function undo()
    {
        if (!previous.value) return;
        settings.folders = previous.value.folders;
        settings.favorites = previous.value.favorites;
        previous.value = null;
        phase.value = 'ask';
        plan.value = null;
    }

    function abort() { controller?.abort(); }

    return { open, phase, request, error, plan, lines, canUndo, show, close, run, apply, undo, abort };
});
