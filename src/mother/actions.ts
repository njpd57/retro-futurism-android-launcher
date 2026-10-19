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

/** First of `keys` present in `args`: models sometimes rename an argument. */
function pick(args: Record<string, unknown>, keys: readonly string[]): unknown
{
    for (const k of keys) if (args[k] !== undefined && args[k] !== null) return args[k];
    return undefined;
}

/** A whole number from `5`, `"5"` or `"5 min"`; null otherwise. */
function toInteger(value: unknown): number | null
{
    const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
    return Number.isInteger(n) ? n : null;
}

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

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
        {
            const n = text(pick(args, ['nombre', 'app', 'name']));
            return n ? { ok: true, action: { type: 'open_app', name: n } } : { ok: false, error: 'FALTA EL NOMBRE' };
        }
        case 'temporizador':
        {
            const m = toInteger(pick(args, ['minutos', 'minutes', 'min', 'duracion']));
            return m !== null && m >= 1 && m <= MAX_TIMER_MIN ? { ok: true, action: { type: 'timer', minutes: m } } : { ok: false, error: 'MINUTOS FUERA DE RANGO' };
        }
        case 'nota':
        {
            const t = text(pick(args, ['texto', 'text', 'nota']));
            return t ? { ok: true, action: { type: 'note', text: t.slice(0, MAX_NOTE_CHARS) } } : { ok: false, error: 'FALTA EL TEXTO' };
        }
        case 'paleta':
        {
            const c = text(pick(args, ['color', 'paleta', 'tema']));
            const p = c ? parsePhosphor(c) : null;
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
