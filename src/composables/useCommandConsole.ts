import { computed, ref, type Ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { PHOSPHORS, useSettingsStore } from '@/stores/useSettingsStore';
import { useWeatherStore } from '@/stores/useWeatherStore';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { searchApps } from '@/utils/appSearch';
import { COMMAND_HELP, formatNumber, parseCommand } from '@/utils/commands';
import { addWidget } from '@/utils/dashboardLayout';
import { appendNoteLine } from '@/utils/notes';
import { weatherText } from '@/utils/weather';

/** The prompt as a command console: `> verb args`. Pure parsing lives in utils/commands. */
export function useCommandConsole(options: {
    query: Ref<string>;
    apps: () => Iterable<InstalledAppInfo>;
    launch: (app: InstalledAppInfo) => void;
})
{
    const settings = useSettingsStore();
    const weather = useWeatherStore();

    const command = computed(() => parseCommand(options.query.value));
    /** Result of the last executed command; only shown while the prompt text is still the one it was run with. */
    const feedback = ref<{ lines: string[]; forQuery: string } | null>(null);

    const openMatch = computed(() =>
    {
        const c = command.value;
        if (c?.type !== 'open' || !c.query) return null;
        return searchApps(options.apps(), c.query, settings.hiddenApps)[0] ?? null;
    });

    const lines = computed<string[]>(() =>
    {
        if (feedback.value && feedback.value.forQuery === options.query.value) return feedback.value.lines;
        const c = command.value;
        if (!c) return [];
        switch (c.type)
        {
            case 'help': return COMMAND_HELP;
            case 'open': return openMatch.value ? [`ABRIR ${openMatch.value.label.toUpperCase()}`] : [c.query ? 'SIN RESULTADOS' : 'ABRIR <APP>'];
            case 'calc': return [c.expr ? (c.result === null ? 'EXPRESIÓN NO VÁLIDA' : `= ${formatNumber(c.result)}`) : 'CALC <EXPR>'];
            case 'theme': return [c.phosphor ? `TEMA ${PHOSPHORS.find(p => p.id === c.phosphor)?.label}` : c.arg ? `TEMA DESCONOCIDO: ${c.arg.toUpperCase()}` : `TEMA: ${PHOSPHORS.map(p => p.label).join(' · ')}`];
            case 'weather': return weatherLines();
            case 'note': return [c.text ? `NOTA: ${c.text.toUpperCase()}` : 'NOTA <TEXTO>'];
            case 'unknown': return [`ORDEN DESCONOCIDA: ${c.word.toUpperCase()}`, 'ESCRIBE > AYUDA'];
        }
    });

    function weatherLines()
    {
        if (!weather.city) return ['SIN CIUDAD: ELÍGELA EN EL WIDGET ALARMA · CLIMA'];
        const f = weather.forecast;
        if (!f) return [weather.failed ? 'SIN ENLACE' : 'CONSULTANDO…'];
        return [`${weather.city.name.toUpperCase()}: ${Math.round(f.temperature)}°C ${weatherText(f.code)}`];
    }

    function saveNote(text: string)
    {
        let item = settings.dashboard.find(i => i.kind === 'notes');
        if (!item)
        {
            settings.dashboard = addWidget(settings.dashboard, 'notes');
            item = settings.dashboard[settings.dashboard.length - 1];
        }
        const stored = useLocalStorage(`widget.notes.${item.id}`, '');
        stored.value = appendNoteLine(stored.value, text);
    }

    /** Runs the command in the prompt. True when the text was a command (handled, even if it failed). */
    function run(): boolean
    {
        const c = command.value;
        if (!c) return false;

        switch (c.type)
        {
            case 'open':
                if (openMatch.value) { options.launch(openMatch.value); options.query.value = ''; }
                break;
            case 'theme':
                if (c.phosphor)
                {
                    settings.phosphor = c.phosphor;
                    options.query.value = '';
                }
                break;
            case 'note':
                if (c.text)
                {
                    saveNote(c.text);
                    options.query.value = '';
                    feedback.value = { lines: ['NOTA GUARDADA'], forQuery: '' };
                }
                break;
            case 'weather':
                weather.refresh(true);
                break;
        }
        return true;
    }

    return { command, lines, run };
}
