export type CommandScope = 'console' | 'mother';

export interface CommandDef
{
    /** typed after the prefix: `abrir` */
    name: string;
    /** shown after the name: `<APP>` */
    args: string;
    hint: string;
    /** what the shortcut chip fills in */
    example: string;
    /** a word that works without prefix, like ESTADO in the MOTHER chat */
    bare?: boolean;
}

export const PREFIX: Record<CommandScope, string> = { console: '>', mother: '/' };

export const COMMANDS: Record<CommandScope, CommandDef[]> = {
    console: [
        { name: 'abrir', args: '<APP>', hint: 'ABRE UNA APP', example: 'abrir ' },
        { name: 'calc', args: '<EXPR>', hint: 'CALCULADORA', example: 'calc 2+2' },
        { name: 'tema', args: '<COLOR>', hint: 'CAMBIA LA PALETA', example: 'tema ' },
        { name: 'orden', args: '<ALFA|USO|RECIENTE>', hint: 'ORDEN DE LA LISTA', example: 'orden uso' },
        { name: 'lista', args: '<SIMPLE|LARGA>', hint: 'VISTA DE LA LISTA', example: 'lista larga' },
        { name: 'clima', args: '', hint: 'TIEMPO ACTUAL', example: 'clima' },
        { name: 'nota', args: '<TEXTO>', hint: 'AÑADE UNA NOTA', example: 'nota ' },
        { name: 'mother', args: '<ORDEN>', hint: 'MOTHER ORGANIZA TUS APPS', example: 'mother ' },
        { name: 'imagenes', args: '', hint: 'VISOR DE IMÁGENES CRT', example: 'imagenes' },
        { name: 'aislamiento', args: '', hint: 'JUEGO DE SUPERVIVENCIA', example: 'aislamiento' },
        { name: 'marines', args: '', hint: 'JUEGO DE ACCIÓN: LV-426', example: 'marines' },
        { name: 'recordar', args: '<HORA> <TEXTO>', hint: 'RECORDATORIO A UNA HORA', example: 'recordar ' },
        { name: 'semana', args: '', hint: 'INFORME DE USO DE LA SEMANA', example: 'semana' },
        { name: 'estasis', args: '', hint: 'VER LA CÁPSULA DE HIPERSUEÑO', example: 'estasis' },
        { name: 'desmagnetizar', args: '', hint: 'SACUDE EL TUBO', example: 'desmagnetizar' },
        { name: 'ayuda', args: '', hint: 'LISTA DE ÓRDENES', example: 'ayuda' },
    ],
    mother: [
        { name: 'estado', args: '', hint: 'BATERÍA, RED Y ALMACÉN', example: 'ESTADO', bare: true },
        { name: 'informe', args: '', hint: 'AGENDA, CLIMA Y ALARMA', example: 'INFORME', bare: true },
        { name: 'temp', args: '<MINUTOS>', hint: 'TEMPORIZADOR', example: 'temp 5' },
        { name: 'nota', args: '<TEXTO>', hint: 'AÑADE UNA NOTA', example: 'nota ' },
        { name: 'recordar', args: '<HORA> <TEXTO>', hint: 'RECORDATORIO A UNA HORA', example: 'recordar ' },
        { name: 'tema', args: '<COLOR>', hint: 'CAMBIA LA PALETA', example: 'tema ' },
        { name: 'abrir', args: '<APP>', hint: 'ABRE UNA APP', example: 'abrir ' },
        { name: 'ordenar', args: '<PETICIÓN>', hint: 'ORGANIZA TUS APPS (USA LA API)', example: 'ordenar ' },
        { name: 'sesiones', args: '', hint: 'CONVERSACIONES GUARDADAS', example: 'sesiones' },
        { name: 'jugar', args: '', hint: 'ABRE AISLAMIENTO', example: 'jugar' },
        { name: 'partida', args: '', hint: 'ESTADO DE TU PARTIDA', example: 'partida' },
        { name: 'pista', args: '', hint: 'QUÉ HACER AHORA EN AISLAMIENTO', example: 'pista' },
        { name: 'nueva', args: '', hint: 'ARCHIVA Y EMPIEZA OTRA', example: 'nueva' },
        { name: 'borrar', args: '', hint: 'BORRA LA CONVERSACIÓN', example: 'borrar' },
        { name: 'ayuda', args: '', hint: 'LISTA DE ÓRDENES', example: 'ayuda' },
    ],
};

/** The chips shown when the input is empty. */
const SHORTCUTS: Record<CommandScope, string[]> = {
    console: ['calc', 'orden', 'lista', 'clima', 'imagenes', 'mother', 'ayuda'],
    mother: ['estado', 'informe', 'temp', 'ordenar', 'sesiones', 'ayuda'],
};

export const COLOR_WORDS = ['ámbar', 'verde', 'blanco', 'azul', 'rojo'];
export const SORT_WORDS = ['alfa', 'uso', 'reciente'];
export const LIST_WORDS = ['simple', 'larga'];
export const TIMER_MINUTES = ['1', '5', '10', '25'];
export const REMIND_EXAMPLES = ['en 20 min ', 'mañana 9:00 ', '18:30 '];
export const ORGANIZE_EXAMPLES = [
    'agrupa por tipo',
    'carpeta de juegos',
    'pon mis favoritas arriba',
    'separa trabajo y ocio',
];

