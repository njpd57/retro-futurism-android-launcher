import type { Phosphor } from '@/stores/useSettingsStore';
import { MAX_TIMER_MIN } from './actions';
import { parsePhosphor } from '@/utils/commands';

export type SlashCommand =
    | { type: 'timer'; minutes: number }
    | { type: 'note'; text: string }
    | { type: 'theme'; phosphor: Phosphor }
    | { type: 'open'; query: string }
    | { type: 'organize'; request: string }
    | { type: 'sessions' }
    | { type: 'new' }
    | { type: 'clear' }
    | { type: 'help' }
    | { type: 'invalid'; usage: string }
    | { type: 'unknown'; word: string };

export const SLASH_HELP = [
    'ESTADO · INFORME · ORDEN ESPECIAL 937',
    '/TEMP <MINUTOS>',
    '/NOTA <TEXTO>',
    '/TEMA <ÁMBAR|VERDE|BLANCO|AZUL|ROJO>',
    '/ABRIR <APP>',
    '/ORDENAR <PETICIÓN>',
    '/SESIONES · /NUEVA · /BORRAR',
    'TAB RELLENA LA ORDEN. EL RESTO SE LO PREGUNTAS A MOTHER.',
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** `/verb args` typed in the MOTHER chat; null when the text doesn't start with `/` (it goes to the model). */
export function parseSlash(input: string): SlashCommand | null
{
    const text = input.trim();
    if (!text.startsWith('/')) return null;

    const body = text.slice(1).trim();
    const space = body.search(/\s/);
    const word = fold(space < 0 ? body : body.slice(0, space));
    const rest = space < 0 ? '' : body.slice(space).trim();

    switch (word)
    {
        case 'temp':
        case 'temporizador':
        {
            const minutes = /^\d+$/.test(rest) ? Number(rest) : NaN;
            return minutes >= 1 && minutes <= MAX_TIMER_MIN ? { type: 'timer', minutes } : { type: 'invalid', usage: `/TEMP <1-${MAX_TIMER_MIN}>` };
        }
        case 'nota':
            return rest ? { type: 'note', text: rest } : { type: 'invalid', usage: '/NOTA <TEXTO>' };
        case 'tema':
        {
            const phosphor = parsePhosphor(rest);
            return phosphor ? { type: 'theme', phosphor } : { type: 'invalid', usage: '/TEMA <ÁMBAR|VERDE|BLANCO|AZUL|ROJO>' };
        }
        case 'abrir':
            return rest ? { type: 'open', query: rest } : { type: 'invalid', usage: '/ABRIR <APP>' };
        case 'ordenar':
            return rest ? { type: 'organize', request: rest } : { type: 'invalid', usage: '/ORDENAR <PETICIÓN>' };
        case 'sesiones': return { type: 'sessions' };
        case 'nueva': return { type: 'new' };
        case 'borrar': return { type: 'clear' };
        case 'ayuda':
        case '?':
        case '': return { type: 'help' };
        default: return { type: 'unknown', word };
    }
}
