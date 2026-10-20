import { blocks, cellAt, cellX, cellY, neighbour, type Dir, type Grid, type Sign } from '../isolation/grid';
import { VIEW_DEPTH, depthAlpha, edge, hash, type Camera, type Face, type P2, type Shape } from './camera';

/** Wall decoration, one of five by hash. */
export function wallDetail(f: Face, h: number, alpha: number): (Shape | null)[]
{
    const dim = alpha * 0.45;
    switch (h % 5)
    {
        case 0: return [f.rect('wall', 0.1, 0.1, 0.9, 0.9, dim)];
        case 1: return [
            f.line('wall', 0, 0.12, 1, 0.12, dim), f.line('wall', 0, 0.18, 1, 0.18, dim),
            f.line('wall', 0.25, 0.08, 0.25, 0.22, dim), f.line('wall', 0.75, 0.08, 0.75, 0.22, dim),
        ];
        case 2: return [
            f.rect('wall', 0.3, 0.62, 0.7, 0.86, dim),
            f.line('wall', 0.3, 0.68, 0.7, 0.68, dim), f.line('wall', 0.3, 0.74, 0.7, 0.74, dim), f.line('wall', 0.3, 0.8, 0.7, 0.8, dim),
        ];
        case 3: return [
            f.line('wall', 0, 0.42, 1, 0.42, dim), f.line('wall', 0, 0.58, 1, 0.58, dim),
            f.line('wall', 0.2, 0.42, 0.2, 0.58, dim), f.line('wall', 0.5, 0.42, 0.5, 0.58, dim), f.line('wall', 0.8, 0.42, 0.8, 0.58, dim),
        ];
        default: return [];
    }
}

/** A closed pressure door: leaf, centre seam, handle and hazard stripes. */
export function doorDetail(f: Face, alpha: number): (Shape | null)[]
{
    const shapes = [
        f.rect('door', 0.08, 0.06, 0.92, 1, alpha),
        f.line('door', 0.5, 0.06, 0.5, 1, alpha),
        f.rect('door', 0.82, 0.1, 0.88, 0.15, alpha),
        f.line('door', 0.08, 0.84, 0.92, 0.84, alpha * 0.7),
    ];
    // hazard stripes along the bottom
    for (let u = 0.12; u < 0.88; u += 0.1) shapes.push(f.line('door', u, 1, u + 0.06, 0.86, alpha * 0.6));
    return shapes;
}

/** A duct grille low on the wall. */
export function ventDetail(f: Face, alpha: number): (Shape | null)[]
{
    return [
        f.rect('vent', 0.26, 0.68, 0.74, 0.96, alpha),
        ...[0.34, 0.42, 0.5, 0.58, 0.66].map(u => f.line('vent', u, 0.7, u, 0.94, alpha * 0.7)),
    ];
}

export type AddGroup = (key: number, shapes: (Shape | null)[]) => void;

export interface LevelOptions
{
    grid: Grid;
    closed: readonly number[];
    signs: readonly Sign[];
    camera: Camera;
    /** the cells in view with their distance in steps (see `visibleCells`) */
    cells: ReadonlyMap<number, number>;
    /** cells farther than this fade out completely; default `VIEW_DEPTH` */
    viewDepth?: number;
    /** brightness multiplier of a cell, or null to skip it. Default 1 */
    light?: (cell: number, steps: number) => number | null;
    /** extra shapes on the floor of a cell, after its grid and lamps */
    ground?: (cell: number, alpha: number) => (Shape | null)[];
    /** decoration of the wall on the `dir` side of a cell instead of the default; null keeps the default */
    wall?: (cell: number, dir: Dir, f: Face, alpha: number) => (Shape | null)[] | null;
    /** what stands in a cell, after its walls; `add` files it under its distance for the far-to-near draw */
    stand?: (cell: number, alpha: number, add: AddGroup) => void;
}

/**
 * Floor grid, ceiling lamps, walls (with doors and their open frames) and signs of every cell in view, then what
 * stands in them, all ordered far to near: the floor first, then the groups by distance.
 */
