import type { Cell, Dir, Grid, Sign } from '../isolation/grid';

/** What lies on the floor to pick up: supplies, grenades, and the crates the extra weapons come in. */
export type PickupKind = 'ammo' | 'medkit' | 'grenade' | 'shotgun' | 'smartgun' | 'flamer';

/** The map symbol of each kind of pickup. */
const PICKUP_CHARS: Record<string, PickupKind> = { a: 'ammo', '+': 'medkit', g: 'grenade', S: 'shotgun', M: 'smartgun', F: 'flamer' };

export interface PickupDef { cell: number; kind: PickupKind }

export interface ParsedArena
{
    grid: Grid;
    start: number;
    /** the grilles the creatures come out of */
    spawns: number[];
    pickups: PickupDef[];
    /** doors that start closed */
    closed: number[];
}

const CELLS: Record<string, Cell> = {
    '#': 'wall', '.': 'floor', 'D': 'door', 'd': 'door', 'P': 'floor', 'V': 'vent',
    'a': 'floor', '+': 'floor', 'g': 'floor', 'S': 'floor', 'M': 'floor', 'F': 'floor',
};

/**
 * Map drawn as text: `#` wall, `.` floor, `D` closed door, `d` open door, `V` spawn grille, `P` player start,
 * `a` ammunition, `+` medical kit, `g` grenades, and the weapon crates `S` shotgun, `M` smartgun, `F` flamethrower.
 * Throws on a malformed map (they are written by hand, the tests catch it).
 */
export function parseArena(rows: readonly string[]): ParsedArena
{
    const h = rows.length;
    const w = rows[0]?.length ?? 0;
    const cells: Cell[] = [];
    const spawns: number[] = [];
    const pickups: PickupDef[] = [];
    const closed: number[] = [];
    let start = -1;

    rows.forEach((row, y) =>
    {
        if (row.length !== w) throw new Error(`row ${y} has ${row.length} columns, expected ${w}`);
        [...row].forEach((ch, x) =>
        {
            const cell = CELLS[ch];
            if (!cell) throw new Error(`unknown cell '${ch}' at ${x},${y}`);
            const i = y * w + x;
            cells.push(cell);
            if (ch === 'V') spawns.push(i);
            if (PICKUP_CHARS[ch]) pickups.push({ cell: i, kind: PICKUP_CHARS[ch] });
            if (ch === 'D') closed.push(i);
            if (ch === 'P') start = i;
        });
    });
    if (start < 0) throw new Error('map needs a P');
    if (!spawns.length) throw new Error('map needs at least one V');
    return { grid: { w, h, cells }, start, spawns, pickups, closed };
}

export interface ArenaDef
{
    id: string;
    title: string;
    map: readonly string[];
    startDir: Dir;
    signs: readonly Sign[];
    /** what the radio says when the arena is entered */
    briefing: readonly string[];
    /** rectangles `[x0, y0, x1, y1]` without light: only what the shoulder lamp reaches shows */
    dark?: readonly (readonly [number, number, number, number])[];
}

/** First arena: the operations block of the colony. Four rooms with grilles, two halls, two lobbies and a central hall. */
export const ARENA_OPERATIONS: ArenaDef = {
    id: 'operaciones',
    title: 'OPERACIONES',
    map: [
        '##########################',
        '#V....#.....a...g..#....V#',
        '#..+..d............d.....#',
        '#.....######..######.....#',
        '#...S.##.+........##.....#',
        '###.####..........####.###',
        '#.....##..#....#..##.....#',
        '#..a..d.....P......d..a..#',
        '#.....##..#....#..##.....#',
        '###.####..........####.###',
        '#...F.##........+.##.M...#',
        '#.....######..######.....#',
        '#.....d............d..+..#',
        '#V....#..g...a.....#....V#',
        '##########################',
    ],
    startDir: 0,
    signs: [
        { x: 14, y: 4, dir: 0, text: 'OPERACIONES' },
        { x: 1, y: 7, dir: 3, text: 'ALA OESTE' },
        { x: 24, y: 7, dir: 1, text: 'ALA ESTE' },
        { x: 9, y: 1, dir: 0, text: 'ENLACE N' },
        { x: 16, y: 13, dir: 2, text: 'ENLACE S' },
        { x: 3, y: 1, dir: 0, text: 'DORMITORIOS' },
        { x: 22, y: 13, dir: 2, text: 'ALMACÉN' },
    ],
    briefing: [
        'AQUÍ MANDO.',
        'LA COLONIA ESTÁ INFESTADA.',
        'AGUANTEN EN OPERACIONES.',
        'VEGA Y HOLT LES CUBREN.',
        'HAY ARMAS EN LAS ALAS.',
    ],
};

/**
 * Second arena: the vehicle hangar. One big hall with pillars and two closets behind doors, four grilles in the corners:
 * nothing to hold, so the turrets earn their keep.
 */