export interface Suggestion
{
    /** what the chip shows */
    label: string;
    /** the whole input after applying it */
    fill: string;
    hint?: string;
}

export interface AssistContext
{
    /** up to a few installed app names matching the text */
    apps?: (query: string) => string[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Splits the input into prefix (if any), the command word and the rest. */
export function splitInput(input: string, scope: CommandScope)
{
    const prefix = PREFIX[scope];
    const trimmed = input.trimStart();
    const hasPrefix = trimmed.startsWith(prefix);
    const body = (hasPrefix ? trimmed.slice(prefix.length) : trimmed).trimStart();
    const space = body.search(/\s/);
    return {
        hasPrefix,
        word: space < 0 ? body : body.slice(0, space),
        hasSpace: space >= 0,
        rest: space < 0 ? '' : body.slice(space).trimStart(),
    };
}

const fillFor = (scope: CommandScope, def: CommandDef) => def.bare ? def.example : `${PREFIX[scope]}${def.example}`;

function argumentSuggestions(scope: CommandScope, name: string, rest: string, ctx: AssistContext): string[]
{
    const q = fold(rest);
    const starts = (words: string[]) => words.filter(w => fold(w).startsWith(q) && fold(w) !== q);
    switch (name)
    {
        case 'tema': return starts(COLOR_WORDS);
        case 'orden': return starts(SORT_WORDS);
        case 'lista': return starts(LIST_WORDS);
        case 'recordar': return rest.trim() ? [] : REMIND_EXAMPLES;
        case 'temp': return TIMER_MINUTES.filter(m => m.startsWith(rest.trim()) && m !== rest.trim());
        case 'abrir': return rest.trim() ? (ctx.apps?.(rest.trim()) ?? []).slice(0, 4) : [];
        case 'ordenar':
        case 'mother': return starts(ORGANIZE_EXAMPLES);
        default: return [];
    }
}

/** Suggestions for what has been typed. Empty input gives the shortcut chips. */
export function suggest(input: string, scope: CommandScope, ctx: AssistContext = {}): Suggestion[]
{
    const defs = COMMANDS[scope];
    if (!input.trim())
    {
        return SHORTCUTS[scope]
            .map(name => defs.find(d => d.name === name))
            .filter((d): d is CommandDef => !!d)
            .map(d => ({ label: fillFor(scope, d).trim().toUpperCase(), fill: fillFor(scope, d), hint: d.hint }));
    }

    const { hasPrefix, word, hasSpace, rest } = splitInput(input, scope);

    // the MOTHER chat accepts bare words (ESTADO, INFORME) without the prefix
    if (!hasPrefix && scope === 'mother')
    {
        return defs.filter(d => d.bare && fold(d.name).startsWith(fold(word)) && fold(d.name) !== fold(word) && !hasSpace)
            .map(d => ({ label: d.example, fill: d.example, hint: d.hint }));
    }
    if (!hasPrefix) return [];

    if (!hasSpace)
    {
        return defs.filter(d => !d.bare && fold(d.name).startsWith(fold(word)) && fold(d.name) !== fold(word) || (!d.bare && fold(d.name) === fold(word) && d.args))
            .map(d => ({ label: `${PREFIX[scope]}${d.name}${d.args ? ` ${d.args}` : ''}`.toUpperCase(), fill: `${PREFIX[scope]}${d.name}${d.args ? ' ' : ''}`, hint: d.hint }));
    }

    const def = defs.find(d => fold(d.name) === fold(word));
    if (!def) return [];
    return argumentSuggestions(scope, def.name, rest, ctx)
        .map(arg => ({ label: arg.toUpperCase(), fill: `${PREFIX[scope]}${def.name} ${arg}`, hint: def.hint }));
}

/** Commands whose name starts with the word being typed (prefix optional, at least two letters, no arguments yet). */
export function matchCommands(input: string, scope: CommandScope, limit = 3): CommandDef[]
{
    const { word, hasSpace } = splitInput(input, scope);
    const w = fold(word);
    if (w.length < 2 || hasSpace) return [];
    return COMMANDS[scope].filter(d => !d.bare && fold(d.name).startsWith(w)).slice(0, limit);
}

/** Grey text to show after the cursor: the rest of the first suggestion when it extends what was typed. */
export function ghostText(input: string, scope: CommandScope, ctx: AssistContext = {}): string
{
    if (!input.trim()) return '';
    const first = suggest(input, scope, ctx)[0];
    if (!first || !fold(first.fill).startsWith(fold(input)) || first.fill.length <= input.length) return '';
    return first.fill.slice(input.length);
}

/** What TAB puts in the input. Pressing it again with the same text moves on to the next suggestion. */
export function complete(input: string, scope: CommandScope, ctx: AssistContext = {}, cycle = 0): string | null
{
    const options = suggest(input, scope, ctx);
    if (!options.length) return null;
    return options[cycle % options.length].fill;
}
