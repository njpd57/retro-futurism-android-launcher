import { blocks, cellAt, cellX, cellY, mountWall, neighbour, type Dir, type Grid, type Sign } from './grid';

/**
 * First-person wireframe view of a deck, as flat shapes for a canvas. Pure: no DOM.
 *
 * Map units: cell (x, y) spans [x, x+1] × [y, y+1], y grows southwards. Heights go from -0.5 (ceiling) to 0.5
 * (floor) with the eye at 0. Faces are filled with the background and drawn far to near, so nearer walls hide
 * what is behind them.
 */

export interface Pose
{
    /** continuous map position; the centre of cell (x, y) is (x + 0.5, y + 0.5) */
    x: number;
    y: number;
    /** radians, 0 = north, clockwise */
    yaw: number;
}

export interface Scene
{
    grid: Grid;
    closed: readonly number[];
    items: readonly number[];
    signs: readonly Sign[];
    pose: Pose;
    /** creature cell to draw, or null */
    alien: number | null;
    /** locker cell the player is inside: not drawn */
    hiddenIn: number | null;
    /** per cell, whether it is lit; null when the whole deck has power. Unlit cells show only one step away. */
    lit: readonly boolean[] | null;
    /** cells with a decoy or a burning flare lying in them */
    decoys: readonly number[];
    flares: readonly number[];
    /** the flamethrower firing: how many cells the flame reaches, and a number that changes every frame to make it flicker */
    flame: { reach: number; seed: number } | null;
    /** 0..1, makes the items throb */
    pulse: number;
    /** vertical offset of the eye (walking bob) */
    bob: number;
    w: number;
    h: number;
}

export type ShapeTag = 'floor' | 'wall' | 'door' | 'frame' | 'locker' | 'terminal' | 'vent' | 'item' | 'exit' | 'alien' | 'sign' | 'decoy' | 'flare' | 'flame';

export type Shape =
    | { kind: 'poly'; tag: ShapeTag; pts: number[]; fill: boolean; alpha: number }
    | { kind: 'line'; tag: ShapeTag; pts: number[]; alpha: number }
    /** `a`, `b`: the text's horizontal axis on screen (1, 0 when the wall faces the camera), to follow the wall */
    | { kind: 'text'; tag: ShapeTag; x: number; y: number; size: number; a: number; b: number; text: string; alpha: number };

/** Cells seen in any direction. */
export const VIEW_DEPTH = 6;
const NEAR = 0.05;
/** how bright an unlit cell next to the player is */
const DARK_DIM = 0.65;
/** focal length as a fraction of the view width */
const FOCAL = 0.62;

export const dirYaw = (dir: Dir) => dir * Math.PI / 2;

export function cellPose(g: Grid, cell: number, dir: Dir): Pose
{
    return { x: cellX(g, cell) + 0.5, y: cellY(g, cell) + 0.5, yaw: dirYaw(dir) };
}

/** Lines fade with distance. */
export function depthAlpha(dist: number)
{
    return Math.min(1, Math.max(0.15, 1.1 - dist / (VIEW_DEPTH + 1)));
}

type V3 = [number, number, number];
type P2 = [number, number];

/** Creature silhouette, side on: x across (-0.5..0.5), y from the top of the head (-0.5) to the floor (0.5). */
export const ALIEN_OUTLINE: readonly P2[] = [
    [-0.2, -0.2], [-0.13, -0.29], [0.04, -0.37], [0.32, -0.47], [0.22, -0.35], [0.12, -0.27], [0.2, -0.2],
    [0.29, -0.27], [0.27, -0.14], [0.16, -0.08], [0.18, 0.05], [0.24, 0.2], [0.16, 0.3], [0.22, 0.5],
    [0.12, 0.5], [0.08, 0.32], [0.04, 0.12], [-0.02, 0.3], [-0.04, 0.5], [-0.12, 0.5], [-0.08, 0.28],
    [-0.06, 0.05], [-0.1, -0.02], [-0.22, 0.22], [-0.27, 0.25], [-0.16, -0.04], [-0.12, -0.14], [-0.17, -0.17],
];
export const ALIEN_TAIL: readonly P2[] = [[0.18, 0.05], [0.36, 0.2], [0.46, 0.47]];

