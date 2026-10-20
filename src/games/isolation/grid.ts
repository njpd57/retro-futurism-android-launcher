/**
 * A deck is a grid of cells. A closed door blocks like a wall until it is opened. Lockers, terminals and vents are
 * walkable cells with something against one of their walls.
 */
export type Cell = 'wall' | 'floor' | 'door' | 'locker' | 'exit' | 'terminal' | 'vent';

/** 0 north (up the map), 1 east, 2 south, 3 west. */
export type Dir = 0 | 1 | 2 | 3;

export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export interface Grid
{
    w: number;
    h: number;
    /** row by row, index `y * w + x` */
    cells: readonly Cell[];
}

/** Text painted on the wall on the `dir` side of a cell. */
export interface Sign { x: number; y: number; dir: Dir; text: string }

/** What lies on the floor to pick up besides the power cells. */
export type LootKind = 'scrap' | 'wires' | 'chems' | 'flamer' | 'cat';

export interface Loot { cell: number; kind: LootKind }

export interface ParsedMap
{
    grid: Grid;
    start: number;
    alien: number;
    items: number[];
    loot: Loot[];
    /** doors that start closed (the locked ones too) */
    closed: number[];
    /** doors that start without power: a terminal has to divert it before they open */
    locked: number[];
    /** where the android starts, if the deck has one */
    ash: number | null;
    /** floor cells where a pipe leaks steam now and then */
    steam: number[];
}

const CELLS: Record<string, Cell> = {
    '#': 'wall', '.': 'floor', 'D': 'door', 'd': 'door', 'L': 'locker', 'E': 'exit', '*': 'floor', 'P': 'floor', 'A': 'floor',
    'T': 'terminal', 'V': 'vent', 's': 'floor', 'w': 'floor', 'c': 'floor', 'f': 'floor', 'j': 'floor',
    'H': 'floor', 'X': 'door', '~': 'floor',
};

const LOOT: Record<string, LootKind> = { s: 'scrap', w: 'wires', c: 'chems', f: 'flamer', j: 'cat' };

/**
 * Map drawn as text: `#` wall, `.` floor, `D` closed door, `d` open door, `L` locker, `E` exit, `*` power cell,
 * `T` terminal, `V` vent, `P` player start, `A` alien start, and on the floor `s` scrap, `w` wires, `c` chemicals,
 * `f` flamethrower, `j` the cat. Also `H` the android's start, `X` a door without power and `~` a floor cell with a
 * steam leak. Throws on a malformed map (they are written by hand, the tests catch it).
 */
export function parseMap(rows: readonly string[]): ParsedMap
{
    const h = rows.length;
    const w = rows[0]?.length ?? 0;
    const cells: Cell[] = [];
    const items: number[] = [];
    const loot: Loot[] = [];
    const closed: number[] = [];
    const locked: number[] = [];
    const steam: number[] = [];
    let start = -1;
    let alien = -1;
    let ash: number | null = null;

    rows.forEach((row, y) =>
    {
        if (row.length !== w) throw new Error(`row ${y} has ${row.length} columns, expected ${w}`);
        [...row].forEach((ch, x) =>
        {
            const cell = CELLS[ch];
            if (!cell) throw new Error(`unknown cell '${ch}' at ${x},${y}`);
            const i = y * w + x;
            cells.push(cell);
            if (ch === '*') items.push(i);
            if (ch in LOOT) loot.push({ cell: i, kind: LOOT[ch] });
            if (ch === 'D' || ch === 'X') closed.push(i);
            if (ch === 'X') locked.push(i);
            if (ch === '~') steam.push(i);
            if (ch === 'P') start = i;
            if (ch === 'A') alien = i;
            if (ch === 'H') ash = i;
        });
    });
    if (start < 0 || alien < 0) throw new Error('map needs a P and an A');
    return { grid: { w, h, cells }, start, alien, items, loot, closed, locked, ash, steam };
}

/** Per cell, whether it lies in any of the rectangles `[x0, y0, x1, y1]` (inclusive). */
export function rectMask(g: Grid, rects: readonly (readonly [number, number, number, number])[]): boolean[]
{
    return g.cells.map((_, i) =>
    {
        const x = i % g.w;
        const y = Math.floor(i / g.w);
        return rects.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    });
}

