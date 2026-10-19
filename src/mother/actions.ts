import type { Phosphor } from '@/stores/useSettingsStore';
import { parsePhosphor } from '@/utils/commands';
import type { ToolCallDelta } from './sse';

export type MotherAction =
    | { type: 'open_app'; name: string }
    | { type: 'timer'; minutes: number }
    | { type: 'note'; text: string }
    | { type: 'theme'; phosphor: Phosphor };

export const MAX_TIMER_MIN = 180;
export const MAX_NOTE_CHARS = 200;

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[]) =>
    ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });

/** Tools offered to the model. Nothing runs without the user's confirmation. */
export const MOTHER_TOOLS = [
    fn('abrir_app', 'Abre una app instalada en el teléfono.', { nombre: { type: 'string', description: 'Nombre de la app' } }, ['nombre']),
    fn('temporizador', 'Pone un temporizador.', { minutos: { type: 'integer', description: `Minutos, de 1 a ${MAX_TIMER_MIN}` } }, ['minutos']),
    fn('nota', 'Añade una línea a las notas.', { texto: { type: 'string' } }, ['texto']),
    fn('paleta', 'Cambia el color de la pantalla.', { color: { type: 'string', enum: ['ámbar', 'verde', 'blanco', 'azul', 'rojo'] } }, ['color']),
];

export interface ToolCallAcc
{
    id: string;
    name: string;
    args: string;
}

/** Merges streamed tool-call fragments into complete calls, by `index`. */
export function accumulateToolCalls(acc: readonly ToolCallAcc[], deltas: readonly ToolCallDelta[]): ToolCallAcc[]
{
    const next = acc.map(a => ({ ...a }));
    for (const d of deltas)
    {
        const cur = next[d.index] ?? (next[d.index] = { id: '', name: '', args: '' });
        if (d.id) cur.id = d.id;
        if (d.name) cur.name += d.name;
        if (d.args) cur.args += d.args;
    }
    return next.filter(Boolean);
}

export type ParsedAction = { ok: true; action: MotherAction } | { ok: false; error: string };

/** Validates what the model asked for. Anything off is rejected, never guessed. */
export function parseAction(name: string, argsJson: string): ParsedAction
{
    let args: Record<string, unknown>;
    try { args = JSON.parse(argsJson || '{}') as Record<string, unknown>; }
    catch { return { ok: false, error: 'ARGUMENTOS NO VÁLIDOS' }; }
    if (!args || typeof args !== 'object') return { ok: false, error: 'ARGUMENTOS NO VÁLIDOS' };

    switch (name)
    {
        case 'abrir_app':
            return typeof args.nombre === 'string' && args.nombre.trim() ? { ok: true, action: { type: 'open_app', name: args.nombre.trim() } } : { ok: false, error: 'FALTA EL NOMBRE' };
        case 'temporizador':
        {
            const m = Number(args.minutos);
            return Number.isInteger(m) && m >= 1 && m <= MAX_TIMER_MIN ? { ok: true, action: { type: 'timer', minutes: m } } : { ok: false, error: 'MINUTOS FUERA DE RANGO' };
        }
        case 'nota':
            return typeof args.texto === 'string' && args.texto.trim() ? { ok: true, action: { type: 'note', text: args.texto.trim().slice(0, MAX_NOTE_CHARS) } } : { ok: false, error: 'FALTA EL TEXTO' };
        case 'paleta':
        {
            const p = typeof args.color === 'string' ? parsePhosphor(args.color) : null;
            return p ? { ok: true, action: { type: 'theme', phosphor: p } } : { ok: false, error: 'COLOR DESCONOCIDO' };
        }
        default:
            return { ok: false, error: `HERRAMIENTA DESCONOCIDA: ${name.toUpperCase()}` };
    }
}

const PHOSPHOR_LABEL: Record<Phosphor, string> = { amber: 'ÁMBAR', green: 'VERDE', white: 'BLANCO P4', blue: 'AZUL', red: 'ROJO' };

/** One line for the confirmation prompt. */
export function describeAction(a: MotherAction): string
{
    switch (a.type)
    {
        case 'open_app': return `ABRIR ${a.name.toUpperCase()}`;
        case 'timer': return `TEMPORIZADOR ${a.minutes} MIN`;
        case 'note': return `NOTA: ${a.text.toUpperCase()}`;
        case 'theme': return `PALETA ${PHOSPHOR_LABEL[a.phosphor]}`;
    }
}