export function buildLevel(o: LevelOptions): Shape[]
{
    const { grid: g, camera: cam, cells } = o;
    const viewDepth = o.viewDepth ?? VIEW_DEPTH;
    const ground: Shape[] = [];
    const groups: { key: number; shapes: Shape[] }[] = [];
    const add: AddGroup = (key, shapes) =>
    {
        const kept = shapes.filter((x): x is Shape => x !== null);
        if (kept.length) groups.push({ key, shapes: kept });
    };
    const push = (list: Shape[], shape: Shape | null) => { if (shape) list.push(shape); };

    for (const c of cells.keys())
    {
        const light = o.light ? o.light(c, cells.get(c)!) : 1;
        if (light === null) continue;

        const x = cellX(g, c);
        const y = cellY(g, c);
        const cx = x + 0.5;
        const cy = y + 0.5;
        const alpha = depthAlpha(cam.distTo(cx, cy), viewDepth) * light;

        // floor grid: the north and west edges of every cell, and the others where the map ends
        const floorEdges: [P2, P2][] = [[[x, y], [x + 1, y]], [[x, y], [x, y + 1]]];
        if (!cells.has(neighbour(g, c, 2))) floorEdges.push([[x, y + 1], [x + 1, y + 1]]);
        if (!cells.has(neighbour(g, c, 1))) floorEdges.push([[x + 1, y], [x + 1, y + 1]]);
        for (const [a, b] of floorEdges) push(ground, cam.line('floor', cam.cam(a[0], a[1], 0.5), cam.cam(b[0], b[1], 0.5), alpha * 0.45));
        // ceiling lamps every other cell
        if ((x + y) % 2 === 0)
            push(ground, cam.poly('floor', [cam.cam(cx - 0.2, cy - 0.12, -0.5), cam.cam(cx + 0.2, cy - 0.12, -0.5), cam.cam(cx + 0.2, cy + 0.12, -0.5), cam.cam(cx - 0.2, cy + 0.12, -0.5)], false, alpha * 0.5));
        if (o.ground) for (const s of o.ground(c, alpha)) push(ground, s);

        const kind = cellAt(g, c);
        for (let k = 0; k < 4; k++)
        {
            const dir = k as Dir;
            const n = neighbour(g, c, dir);
            const [a, b] = edge(x, y, dir);
            const key = cam.distTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            const fa = depthAlpha(key, viewDepth) * light;

            if (blocks(g, o.closed, n))
            {
                if (!cam.facing(a, b)) continue;
                const f = cam.face(a, b);
                const isDoor = cellAt(g, n) === 'door';
                const shapes: (Shape | null)[] = [f.poly(isDoor ? 'door' : 'wall', [[0, 0], [1, 0], [1, 1], [0, 1]], true, fa)];
                if (isDoor) shapes.push(...doorDetail(f, fa));
                else shapes.push(...(o.wall?.(c, dir, f, fa) ?? wallDetail(f, hash(c * 4 + k), fa)));
                const sign = o.signs.find(sg => sg.x === x && sg.y === y && sg.dir === dir);
                if (sign) shapes.push(cam.text(f, sign.text, fa));
                add(key, shapes);
            }
            else if (kind === 'door' && cells.has(n))
            {
                // the frame of an open door, seen from both sides
                const f = cam.face(a, b);
                add(key, [
                    f.poly('frame', [[0, 0], [0.1, 0], [0.1, 1], [0, 1]], true, fa),
                    f.poly('frame', [[0.9, 0], [1, 0], [1, 1], [0.9, 1]], true, fa),
                    f.poly('frame', [[0.1, 0], [0.9, 0], [0.9, 0.12], [0.1, 0.12]], true, fa),
                ]);
            }
        }

        o.stand?.(c, alpha, add);
    }

    groups.sort((p, q) => q.key - p.key);
    return [...ground, ...groups.flatMap(gr => gr.shapes)];
}