export const cellX = (g: Grid, i: number) => i % g.w;
export const cellY = (g: Grid, i: number) => Math.floor(i / g.w);

/** The neighbouring cell index, or -1 off the map. */
export function neighbour(g: Grid, i: number, dir: Dir): number
{
    const x = cellX(g, i) + DX[dir];
    const y = cellY(g, i) + DY[dir];
    return x < 0 || y < 0 || x >= g.w || y >= g.h ? -1 : y * g.w + x;
}

export const cellAt = (g: Grid, i: number): Cell => i < 0 ? 'wall' : g.cells[i];

/** Walls, closed doors and the outside block movement and sight. */
export function blocks(g: Grid, closed: readonly number[], i: number)
{
    const c = cellAt(g, i);
    return c === 'wall' || (c === 'door' && closed.includes(i));
}

/** The wall a locker, terminal or vent stands against: the first solid side, north first. */
export function mountWall(g: Grid, closed: readonly number[], i: number): Dir | null
{
    for (let d = 0; d < 4; d++) if (blocks(g, closed, neighbour(g, i, d as Dir))) return d as Dir;
    return null;
}

export function turn(dir: Dir, by: number): Dir
{
    return (((dir + by) % 4) + 4) % 4 as Dir;
}

/** Steps from `from` to every cell through `passable` cells; -1 where unreachable. */
export function distances(g: Grid, from: number, passable: (i: number) => boolean): Int32Array
{
    const dist = new Int32Array(g.w * g.h).fill(-1);
    dist[from] = 0;
    const queue = [from];
    for (let head = 0; head < queue.length; head++)
    {
        const c = queue[head];
        for (let d = 0; d < 4; d++)
        {
            const n = neighbour(g, c, d as Dir);
            if (n < 0 || dist[n] >= 0 || !passable(n)) continue;
            dist[n] = dist[c] + 1;
            queue.push(n);
        }
    }
    return dist;
}

/** The next cell on a shortest path from `from` to `to`; `from` itself when already there, -1 when unreachable. */
export function nextStep(g: Grid, from: number, to: number, passable: (i: number) => boolean): number
{
    if (from === to) return from;
    const dist = distances(g, to, passable);
    let best = -1;
    for (let d = 0; d < 4; d++)
    {
        const n = neighbour(g, from, d as Dir);
        if (n >= 0 && dist[n] >= 0 && (best < 0 || dist[n] < dist[best])) best = n;
    }
    return best;
}

/**
 * How far a sound carries from `from` to `to`, in cells: it goes round walls, and each closed door it crosses
 * counts as `doorCost` cells. Infinity when walled off.
 */
export function soundDistance(g: Grid, closed: readonly number[], from: number, to: number, doorCost: number): number
{
    const n = g.w * g.h;
    const dist = new Float64Array(n).fill(Infinity);
    const done = new Uint8Array(n);
    dist[from] = 0;
    // the decks are small (a few hundred cells): a linear scan is enough
    for (;;)
    {
        let c = -1;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (c < 0 || dist[i] < dist[c])) c = i;
        if (c < 0) return Infinity;
        if (c === to) return dist[c];
        done[c] = 1;
        for (let d = 0; d < 4; d++)
        {
            const nb = neighbour(g, c, d as Dir);
            if (nb < 0 || cellAt(g, nb) === 'wall') continue;
            const cost = closed.includes(nb) ? 1 + doorCost : 1;
            if (dist[c] + cost < dist[nb]) dist[nb] = dist[c] + cost;
        }
    }
}

/** True when `a` and `b` share a row or column with nothing blocking in between, up to `range` cells. */
export function lineOfSight(g: Grid, closed: readonly number[], a: number, b: number, range: number): boolean
{
    const ax = cellX(g, a), ay = cellY(g, a), bx = cellX(g, b), by = cellY(g, b);
    if (ax !== bx && ay !== by) return false;
    const span = Math.abs(ax - bx) + Math.abs(ay - by);
    if (span > range) return false;
    const sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
    for (let k = 1; k < span; k++)
        if (blocks(g, closed, (ay + sy * k) * g.w + ax + sx * k)) return false;
    return true;
}

/** Straight-line distance between two cells. */
export function cellDistance(g: Grid, a: number, b: number)
{
    return Math.hypot(cellX(g, a) - cellX(g, b), cellY(g, a) - cellY(g, b));
}