export const ARENA_HANGAR: ArenaDef = {
    id: 'hangar',
    title: 'HANGAR',
    map: [
        '##############################',
        '#V..........................V#',
        '#..##....##........##....##..#',
        '#..##..a.##...g....##....##..#',
        '#............................#',
        '#.....#####..........#####...#',
        '#.....#.S.d..........d.M.#...#',
        '#.....#####....P.....#####...#',
        '#............................#',
        '#..##....##........##....##..#',
        '#..##.+..##..a.....##..+.##..#',
        '#............................#',
        '#V..F..................g....V#',
        '##############################',
    ],
    startDir: 0,
    signs: [
        { x: 14, y: 1, dir: 0, text: 'HANGAR 2' },
        { x: 1, y: 4, dir: 3, text: 'ALA OESTE' },
        { x: 28, y: 8, dir: 1, text: 'ALA ESTE' },
        { x: 15, y: 12, dir: 2, text: 'ESCLUSA' },
        { x: 8, y: 6, dir: 2, text: 'ARMERÍA' },
    ],
    briefing: [
        'AQUÍ MANDO.',
        'EL HANGAR ESTÁ ABIERTO POR TODOS LADOS.',
        'LAS TORRETAS LES DARÁN TIEMPO.',
        'LAS ARMAS ESTÁN EN LAS ARMERÍAS.',
    ],
};

/**
 * Third arena: the service conduits. A hub with two sealed wings and a deposit to the south, each with its grille
 * behind a door: weld them and the creatures have to gnaw through.
 */
export const ARENA_CONDUITS: ArenaDef = {
    id: 'conductos',
    title: 'CONDUCTOS',
    map: [
        '##########################',
        '#V...#..............#...V#',
        '#.S..#...a....g.....#.M..#',
        '#....d......P.......d....#',
        '#.+..#..............#..+.#',
        '######..............######',
        '#........................#',
        '#.+...##........##...a...#',
        '#.F.....................g#',
        '############d#############',
        '##########..V...##########',
        '##########......##########',
        '##########################',
    ],
    startDir: 0,
    signs: [
        { x: 12, y: 1, dir: 0, text: 'CONDUCTOS' },
        { x: 1, y: 6, dir: 3, text: 'GALERÍA' },
        { x: 12, y: 11, dir: 2, text: 'DEPÓSITO' },
        { x: 1, y: 3, dir: 3, text: 'ALA OESTE' },
        { x: 24, y: 3, dir: 1, text: 'ALA ESTE' },
    ],
    briefing: [
        'AQUÍ MANDO.',
        'LAS REJILLAS ESTÁN TRAS LAS PUERTAS.',
        'SUELDEN Y TENDRÁN TIEMPO.',
        'NO SE ENCIERREN CON ELLOS.',
    ],
};

/**
 * Fourth arena: the nest. A lit hub with a cavern on each side, both dark; the grilles are in the caverns' corners.
 * The shoulder lamp lights only a few cells around the player.
 */
export const ARENA_NEST: ArenaDef = {
    id: 'nido',
    title: 'NIDO',
    map: [
        '############################',
        '#V.......############.....V#',
        '#........#..........#.+....#',
        '#........#....g.....#......#',
        '#...#.......a.....+....#...#',
        '#........#..........#......#',
        '#........#..........#...M..#',
        '#.#...#..#..#.P..#..##...#.#',
        '#..S.....#..........#......#',
        '#........#..........#......#',
        '#...#......+....a......#...#',
        '#........#..........#......#',
        '#.F....a.#..........#......#',
        '#V.......############.....V#',
        '############################',
    ],
    startDir: 0,
    dark: [[1, 1, 8, 13], [21, 1, 26, 13]],
    signs: [
        { x: 14, y: 2, dir: 0, text: 'NIDO' },
        { x: 1, y: 6, dir: 3, text: 'CAVERNA O' },
        { x: 26, y: 8, dir: 1, text: 'CAVERNA E' },
    ],
    briefing: [
        'AQUÍ MANDO.',
        'LAS CAVERNAS ESTÁN A OSCURAS.',
        'LA LÁMPARA ALCANZA POCO: NO SE ADENTREN SOLOS.',
        'LA REINA ESTÁ ABAJO.',
    ],
};

export const ARENAS: Record<string, ArenaDef> = {
    [ARENA_OPERATIONS.id]: ARENA_OPERATIONS,
    [ARENA_HANGAR.id]: ARENA_HANGAR,
    [ARENA_CONDUITS.id]: ARENA_CONDUITS,
    [ARENA_NEST.id]: ARENA_NEST,
};

/** The order the title screen cycles through them. */
export const ARENA_ORDER: readonly string[] = [ARENA_OPERATIONS.id, ARENA_HANGAR.id, ARENA_CONDUITS.id, ARENA_NEST.id];