/** Inside-out order of each wall: seen from inside the cell, `a` is on the left and `b` on the right. */
function edge(x: number, y: number, dir: Dir): [P2, P2]
{
    switch (dir)
    {
        case 0: return [[x, y], [x + 1, y]];
        case 1: return [[x + 1, y], [x + 1, y + 1]];
        case 2: return [[x + 1, y + 1], [x, y + 1]];
        case 3: return [[x, y + 1], [x, y]];
    }
}

const INWARD: Record<Dir, P2> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] };

function hash(n: number)
{
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) % 997;
}

export function buildView(s: Scene): Shape[]
{
    const { grid: g, pose } = s;
    const sin = Math.sin(pose.yaw);
    const cos = Math.cos(pose.yaw);
    const focal = FOCAL * s.w;

    const cam = (wx: number, wy: number, h: number): V3 =>
    {
        const dx = wx - pose.x;
        const dy = wy - pose.y;
        // right = (cos, sin), forward = (sin, -cos)
        return [dx * cos + dy * sin, h + s.bob, dx * sin - dy * cos];
    };
    const project = (p: V3): P2 => [s.w / 2 + p[0] / p[2] * focal, s.h / 2 + p[1] / p[2] * focal];

    function clipPoly(pts: V3[]): V3[]
    {
        const out: V3[] = [];
        for (let i = 0; i < pts.length; i++)
        {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            const ina = a[2] >= NEAR;
            const inb = b[2] >= NEAR;
            if (ina) out.push(a);
            if (ina !== inb)
            {
                const t = (NEAR - a[2]) / (b[2] - a[2]);
                out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
            }
        }
        return out;
    }

    function clipSegment(a: V3, b: V3): [V3, V3] | null
    {
        if (a[2] < NEAR && b[2] < NEAR) return null;
        if (a[2] >= NEAR && b[2] >= NEAR) return [a, b];
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        const m: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
        return a[2] < NEAR ? [m, b] : [a, m];
    }

    const flat = (pts: P2[]) => pts.flatMap(p => p);

    function poly(tag: ShapeTag, pts: V3[], fill: boolean, alpha: number): Shape | null
    {
        const clipped = clipPoly(pts);
        if (clipped.length < 3) return null;
        return { kind: 'poly', tag, pts: flat(clipped.map(project)), fill, alpha };
    }

    function line(tag: ShapeTag, a: V3, b: V3, alpha: number): Shape | null
    {
        const c = clipSegment(a, b);
        return c && { kind: 'line', tag, pts: flat(c.map(project)), alpha };
    }

    /** A vertical face from `a` to `b`, with points given as (u across, v down) in 0..1. */
    function face(a: P2, b: P2, top = -0.5, bottom = 0.5)
    {
        const at = (u: number, v: number): V3 => cam(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, top + (bottom - top) * v);
        return {
            poly: (tag: ShapeTag, uv: P2[], fill: boolean, alpha: number) => poly(tag, uv.map(([u, v]) => at(u, v)), fill, alpha),
            line: (tag: ShapeTag, u0: number, v0: number, u1: number, v1: number, alpha: number) => line(tag, at(u0, v0), at(u1, v1), alpha),
            rect: (tag: ShapeTag, u0: number, v0: number, u1: number, v1: number, alpha: number) =>
                poly(tag, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => at(u, v)), false, alpha),
            point: (u: number, v: number) => at(u, v),
        };
    }

    /** True when the camera is on the side of a→b that faces are drawn for. */
    const facing = (a: P2, b: P2) => (pose.x - a[0]) * -(b[1] - a[1]) + (pose.y - a[1]) * (b[0] - a[0]) > 0;
    const distTo = (x: number, y: number) => Math.hypot(x - pose.x, y - pose.y);

    // cells reachable through open space; anything else is behind a wall
    const start = Math.floor(pose.y) * g.w + Math.floor(pose.x);
    if (start < 0 || start >= g.cells.length || blocks(g, s.closed, start)) return [];
    const depth = new Map<number, number>([[start, 0]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++)
    {
        const c = queue[head];
        const d = depth.get(c)!;
        if (d >= VIEW_DEPTH) continue;
        for (let k = 0; k < 4; k++)
        {
            const n = neighbour(g, c, k as Dir);
            if (n < 0 || depth.has(n) || blocks(g, s.closed, n)) continue;
            depth.set(n, d + 1);
            queue.push(n);
        }
    }

    const ground: Shape[] = [];
    const groups: { key: number; shapes: Shape[] }[] = [];
    const add = (key: number, shapes: (Shape | null)[]) =>
    {
        const kept = shapes.filter((x): x is Shape => x !== null);
        if (kept.length) groups.push({ key, shapes: kept });
    };
    const push = (list: Shape[], shape: Shape | null) => { if (shape) list.push(shape); };

    for (const c of depth.keys())
    {
        const kind = cellAt(g, c);
        const unlit = s.lit !== null && !s.lit[c];
        // without power only the next cell shows, and what glows: terminals, the exit and the power cells
        if (unlit && depth.get(c)! > 1 && kind !== 'terminal' && kind !== 'exit' && !s.items.includes(c)) continue;
        const light = unlit ? DARK_DIM : 1;

        const x = cellX(g, c);
        const y = cellY(g, c);
        const cx = x + 0.5;
        const cy = y + 0.5;
        const alpha = depthAlpha(distTo(cx, cy)) * light;
        // the wall a locker, terminal or vent is fixed to
        const mount = kind === 'locker' || kind === 'terminal' || kind === 'vent' ? mountWall(g, s.closed, c) : null;

        // floor grid: the north and west edges of every cell, and the others where the map ends
        const floorEdges: [P2, P2][] = [[[x, y], [x + 1, y]], [[x, y], [x, y + 1]]];
        if (!depth.has(neighbour(g, c, 2))) floorEdges.push([[x, y + 1], [x + 1, y + 1]]);
        if (!depth.has(neighbour(g, c, 1))) floorEdges.push([[x + 1, y], [x + 1, y + 1]]);
        for (const [a, b] of floorEdges) push(ground, line('floor', cam(a[0], a[1], 0.5), cam(b[0], b[1], 0.5), alpha * 0.45));
        // ceiling lamps every other cell
        if ((x + y) % 2 === 0)
            push(ground, poly('floor', [cam(cx - 0.2, cy - 0.12, -0.5), cam(cx + 0.2, cy - 0.12, -0.5), cam(cx + 0.2, cy + 0.12, -0.5), cam(cx - 0.2, cy + 0.12, -0.5)], false, alpha * 0.5));

        if (kind === 'exit')
        {
            push(ground, poly('exit', [cam(x + 0.15, y + 0.15, 0.5), cam(x + 0.85, y + 0.15, 0.5), cam(x + 0.85, y + 0.85, 0.5), cam(x + 0.15, y + 0.85, 0.5)], false, alpha));
            for (let k = 0.25; k < 0.85; k += 0.15) push(ground, line('exit', cam(x + k, y + 0.15, 0.5), cam(x + 0.15, y + k, 0.5), alpha * 0.7));
        }

        for (let k = 0; k < 4; k++)
        {
            const dir = k as Dir;
            const n = neighbour(g, c, dir);
            const [a, b] = edge(x, y, dir);
            const key = distTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            const fa = depthAlpha(key) * light;

            if (blocks(g, s.closed, n))
            {
                if (!facing(a, b)) continue;
                const f = face(a, b);
                const isDoor = cellAt(g, n) === 'door';
                const shapes: (Shape | null)[] = [f.poly(isDoor ? 'door' : 'wall', [[0, 0], [1, 0], [1, 1], [0, 1]], true, fa)];
                if (isDoor) shapes.push(...doorDetail(f, fa));
                else if (dir === mount && kind === 'terminal') shapes.push(...screenDetail(f, fa));
                else if (dir === mount && kind === 'vent') shapes.push(...ventDetail(f, fa));
                else shapes.push(...wallDetail(f, hash(c * 4 + k), fa));
                const sign = s.signs.find(sg => sg.x === x && sg.y === y && sg.dir === dir);
                if (sign) shapes.push(text(f, sign.text, fa));
                add(key, shapes);
            }
            else if (kind === 'door' && depth.has(n))
            {
                // the frame of an open door, seen from both sides
                const f = face(a, b);
                add(key, [
                    f.poly('frame', [[0, 0], [0.1, 0], [0.1, 1], [0, 1]], true, fa),
                    f.poly('frame', [[0.9, 0], [1, 0], [1, 1], [0.9, 1]], true, fa),
                    f.poly('frame', [[0.1, 0], [0.9, 0], [0.9, 0.12], [0.1, 0.12]], true, fa),
                ]);
            }
        }

        if (kind === 'locker' && mount !== null && c !== s.hiddenIn)
            add(distTo(cx, cy), box(against(x, y, mount, 0.18, 0.32), -0.46, 0.5, 'locker', alpha, (f, al) => [
                f.line('locker', 0.5, 0.02, 0.5, 1, al),
                ...[0.12, 0.17, 0.22].flatMap(v => [f.line('locker', 0.12, v, 0.4, v, al * 0.7), f.line('locker', 0.6, v, 0.88, v, al * 0.7)]),
            ]));

        if (kind === 'terminal' && mount !== null)
        {
            // a console desk under the screen; the eye is above it, so its top shows
            const base = against(x, y, mount, 0.2, 0.38);
            const top = 0.12;
            const [p2, p3, p0, p1] = base;
            const at = (p: P2, t: number, q: P2) => cam(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, top);
            add(distTo(cx, cy), [
                ...box(base, top, 0.5, 'terminal', alpha),
                poly('terminal', base.map(p => cam(p[0], p[1], top)), true, alpha),
                // keys
                ...[0.3, 0.55].map(t => line('terminal', at(p3, t, p0), at(p2, t, p1), alpha * 0.6)),
            ]);
        }

        if (s.items.includes(c))
        {
            const r = 0.09;
            const ia = alpha * (0.55 + 0.45 * s.pulse);
            add(distTo(cx, cy), box([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], 0.2, 0.5, 'item', ia, (f, al) => [
                f.line('item', 0, 0.35, 1, 0.35, al),
                f.line('item', 0.5, 0.45, 0.5, 0.85, al),
            ]));
        }

        if (s.decoys.includes(c)) add(distTo(cx, cy), decoyShapes(cx, cy, alpha));
        if (s.flares.includes(c)) add(distTo(cx, cy), flareShapes(cx, cy, depthAlpha(distTo(cx, cy))));

        if (s.alien === c) add(distTo(cx, cy) - 0.01, alienShapes(cx, cy, alpha));
    }

    type Face = ReturnType<typeof face>;

    /** A label across the top of a wall, sheared to follow it; null when too small or too edge-on to read. */
    function text(f: Face, label: string, alpha: number): Shape | null
    {
        const V = 0.12;
        const pts = [f.point(0.5, 0.28 - V / 2), f.point(0.5, 0.28 + V / 2), f.point(0.45, 0.28), f.point(0.55, 0.28)];
        if (pts.some(p => p[2] < NEAR)) return null;
        const [top, bottom, left, right] = pts.map(project);
        const size = Math.abs(bottom[1] - top[1]);
        // screen pixels per wall unit across, over pixels per wall unit down
        const a = (right[0] - left[0]) / 0.1 / (size / V);
        const b = (right[1] - left[1]) / 0.1 / (size / V);
        if (size < 6 || a < 0.3) return null;
        return { kind: 'text', tag: 'sign', x: (top[0] + bottom[0]) / 2, y: (top[1] + bottom[1]) / 2, size, a, b, text: label, alpha };
    }

    function wallDetail(f: Face, h: number, alpha: number): (Shape | null)[]
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

    function doorDetail(f: Face, alpha: number): (Shape | null)[]
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

    /** A box standing on the floor from `top` to `bottom` height over the 2D outline `base` (clockwise). */
    function box(base: P2[], top: number, bottom: number, tag: ShapeTag, alpha: number, detail?: (f: Face, alpha: number) => (Shape | null)[]): (Shape | null)[]
    {
        const shapes: (Shape | null)[] = [];
        for (let i = 0; i < base.length; i++)
        {
            // outward faces: walk the outline backwards so each face is seen from outside
            const a = base[(i + 1) % base.length];
            const b = base[i];
            if (!facing(a, b)) continue;
            const f = face(a, b, top, bottom);
            shapes.push(f.poly(tag, [[0, 0], [1, 0], [1, 1], [0, 1]], true, alpha));
            if (detail) shapes.push(...detail(f, alpha));
        }
        return shapes;
    }

    /**
     * Outline of something standing against the `wall` side of cell (x, y): `margin` free at each end, `depth`
     * into the cell. Clockwise for `box`, starting at the front right corner; p3 → p2 is the front.
     */
    function against(x: number, y: number, wall: Dir, margin: number, depth: number): P2[]
    {
        const [a, b] = edge(x, y, wall);
        const inward = INWARD[wall];
        const lerp = (t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const p0 = lerp(margin);
        const p1 = lerp(1 - margin);
        const p2: P2 = [p1[0] + inward[0] * depth, p1[1] + inward[1] * depth];
        const p3: P2 = [p0[0] + inward[0] * depth, p0[1] + inward[1] * depth];
        return [p2, p3, p0, p1];
    }

    /** MOTHER's screen above a terminal desk: it glows, so it stays bright at a distance. */
    function screenDetail(f: Face, alpha: number): (Shape | null)[]
    {
        const a = Math.max(alpha, 0.8);
        return [
            f.rect('terminal', 0.22, 0.16, 0.78, 0.46, a),
            f.line('terminal', 0.28, 0.24, 0.62, 0.24, a * 0.8),
            f.line('terminal', 0.28, 0.3, 0.7, 0.3, a * 0.8),
            f.line('terminal', 0.28, 0.36, 0.5, 0.36, a * 0.8),
            f.poly('terminal', [[0.53, 0.34], [0.57, 0.34], [0.57, 0.39], [0.53, 0.39]], false, a),
        ];
    }

    /** A duct grille low on the wall. */
    function ventDetail(f: Face, alpha: number): (Shape | null)[]
    {
        return [
            f.rect('vent', 0.26, 0.68, 0.74, 0.96, alpha),
            ...[0.34, 0.42, 0.5, 0.58, 0.66].map(u => f.line('vent', u, 0.7, u, 0.94, alpha * 0.7)),
        ];
    }

    function alienShapes(cx: number, cy: number, alpha: number): (Shape | null)[]
    {
        // a billboard: always side on to the camera
        const at = ([u, v]: P2): V3 => cam(cx + cos * u, cy + sin * u, v);
        const body = poly('alien', ALIEN_OUTLINE.map(at), true, alpha);
        const tail = ALIEN_TAIL.slice(1).map((p, i) => line('alien', at(ALIEN_TAIL[i]), at(p), alpha));
        return [body, ...tail];
    }

    /** A noisemaker on the floor, its aerial blinking. */
    function decoyShapes(cx: number, cy: number, alpha: number): (Shape | null)[]
    {
        const r = 0.07;
        return [
            ...box([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], 0.34, 0.5, 'decoy', alpha),
            line('decoy', cam(cx, cy, 0.34), cam(cx, cy, 0.14), alpha * (0.4 + 0.6 * s.pulse)),
        ];
    }

    /** A burning flare: it shines, so it ignores the distance fade. */
    function flareShapes(cx: number, cy: number, alpha: number): (Shape | null)[]
    {
        const a = Math.max(alpha, 0.85);
        const r = 0.05;
        const rays: (Shape | null)[] = [];
        for (let k = 0; k < 8; k++)
        {
            const t = k * Math.PI / 4;
            rays.push(line('flare', cam(cx + Math.cos(t) * 0.07, cy + Math.sin(t) * 0.07, 0.38), cam(cx + Math.cos(t) * 0.22, cy + Math.sin(t) * 0.22, 0.38 - 0.12 * s.pulse), a));
        }
        rays.push(line('flare', cam(cx, cy, 0.4), cam(cx, cy, 0.04 - 0.1 * s.pulse), a));
        return [...box([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], 0.42, 0.5, 'flare', a), ...rays];
    }

    /** The flame in front of the player, in camera space: tongues spreading and flickering. */
    function flameShapes(reach: number, seed: number): Shape[]
    {
        const shapes: Shape[] = [];
        const far = Math.max(1, reach) + 0.4;
        const jitter = (i: number, k: number) => hash(seed * 131 + i * 17 + k * 5) / 997 - 0.5;
        for (let i = 0; i < 7; i++)
        {
            const spread = (i - 3) / 3;
            let prev: V3 = [0, 0.3 + s.bob, 0.3];
            for (let k = 1; k <= 4; k++)
            {
                const u = k / 4;
                // a plume: it widens and rises as it goes, so it doesn't just converge on the vanishing point
                const next: V3 = [spread * 1.1 * u + jitter(i, k) * 0.4 * u, 0.32 - 0.5 * u * (1 - 0.4 * Math.abs(spread)) + jitter(i, k + 9) * 0.3 * u + s.bob, 0.3 + (far - 0.3) * u];
                push(shapes, line('flame', prev, next, 1 - u * 0.35));
                prev = next;
            }
        }
        return shapes;
    }

    groups.sort((p, q) => q.key - p.key);
    return [...ground, ...groups.flatMap(gr => gr.shapes), ...(s.flame ? flameShapes(s.flame.reach, s.flame.seed) : [])];
}
