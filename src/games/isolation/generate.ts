import type { DeckDef } from './decks';
import { seeded, type Rng } from './rng';
import type { Dir } from './grid';

/**
 * Decks for the endless mode, made from a seed and a level. The same pair always gives the same deck, so a save only
 * keeps the id (`inf:<seed>:<level>`). A deck is a maze with a few loops and rooms; every cell, terminal and the
 * exit are reachable from the start, with no door that needs power.
 */

export const SEED_MAX = 99999;

export const generatedId = (seed: number, level: number) => `inf:${seed}:${level}`;

export function parseGeneratedId(id: string): { seed: number; level: number } | null
{
    const m = /^inf:(\d{1,5}):(\d{1,3})$/.exec(id);
    if (!m) return null;
    const seed = Number(m[1]);
    const level = Number(m[2]);
    return seed <= SEED_MAX && level >= 1 ? { seed, level } : null;
}

/** Size of the deck at a level: it grows a little at first. */
export const sizeFor = (level: number) => ({ w: 15 + 2 * Math.min(level - 1, 4), h: 11 + 2 * Math.min(level - 1, 3) });

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

type Rect = [number, number, number, number];

export function generateDeck(seed: number, level: number): DeckDef
{
    const rng = seeded((seed * 2654435761 + level * 40503) >>> 0);
    const { w, h } = sizeFor(level);
    const g: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('#'));
    const at = (x: number, y: number) => g[y][x];
    const inside = (x: number, y: number) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
    const open = (x: number, y: number) => inside(x, y) && at(x, y) !== '#';
    const shuffle = <T>(list: T[]): T[] =>
    {
        for (let i = list.length - 1; i > 0; i--)
        {
            const j = Math.floor(rng() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    };
    const openNeighbours = (x: number, y: number) => DIRS.filter(([dx, dy]) => open(x + dx, y + dy)).length;
    const wallSide = (x: number, y: number): Dir | null =>
    {
        for (let d = 0; d < 4; d++) if (!open(x + DIRS[d][0], y + DIRS[d][1])) return d as Dir;
        return null;
    };

    // the maze: a depth-first walk over the odd lattice
    const stack: [number, number][] = [[1, 1]];
    g[1][1] = '.';
    while (stack.length)
    {
        const [x, y] = stack[stack.length - 1];
        const next = shuffle([...DIRS]).find(([dx, dy]) => inside(x + dx * 2, y + dy * 2) && at(x + dx * 2, y + dy * 2) === '#');
        if (!next) { stack.pop(); continue; }
        g[y + next[1]][x + next[0]] = '.';
        g[y + next[1] * 2][x + next[0] * 2] = '.';
        stack.push([x + next[0] * 2, y + next[1] * 2]);
    }

    // loops: knock through most dead ends, and a few walls at random
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++)
        {
            if (at(x, y) === '#' || openNeighbours(x, y) !== 1 || rng() > 0.6) continue;
            const walls = DIRS.filter(([dx, dy]) => inside(x + dx * 2, y + dy * 2) && !open(x + dx, y + dy) && open(x + dx * 2, y + dy * 2));
            if (walls.length) { const [dx, dy] = walls[Math.floor(rng() * walls.length)]; g[y + dy][x + dx] = '.'; }
        }
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++)
            if (at(x, y) === '#' && (x + y) % 2 === 1 && rng() < 0.05 && openNeighbours(x, y) === 2 && ((open(x - 1, y) && open(x + 1, y)) || (open(x, y - 1) && open(x, y + 1)))) g[y][x] = '.';

    // rooms: 3x3 openings around lattice cells
    const rooms = Math.min(4, 1 + Math.floor(level / 2));
    for (let r = 0; r < rooms; r++)
    {
        // centred on a lattice cell (odd coordinates) that leaves the room inside the walls
        const x = 3 + 2 * Math.floor(rng() * ((w - 5) / 2));
        const y = 3 + 2 * Math.floor(rng() * ((h - 5) / 2));
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inside(xx, yy) && at(xx, yy) === '#') g[yy][xx] = '.';
    }

    // distances from the start, over everything open
    const dist = new Map<number, number>();
    const key = (x: number, y: number) => y * w + x;
    const queue: [number, number][] = [[1, 1]];
    dist.set(key(1, 1), 0);
    for (let head = 0; head < queue.length; head++)
    {
        const [x, y] = queue[head];
        for (const [dx, dy] of DIRS)
            if (open(x + dx, y + dy) && !dist.has(key(x + dx, y + dy)))
            {
                dist.set(key(x + dx, y + dy), dist.get(key(x, y))! + 1);
                queue.push([x + dx, y + dy]);
            }
    }
    const far = Math.max(...dist.values());
    const free = () => queue.filter(([x, y]) => at(x, y) === '.');
    const span = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

    const take = (pool: [number, number][], ch: string, count: number, apart: number, placed: [number, number][] = []): [number, number][] =>
    {
        const done: [number, number][] = [];
        for (const p of shuffle([...pool]))
        {
            if (done.length >= count) break;
            if (at(p[0], p[1]) !== '.' || [...placed, ...done].some(q => span(p, q) < apart)) continue;
            g[p[1]][p[0]] = ch;
            done.push(p);
        }
        return done;
    };

    g[1][1] = 'P';
    // the exit at the far end
    const exit = free().reduce((best, p) => dist.get(key(p[0], p[1]))! > dist.get(key(best[0], best[1]))! ? p : best);
    g[exit[1]][exit[0]] = 'E';
    const fromStart = (min: number) => free().filter(p => dist.get(key(p[0], p[1]))! >= min);
    const cells = take(fromStart(Math.floor(far * 0.35)), '*', 3, 6, [exit]);
    // short decks can lack room for three spread cells: relax until they fit
    for (let apart = 4; cells.length < 3 && apart >= 1; apart--) cells.push(...take(fromStart(4), '*', 3 - cells.length, apart, [exit, ...cells]));
    take(fromStart(Math.floor(far * 0.4)), 'A', 1, 0, [exit, ...cells]);

    const mounted = () => free().filter(p => wallSide(p[0], p[1]) !== null && span(p, [1, 1]) > 2);
    take(mounted(), 'T', 2, 7);
    take(mounted(), 'L', 3 + Math.floor(level / 2), 3);
    take(mounted(), 'V', level >= 4 ? 4 : 3, 6);

    // doors across straight corridors
    const straight = free().filter(([x, y]) => span([x, y], [1, 1]) > 3 && ((open(x - 1, y) && open(x + 1, y) && !open(x, y - 1) && !open(x, y + 1)) || (open(x, y - 1) && open(x, y + 1) && !open(x - 1, y) && !open(x + 1, y))));
    take(straight, 'D', 3, 4);
    take(straight, 'd', 2, 4);

    // loot, and the flamethrower now and then
    const scatter = () => free().filter(p => span(p, [1, 1]) > 1);
    take(scatter(), 's', 2 + (level < 4 ? 1 : 0), 3);
    take(scatter(), 'w', 2, 3);
    take(scatter(), 'c', 2, 3);
    if (level % 4 === 1) take(scatter(), 'f', 1, 0);

    // hazards, as the levels go
    if (level >= 3) take(straight, '~', 1 + Math.floor((level - 3) / 2), 4);
    if (level >= 4) take(fromStart(Math.floor(far * 0.3)), 'H', 1, 0);

    const dark: Rect[] = [];
    let blackout: DeckDef['blackout'];
    if (level >= 2)
    {
        // a block of the deck without power, never the start
        const bw = Math.floor(w * 0.45);
        const bh = Math.floor(h * 0.5);
        const x0 = Math.min(w - bw, 4 + Math.floor(rng() * (w - bw - 3)));
        const y0 = Math.min(h - bh, 3 + Math.floor(rng() * (h - bh - 2)));
        const rect: Rect = [Math.max(x0, 3), Math.max(y0, 3), Math.min(w - 1, x0 + bw), Math.min(h - 1, y0 + bh)];
        if (level >= 5) blackout = { rects: [rect], periodMs: 28000, offMs: 8000 + Math.min(8000, level * 500) };
        else dark.push(rect);
    }

    // signs on the walls beside open cells
    const signs: DeckDef['signs'][number][] = [];
    const signCells = shuffle(free().concat(queue.filter(([x, y]) => at(x, y) === 'D' || at(x, y) === 'd'))).filter(p => wallSide(p[0], p[1]) !== null).slice(0, 3);
    signCells.forEach((p, i) => signs.push({ x: p[0], y: p[1], dir: wallSide(p[0], p[1])!, text: `S${level}-0${i + 1}` }));

    // face down the first corridor
    const startDir = DIRS.findIndex(([dx, dy]) => open(1 + dx, 1 + dy)) as Dir;

    const rows = g.map(r => r.join(''));
    return {
        id: generatedId(seed, level),
        title: `SECTOR ${level}`,
        map: rows,
        startDir: startDir < 0 ? 1 : startDir,
        signs,
        dark: dark.length ? dark : undefined,
        blackout,
        terminals: [],
        briefing: [
            `SECTOR ${level} · SEMILLA ${String(seed).padStart(5, '0')}`,
            'RECUPERE 3 CÉLULAS Y LLEGUE A LA LANZADERA.',
            ...(level >= 2 ? ['HAY ZONAS SIN ENERGÍA.'] : []),
            ...(level >= 3 ? ['FUGAS DE VAPOR EN LOS CONDUCTOS.'] : []),
            ...(level >= 4 ? ['ASH PATRULLA EL SECTOR.'] : []),
        ],
    };
}

/** A fresh seed for a new endless run. */
export const newSeed = (rng: Rng = Math.random) => Math.floor(rng() * (SEED_MAX + 1));
