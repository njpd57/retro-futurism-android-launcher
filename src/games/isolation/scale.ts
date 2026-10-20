import type { DeckDef } from './decks';
import { cellAt, mountWall, neighbour, parseMap, type Dir, type ParsedMap } from './grid';

/**
 * Decks are written (and generated) on a small grid and scaled 2x2 for free movement: every cell becomes a block of
 * four, so a one-cell corridor is two cells wide and a body of radius 0.22 moves in it without sticking.
 *
 * - Walls, floor and the exit fill the whole block; steam too (a leak two cells deep).
 * - Things that stand on the floor (power cells, loot, the starts) take the bottom-left cell.
 * - Lockers, terminals and vents take the cell of the block that touches their mount wall.
 * - A door is one cell deep and spans the corridor: two cells across, so it leaves no gap.
 */

/** Cells per old cell, on each side. */
export const SCALE = 2;

const FLOOR_THINGS = new Set(['*', 'P', 'A', 'H', 's', 'w', 'c', 'f', 'j']);
const MOUNTED = new Set(['L', 'T', 'V']);
const DOORS = new Set(['D', 'd', 'X']);

/** Whether a door at (`x`, `y`) closes a corridor that runs east-west (walls north and south) rather than north-south. */
function runsEastWest(m: ParsedMap, x: number, y: number): boolean
{
    const g = m.grid;
    const i = y * g.w + x;
    const wall = (d: Dir) => cellAt(g, neighbour(g, i, d)) === 'wall';
    return !(wall(1) && wall(3) && !(wall(0) && wall(2)));
}

/**
 * The lane of the block a door takes (0 first, 1 second). Normally the first; but a locker, terminal or vent that has
 * no wall to stand against, only this door, needs the door in the lane that touches it.
 */
function doorLane(rows: readonly string[], m: ParsedMap, x: number, y: number, eastWest: boolean): 0 | 1
{
    // the neighbours along the corridor: east / west, or south / north
    const [after, before] = eastWest ? [[x + 1, y], [x - 1, y]] : [[x, y + 1], [x, y - 1]];
    const needs = ([nx, ny]: number[]) =>
        MOUNTED.has(rows[ny]?.[nx] ?? '') && mountWall(m.grid, [], ny * m.grid.w + nx) === null;
    return needs(after) && !needs(before) ? 1 : 0;
}

/** The cell of the block on the `dir` side, the first of the two when the side has two. */
const sideCell = (x: number, y: number, dir: Dir): [number, number] =>
    [x * SCALE + (dir === 1 ? 1 : 0), y * SCALE + (dir === 2 ? 1 : 0)];

/** Where the thing drawn at (`x`, `y`) on the small grid ends up on the scaled one. */
export function scaledCell(rows: readonly string[], x: number, y: number): [number, number]
{
    const ch = rows[y][x];
    if (MOUNTED.has(ch))
    {
        const m = parseMap(rows);
        // a door is one cell deep, so only a real wall can back the thing; a lone closed door is the fallback
        const i = y * m.grid.w + x;
        const dir = mountWall(m.grid, [], i) ?? mountWall(m.grid, m.closed, i);
        return dir === null ? [x * SCALE, y * SCALE] : sideCell(x, y, dir);
    }
    if (FLOOR_THINGS.has(ch)) return [x * SCALE, y * SCALE + 1];
    if (DOORS.has(ch))
    {
        const m = parseMap(rows);
        const eastWest = runsEastWest(m, x, y);
        const lane = doorLane(rows, m, x, y, eastWest);
        return eastWest ? [x * SCALE + lane, y * SCALE] : [x * SCALE, y * SCALE + lane];
    }
    return [x * SCALE, y * SCALE];
}

/** The cell where a sign on the `dir` wall of (`x`, `y`) goes on the scaled grid. */
export const scaledSignCell = (x: number, y: number, dir: Dir) => sideCell(x, y, dir);

/** A map drawn as text, scaled 2x2 as described above. */
export function scaleMap(rows: readonly string[]): string[]
{
    const m = parseMap(rows);
    const out: string[][] = Array.from({ length: rows.length * SCALE }, () => Array<string>(rows[0].length * SCALE).fill('.'));
    rows.forEach((row, y) =>
    {
        [...row].forEach((ch, x) =>
        {
            const block: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
            const put = (dx: number, dy: number, c: string) => { out[y * SCALE + dy][x * SCALE + dx] = c; };
            if (ch === '#' || ch === 'E' || ch === '~') block.forEach(([dx, dy]) => put(dx, dy, ch));
            else if (DOORS.has(ch))
            {
                // two cells across the corridor, in the first lane along it
                const eastWest = runsEastWest(m, x, y);
                const lane = doorLane(rows, m, x, y, eastWest);
                if (eastWest) { put(lane, 0, ch); put(lane, 1, ch); }
                else { put(0, lane, ch); put(1, lane, ch); }
            }
            else if (ch !== '.')
            {
                const [sx, sy] = scaledCell(rows, x, y);
                out[sy][sx] = ch;
            }
        });
    });
    return out.map(r => r.join(''));
}

const scaleRect = ([x0, y0, x1, y1]: readonly [number, number, number, number]): [number, number, number, number] =>
    [x0 * SCALE, y0 * SCALE, x1 * SCALE + SCALE - 1, y1 * SCALE + SCALE - 1];

/**
 * A deck on the scaled grid: the map, and every coordinate that points into it (signs, terminals and the door a
 * terminal energises, the dark and blackout zones). A door spans two cells: `opens` points at the first.
 */
export function scaleDeck(deck: DeckDef): DeckDef
{
    const rows = deck.map;
    return {
        ...deck,
        map: scaleMap(rows),
        signs: deck.signs.map(s =>
        {
            const [x, y] = scaledSignCell(s.x, s.y, s.dir);
            return { ...s, x, y };
        }),
        dark: deck.dark?.map(scaleRect),
        blackout: deck.blackout && { ...deck.blackout, rects: deck.blackout.rects.map(scaleRect) },
        terminals: deck.terminals?.map(t =>
        {
            const [x, y] = scaledCell(rows, t.x, t.y);
            return { ...t, x, y, opens: t.opens && scaledCell(rows, t.opens[0], t.opens[1]) };
        }),
    };
}
