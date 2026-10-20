import { describe, expect, it } from 'vitest';
import { parseMap } from '../grid';
import { centreOfCell } from '../alien';
import { buildView, cellPose, depthAlpha, type Scene, type Shape } from '../view';

const W = 360;
const H = 300;

function scene(map: string[], over: Partial<Scene> = {}): Scene
{
    const m = parseMap(map);
    return {
        grid: m.grid, closed: m.closed, items: m.items, signs: [], pose: cellPose(m.grid, m.start, 0),
        alien: null, hiddenIn: null, lit: null, decoys: [], flares: [], flame: null, pulse: 0, bob: 0, w: W, h: H, ...over,
    };
}

const numbers = (shapes: Shape[]) => shapes.flatMap(s => s.kind === 'text' ? [s.x, s.y, s.size] : s.pts);
const tagged = (shapes: Shape[], tag: string) => shapes.filter(s => s.tag === tag);

// a corridor going north from the player; the creature is walled in at the left
const CORRIDOR = ['#####', '#A#.#', '###.#', '###.#', '###P#', '#####'];

describe('buildView', () =>
{
    it('draws a corridor with the end wall straight ahead', () =>
    {
        const shapes = buildView(scene(CORRIDOR));
        expect(shapes.length).toBeGreaterThan(10);
        expect(numbers(shapes).every(Number.isFinite)).toBe(true);

        const end = tagged(shapes, 'wall').find(s =>
        {
            if (s.kind !== 'poly' || !s.fill) return false;
            const xs = s.pts.filter((_, i) => i % 2 === 0);
            return Math.abs(Math.min(...xs) + Math.max(...xs) - W) < 1 && Math.max(...xs) - Math.min(...xs) < W / 2;
        });
        expect(end).toBeDefined();
    });

    it('draws far shapes first and fades them', () =>
    {
        const walls = tagged(buildView(scene(CORRIDOR)), 'wall').filter(s => s.kind === 'poly' && s.fill);
        expect(walls[0].alpha).toBeLessThan(walls[walls.length - 1].alpha);
        expect(depthAlpha(1)).toBeGreaterThan(depthAlpha(5));
    });

    it('shows a sign only on a wall that faces the camera', () =>
    {
        const signs = [{ x: 3, y: 1, dir: 0 as const, text: 'C-01' }];
        const ahead = buildView(scene(CORRIDOR, { signs }));
        expect(tagged(ahead, 'sign')).toEqual([expect.objectContaining({ kind: 'text', text: 'C-01' })]);
        // straight ahead: not sheared
        const straight = tagged(ahead, 'sign')[0];
        expect(straight.kind === 'text' && straight.a).toBeCloseTo(1, 2);
        expect(straight.kind === 'text' && straight.b).toBeCloseTo(0, 2);

        // on a side wall it narrows and slants with the perspective
        const side = buildView(scene(CORRIDOR, { signs: [{ x: 3, y: 3, dir: 1, text: 'C-02' }] }));
        const s = tagged(side, 'sign')[0];
        expect(s?.kind === 'text' && s.a).toBeLessThan(1);
        expect(s?.kind === 'text' && Math.abs(s.b)).toBeGreaterThan(0.05);

        const m = parseMap(CORRIDOR);
        const behind = buildView(scene(CORRIDOR, { signs, pose: cellPose(m.grid, m.start, 2) }));
        expect(tagged(behind, 'sign')).toEqual([]);
    });

    it('hides the creature behind a closed door', () =>
    {
        const map = ['#####', '#A#.#', '###D#', '###.#', '###P#', '#####'];
        expect(tagged(buildView(scene(map, { alien: centreOfCell(parseMap(map).grid, 8) })), 'alien')).toEqual([]);
        expect(tagged(buildView(scene(map, { alien: centreOfCell(parseMap(map).grid, 8), closed: [] })), 'alien').length).toBeGreaterThan(0);
        expect(tagged(buildView(scene(map)), 'door').length).toBeGreaterThan(0);
        expect(tagged(buildView(scene(map, { closed: [] })), 'frame').length).toBeGreaterThan(0);
    });

    it('draws lockers and items, but not the locker the player is in', () =>
    {
        const map = ['#####', '#A#*#', '###L#', '###.#', '###P#', '#####'];
        expect(tagged(buildView(scene(map)), 'locker').length).toBeGreaterThan(0);
        expect(tagged(buildView(scene(map)), 'item').length).toBeGreaterThan(0);
        expect(tagged(buildView(scene(map, { hiddenIn: 13 })), 'locker')).toEqual([]);
    });

    it('draws terminals with their screen and vent grilles', () =>
    {
        const map = ['#####', '#A#V#', '###T#', '###.#', '###P#', '#####'];
        const shapes = buildView(scene(map));
        expect(tagged(shapes, 'terminal').length).toBeGreaterThan(5);
        expect(tagged(shapes, 'vent').length).toBeGreaterThan(0);
        expect(numbers(shapes).every(Number.isFinite)).toBe(true);
    });

    it('shows only the next cell where there is no power, besides what glows', () =>
    {
        const map = ['############', '#P...L*T...#', '############', '#A##########', '############'];
        const m = parseMap(map);
        const off = Array(m.grid.cells.length).fill(false);
        const dark = buildView(scene(map, { lit: off }));
        const lit = buildView(scene(map));
        expect(tagged(lit, 'locker').length).toBeGreaterThan(0);
        expect(tagged(dark, 'locker')).toEqual([]);
        expect(dark.length).toBeLessThan(lit.length * 0.7);
        // the terminal and the power cell glow
        expect(tagged(dark, 'terminal').length).toBeGreaterThan(5);
        expect(tagged(dark, 'item').length).toBeGreaterThan(0);

        // a flare brings the cells around it back
        const flared = off.slice();
        for (const x of [3, 4, 5, 6]) flared[12 + x] = true;
        expect(tagged(buildView(scene(map, { lit: flared })), 'locker').length).toBeGreaterThan(0);
        expect(numbers(dark).every(Number.isFinite)).toBe(true);
    });

    it('draws decoys, flares and the flame', () =>
    {
        const map = ['#####', '#A#.#', '###.#', '###.#', '###P#', '#####'];
        expect(tagged(buildView(scene(map, { decoys: [8] })), 'decoy').length).toBeGreaterThan(0);
        expect(tagged(buildView(scene(map, { decoys: [] })), 'decoy')).toEqual([]);
        expect(tagged(buildView(scene(map, { flares: [13] })), 'flare').length).toBeGreaterThan(4);

        const flame = buildView(scene(map, { flame: { reach: 3, seed: 4 } }));
        expect(tagged(flame, 'flame').length).toBeGreaterThan(10);
        expect(numbers(flame).every(Number.isFinite)).toBe(true);
        // it flickers
        expect(buildView(scene(map, { flame: { reach: 3, seed: 5 } }))).not.toEqual(flame);
        // and it is drawn last, over the walls
        expect(flame[flame.length - 1].tag).toBe('flame');
    });

    it('stays finite while moving and turning', () =>
    {
        for (const pose of [{ x: 3.5, y: 4.0, yaw: 0 }, { x: 3.5, y: 4.5, yaw: Math.PI / 4 }, { x: 3.5, y: 4.5, yaw: Math.PI / 2 }])
        {
            const shapes = buildView(scene(CORRIDOR, { pose, bob: 0.02 }));
            expect(shapes.length).toBeGreaterThan(0);
            expect(numbers(shapes).every(Number.isFinite)).toBe(true);
        }
    });

    it('draws nothing from inside a wall', () =>
    {
        expect(buildView(scene(CORRIDOR, { pose: { x: 0.5, y: 0.5, yaw: 0 } }))).toEqual([]);
    });
});

