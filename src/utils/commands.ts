import type { Phosphor } from '@/stores/useSettingsStore';
import type { SortMode } from './appSearch';

export const COMMAND_PREFIX = '>';

export type Command =
    | { type: 'help' }
    | { type: 'open'; query: string }
    | { type: 'calc'; expr: string; result: number | null }
    | { type: 'theme'; phosphor: Phosphor | null; arg: string }
    | { type: 'weather' }
    | { type: 'note'; text: string }
    | { type: 'sort'; mode: SortMode | null; arg: string }
    | { type: 'list'; mode: 'simple' | 'long' | null; arg: string }
    | { type: 'mother'; request: string }
    | { type: 'unknown'; word: string };

export const COMMAND_HELP = [
    'ABRIR <APP>',
    'CALC <EXPR>',
    'TEMA <ÁMBAR|VERDE|BLANCO|AZUL|ROJO>',
    'CLIMA',
    'NOTA <TEXTO>',
    'ORDEN <ALFA|USO|RECIENTE>',
    'LISTA <SIMPLE|LARGA>',
    'MOTHER <ORDEN PARA TUS APPS>',
    'AYUDA',
];

const THEMES: Record<string, Phosphor> = {
    ambar: 'amber', amber: 'amber',
    verde: 'green', green: 'green',
    blanco: 'white', white: 'white', p4: 'white',
    azul: 'blue', blue: 'blue',
    rojo: 'red', red: 'red',
};

/** `alfa`, `uso`, `reciente`... to a sort mode; null when unknown. */
export function parseSortMode(text: string): SortMode | null
{
    switch (stripAccents(text.trim().toLowerCase()))
    {
        case 'alfa': case 'alfabetico': case 'nombre': case 'az': return 'alpha';
        case 'uso': case 'usadas': case 'mas usadas': return 'usage';
        case 'reciente': case 'recientes': case 'nuevas': case 'instaladas': return 'recent';
        default: return null;
    }
}

export function parseListMode(text: string): 'simple' | 'long' | null
{
    switch (stripAccents(text.trim().toLowerCase()))
    {
        case 'simple': case 'corta': case 'normal': return 'simple';
        case 'larga': case 'largo': case 'long': case 'ls': return 'long';
        default: return null;
    }
}

/** `verde`, `Ámbar`... to a phosphor id; null when unknown. */
export function parsePhosphor(text: string): Phosphor | null
{
    return THEMES[text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()] ?? null;
}

const ALIASES: Record<string, string> = {
    abrir: 'open', open: 'open', a: 'open',
    calc: 'calc', calcular: 'calc', c: 'calc',
    tema: 'theme', paleta: 'theme',
    clima: 'weather', tiempo: 'weather',
    nota: 'note', n: 'note',
    orden: 'sort', ordenar: 'sort',
    lista: 'list',
    mother: 'mother', m: 'mother',
    ayuda: 'help', help: 'help', '?': 'help',
};

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** True when the prompt text is meant as a command and not as an app search. */
export function isCommandInput(input: string)
{
    return input.trimStart().startsWith(COMMAND_PREFIX);
}

/** `> verb args` to a command; null when the text isn't a command (no prefix). */
export function parseCommand(input: string): Command | null
{
    const trimmed = input.trimStart();
    if (!trimmed.startsWith(COMMAND_PREFIX)) return null;

    const body = trimmed.slice(COMMAND_PREFIX.length).trim();
    if (!body) return { type: 'help' };

    const space = body.search(/\s/);
    const word = (space < 0 ? body : body.slice(0, space)).toLowerCase();
    const rest = space < 0 ? '' : body.slice(space).trim();

    switch (ALIASES[stripAccents(word)])
    {
        case 'help': return { type: 'help' };
        case 'open': return { type: 'open', query: rest };
        case 'calc': return { type: 'calc', expr: rest, result: evaluateExpression(rest) };
        case 'theme': return { type: 'theme', phosphor: parsePhosphor(rest), arg: rest };
        case 'weather': return { type: 'weather' };
        case 'note': return { type: 'note', text: rest };
        case 'sort': return { type: 'sort', mode: parseSortMode(rest), arg: rest };
        case 'list': return { type: 'list', mode: parseListMode(rest), arg: rest };
        case 'mother': return { type: 'mother', request: rest };
        default: return { type: 'unknown', word };
    }
}

/**
 * Arithmetic with + - * / % ^ and parentheses (decimal comma allowed). No eval.
 * Null for anything malformed, non-finite or empty.
 */
export function evaluateExpression(expr: string): number | null
{
    const src = expr.replace(/,/g, '.').replace(/\s+/g, '').replace(/[x×]/gi, '*').replace(/÷/g, '/');
    if (!src) return null;

    let pos = 0;
    const peek = () => src[pos];

    function number(): number | null
    {
        const m = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(pos));
        if (!m) return null;
        pos += m[0].length;
        return parseFloat(m[0]);
    }

    function atom(): number | null
    {
        if (peek() === '-') { pos++; const v = power(); return v === null ? null : -v; }
        if (peek() === '+') { pos++; return power(); }
        if (peek() === '(')
        {
            pos++;
            const v = sum();
            if (v === null || peek() !== ')') return null;
            pos++;
            return v;
        }
        return number();
    }

    function power(): number | null
    {
        const base = atom();
        if (base === null) return null;
        if (peek() === '^')
        {
            pos++;
            const exp = power(); // right associative
            return exp === null ? null : Math.pow(base, exp);
        }
        return base;
    }

    function product(): number | null
    {
        let left = power();
        while (left !== null && (peek() === '*' || peek() === '/' || peek() === '%'))
        {
            const op = src[pos++];
            const right = power();
            if (right === null) return null;
            left = op === '*' ? left * right : op === '/' ? left / right : left % right;
        }
        return left;
    }

    function sum(): number | null
    {
        let left = product();
        while (left !== null && (peek() === '+' || peek() === '-'))
        {
            const op = src[pos++];
            const right = product();
            if (right === null) return null;
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }

    const value = sum();
    if (value === null || pos !== src.length || !Number.isFinite(value)) return null;
    return value;
}

/** Trims float noise: 0.1+0.2 -> "0.3", large values keep their digits. */
export function formatNumber(n: number)
{
    return String(parseFloat(n.toPrecision(12)));
}
