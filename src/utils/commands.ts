import type { Phosphor } from '@/stores/useSettingsStore';

export const COMMAND_PREFIX = '>';

export type Command =
    | { type: 'help' }
    | { type: 'open'; query: string }
    | { type: 'calc'; expr: string; result: number | null }
    | { type: 'theme'; phosphor: Phosphor | null; arg: string }
    | { type: 'weather' }
    | { type: 'note'; text: string }
    | { type: 'unknown'; word: string };

export const COMMAND_HELP = [
    'ABRIR <APP>',
    'CALC <EXPR>',
    'TEMA <ÁMBAR|VERDE|BLANCO|AZUL|ROJO>',
    'CLIMA',
    'NOTA <TEXTO>',
    'AYUDA',
];

const THEMES: Record<string, Phosphor> = {
    ambar: 'amber', amber: 'amber',
    verde: 'green', green: 'green',
    blanco: 'white', white: 'white', p4: 'white',
    azul: 'blue', blue: 'blue',
    rojo: 'red', red: 'red',
};

const ALIASES: Record<string, string> = {
    abrir: 'open', open: 'open', a: 'open',
    calc: 'calc', calcular: 'calc', c: 'calc',
    tema: 'theme', paleta: 'theme',
    clima: 'weather', tiempo: 'weather',
    nota: 'note', n: 'note',
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
        case 'theme': return { type: 'theme', phosphor: THEMES[stripAccents(rest.toLowerCase())] ?? null, arg: rest };
        case 'weather': return { type: 'weather' };
        case 'note': return { type: 'note', text: rest };
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