describe('the android and the steam', () =>
{
    // a corridor going north from the player, with something three cells ahead
    const HALL = ['#####', '#A#.#', '###.#', '###.#', '###.#', '###P#', '#####'];
    const at = (cell: number) => ({ ...centreOfCell(parseMap(HALL).grid, cell), off: false });
    const ahead = 3 * 5 + 3;

    it('draws Ash as a man in front of the camera, and only when he is in sight', () =>
    {
        const shapes = buildView(scene(HALL, { ash: at(ahead) }));
        const ash = tagged(shapes, 'ash');
        expect(ash.some(s => s.kind === 'poly')).toBe(true);
        // two eyes while he is on
        expect(ash.filter(s => s.kind === 'line')).toHaveLength(2);
        expect(numbers(shapes).every(Number.isFinite)).toBe(true);
        expect(tagged(buildView(scene(HALL)), 'ash')).toHaveLength(0);
        // behind a wall he is not drawn
        expect(tagged(buildView(scene(HALL, { ash: at(1 * 5 + 1) })), 'ash')).toHaveLength(0);
    });

    it('draws him with the eyes dark when he is switched off', () =>
    {
        const ash = tagged(buildView(scene(HALL, { ash: { ...at(ahead), off: true } })), 'ash');
        expect(ash.some(s => s.kind === 'poly')).toBe(true);
        expect(ash.filter(s => s.kind === 'line')).toHaveLength(0);
    });

    it('draws steam only where it is venting', () =>
    {
        expect(tagged(buildView(scene(HALL, { steam: [ahead] })), 'steam').length).toBeGreaterThan(5);
        expect(tagged(buildView(scene(HALL, { steam: [] })), 'steam')).toHaveLength(0);
        expect(tagged(buildView(scene(HALL)), 'steam')).toHaveLength(0);
    });
});
