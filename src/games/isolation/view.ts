import { against, createCamera, depthAlpha, dirYaw, hash, visibleCells, type Face, type P2, type Pose, type Shape, type V3 } from '../wire/camera';
import { ALIEN_OUTLINE, ALIEN_TAIL } from '../wire/creature';
import { buildLevel, ventDetail } from '../wire/level';
import { cellAt, cellX, cellY, mountWall, type Dir, type Grid, type Sign } from './grid';

/**
 * First-person wireframe view of a deck, as flat shapes for a canvas. Pure: no DOM. The camera and the walls
 * are shared with the other games (`../wire`); this file adds what is particular to AISLAMIENTO.
 */

export type { Pose, Shape } from '../wire/camera';
export { VIEW_DEPTH, depthAlpha, dirYaw } from '../wire/camera';
export { ALIEN_OUTLINE } from '../wire/creature';

/** The android's silhouette, like the creature's: across (-0.5..0.5), and down from the top (-0.5) to the floor (0.5). A man in a uniform, arms at his sides. */
export const ASH_OUTLINE: readonly P2[] = ([
    [-0.1, 0], [-0.02, 0], [-0.02, 0.34], [0.02, 0.34], [0.02, 0], [0.1, 0], [0.1, 0.4], [0.17, 0.4], [0.17, 0.62],
    [0.07, 0.66], [0.06, 0.7], [0.05, 0.77], [0, 0.8], [-0.05, 0.77], [-0.06, 0.7], [-0.07, 0.66], [-0.17, 0.62], [-0.17, 0.4], [-0.1, 0.4],
] as P2[]).map(([u, h]): P2 => [u, 0.5 - h]);

export interface Scene
{
    grid: Grid;
    closed: readonly number[];
    items: readonly number[];
    signs: readonly Sign[];
    pose: Pose;
    /** creature cell to draw, or null */
    alien: number | null;
    /** the android's cell, or null; `ashOff` draws him slumped, switched off */
    ash?: { cell: number; off: boolean } | null;
    /** cells where steam is venting right now */
    steam?: readonly number[];
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

export type ShapeTag = 'floor' | 'wall' | 'door' | 'frame' | 'locker' | 'terminal' | 'vent' | 'item' | 'exit' | 'alien' | 'sign' | 'decoy' | 'flare' | 'flame' | 'ash' | 'steam';

/** how bright an unlit cell next to the player is */
const DARK_DIM = 0.65;

export function cellPose(g: Grid, cell: number, dir: Dir): Pose
{
    return { x: cellX(g, cell) + 0.5, y: cellY(g, cell) + 0.5, yaw: dirYaw(dir) };
}

export function buildView(s: Scene): Shape[]
{
    const { grid: g, pose } = s;
    const camera = createCamera({ pose, bob: s.bob, w: s.w, h: s.h });
    const { cam, poly, line, box, sin, cos, distTo } = camera;

    // cells reachable through open space; anything else is behind a wall
    const cells = visibleCells(g, s.closed, pose);
    if (!cells) return [];

    const push = (list: Shape[], shape: Shape | null) => { if (shape) list.push(shape); };

    /** The wall a locker, terminal or vent is fixed to. */
    const mountOf = (c: number) =>
    {
        const kind = cellAt(g, c);
        return kind === 'locker' || kind === 'terminal' || kind === 'vent' ? mountWall(g, s.closed, c) : null;
    };

    const level = buildLevel({
        grid: g, closed: s.closed, signs: s.signs, camera, cells,
        // without power only the next cell shows, and what glows: terminals, the exit and the power cells
        light: (c, steps) =>
        {
            const kind = cellAt(g, c);
            const unlit = s.lit !== null && !s.lit[c];
            if (unlit && steps > 1 && kind !== 'terminal' && kind !== 'exit' && !s.items.includes(c)) return null;
            return unlit ? DARK_DIM : 1;
        },
        ground: (c, alpha) =>
        {
            if (cellAt(g, c) !== 'exit') return [];
            const x = cellX(g, c);
            const y = cellY(g, c);
            const shapes: (Shape | null)[] = [poly('exit', [cam(x + 0.15, y + 0.15, 0.5), cam(x + 0.85, y + 0.15, 0.5), cam(x + 0.85, y + 0.85, 0.5), cam(x + 0.15, y + 0.85, 0.5)], false, alpha)];
            for (let k = 0.25; k < 0.85; k += 0.15) shapes.push(line('exit', cam(x + k, y + 0.15, 0.5), cam(x + 0.15, y + k, 0.5), alpha * 0.7));
            return shapes;
        },
        wall: (c, dir, f, fa) =>
        {
            const kind = cellAt(g, c);
            if (dir !== mountOf(c)) return null;
            if (kind === 'terminal') return screenDetail(f, fa);
            if (kind === 'vent') return ventDetail(f, fa);
            return null;
        },
        stand: (c, alpha, add) =>
        {
            const kind = cellAt(g, c);
            const x = cellX(g, c);
            const y = cellY(g, c);
            const cx = x + 0.5;
            const cy = y + 0.5;
            // the wall a locker, terminal or vent is fixed to
            const mount = mountOf(c);

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
            if (s.ash && s.ash.cell === c) add(distTo(cx, cy) - 0.01, ashShapes(cx, cy, alpha, s.ash.off));
            if (s.steam?.includes(c)) add(distTo(cx, cy) - 0.02, steamShapes(cx, cy, alpha));
        },
    });

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

    function alienShapes(cx: number, cy: number, alpha: number): (Shape | null)[]
    {
        // a billboard: always side on to the camera
        const at = ([u, v]: P2): V3 => cam(cx + cos * u, cy + sin * u, v);
        const body = poly('alien', ALIEN_OUTLINE.map(at), true, alpha);
        const tail = ALIEN_TAIL.slice(1).map((p, i) => line('alien', at(ALIEN_TAIL[i]), at(p), alpha));
        return [body, ...tail];
    }

    /** The android: a man's outline, upright and still. Switched off, the head is bowed and the eyes are dark. */
    function ashShapes(cx: number, cy: number, alpha: number, off: boolean): (Shape | null)[]
    {
        const at = ([u, v]: P2): V3 => cam(cx + cos * u, cy + sin * u, v);
        const body = poly('ash', ASH_OUTLINE.map(([u, v]) => at([u, off && v < -0.14 ? v + 0.03 : v])), true, alpha);
        if (off) return [body];
        // the eyes: two short strokes that stay lit
        const eye = Math.max(alpha, 0.7);
        return [body, line('ash', at([-0.04, -0.23]), at([-0.015, -0.23]), eye), line('ash', at([0.015, -0.23]), at([0.04, -0.23]), eye)];
    }

    /** Steam from a pipe: wavering strokes that rise from the floor to the ceiling. */
    function steamShapes(cx: number, cy: number, alpha: number): (Shape | null)[]
    {
        const a = Math.max(alpha, 0.6);
        const out: (Shape | null)[] = [];
        for (let k = -2; k <= 2; k++)
        {
            let prev: V3 = cam(cx + k * 0.12, cy, 0.48);
            for (let j = 1; j <= 5; j++)
            {
                const v = 0.5 - j * 0.19;
                const sway = Math.sin(s.pulse * Math.PI * 2 + k + j) * 0.05;
                const next: V3 = cam(cx + k * 0.12 + sway, cy + sway * 0.6, v);
                out.push(line('steam', prev, next, a * (1 - j * 0.12)));
                prev = next;
            }
        }
        return out;
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

    return [...level, ...(s.flame ? flameShapes(s.flame.reach, s.flame.seed) : [])];
}
