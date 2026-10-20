import { describe, expect, it } from 'vitest';
import { parseMap } from '../../isolation/grid';
import { VIEW_DEPTH, createCamera, depthAlpha, visibleCells } from '../camera';
import { buildLevel } from '../level';

const MAP = ['#####', '#A#.#', '###.#', '###.#', '###P#', '#####'];
const m = parseMap(MAP);

describe('visibleCells', () =>
{
    it('walks open space with step distances and stops at walls', () =>
    {
        const cells = visibleCells(m.grid, m.closed, { x: 3.5, y: 4.5, yaw: 0 })!;
        // P is at (3, 4): index 23, and the corridor runs north from it
        expect([...cells.entries()]).toEqual([[23, 0], [18, 1], [13, 2], [8, 3]]);
        // the walled-in cell at the left is not in view
        expect(cells.has(6)).toBe(false);
    });

    it('is null from inside a wall or outside the map', () =>
    {
        expect(visibleCells(m.grid, m.closed, { x: 0.5, y: 0.5, yaw: 0 })).toBeNull();
        expect(visibleCells(m.grid, m.closed, { x: -2, y: 0.5, yaw: 0 })).toBeNull();
    });

    it('does not go past the depth limit', () =>
    {
        const long = parseMap(['#########', '#P......#', '#A#######', '#########']);
        const cells = visibleCells(long.grid, long.closed, { x: 1.5, y: 1.5, yaw: 0 }, 3)!;
        expect(Math.max(...cells.values())).toBe(3);
    });
});

describe('createCamera', () =>
{
    it('projects the point straight ahead to the middle of the view', () =>
    {
        const cam = createCamera({ pose: { x: 3.5, y: 4.5, yaw: 0 }, bob: 0, w: 360, h: 300 });
        const p = cam.project(cam.cam(3.5, 2.5, 0));
        expect(p[0]).toBeCloseTo(180, 5);
        expect(p[1]).toBeCloseTo(150, 5);
        // a point to the right (east) lands right of centre
        expect(cam.project(cam.cam(4.5, 2.5, 0))[0]).toBeGreaterThan(180);
    });

    it('turns with the yaw: east is straight ahead at yaw π/2', () =>
    {
        const cam = createCamera({ pose: { x: 3.5, y: 4.5, yaw: Math.PI / 2 }, bob: 0, w: 360, h: 300 });
        expect(cam.project(cam.cam(5.5, 4.5, 0))[0]).toBeCloseTo(180, 5);
    });

    it('drops shapes behind the camera and clips those crossing it', () =>
    {
        const cam = createCamera({ pose: { x: 3.5, y: 4.5, yaw: 0 }, bob: 0, w: 360, h: 300 });
        expect(cam.line('x', cam.cam(3.5, 6, 0), cam.cam(3.5, 7, 0), 1)).toBeNull();
        const across = cam.line('x', cam.cam(3.5, 6, 0), cam.cam(3.5, 2, 0), 1);
        expect(across).not.toBeNull();
        expect(across!.kind === 'line' && across!.pts.every(Number.isFinite)).toBe(true);
    });
});

describe('depthAlpha', () =>
{
    it('fades with distance and takes a longer view', () =>
    {
        expect(depthAlpha(1)).toBeGreaterThan(depthAlpha(5));
        expect(depthAlpha(VIEW_DEPTH + 5)).toBe(0.15);
        // with a deeper view the same distance is brighter
        expect(depthAlpha(6, 12)).toBeGreaterThan(depthAlpha(6));
    });
});

describe('buildLevel', () =>
{
    it('draws the floor first and walls far to near, with a hook for what stands in a cell', () =>
    {
        const camera = createCamera({ pose: { x: 3.5, y: 4.5, yaw: 0 }, bob: 0, w: 360, h: 300 });
        const cells = visibleCells(m.grid, m.closed, camera.pose)!;
        const stood: number[] = [];
        const shapes = buildLevel({
            grid: m.grid, closed: m.closed, signs: [], camera, cells,
            stand: (c, _a, add) =>
            {
                stood.push(c);
                add(camera.distTo(3.5, 1.5), []);
            },
        });
        expect(stood).toEqual([...cells.keys()]);
        const firstWall = shapes.findIndex(s => s.tag === 'wall');
        expect(shapes.slice(0, firstWall).every(s => s.tag === 'floor')).toBe(true);
        const walls = shapes.filter(s => s.tag === 'wall' && s.kind === 'poly' && s.fill);
        expect(walls[0].alpha).toBeLessThan(walls[walls.length - 1].alpha);
    });

    it('skips cells the light hook rules out', () =>
    {
        const camera = createCamera({ pose: { x: 3.5, y: 4.5, yaw: 0 }, bob: 0, w: 360, h: 300 });
        const cells = visibleCells(m.grid, m.closed, camera.pose)!;
        const all = buildLevel({ grid: m.grid, closed: m.closed, signs: [], camera, cells });
        const near = buildLevel({ grid: m.grid, closed: m.closed, signs: [], camera, cells, light: (_c, steps) => steps <= 1 ? 1 : null });
        expect(near.length).toBeLessThan(all.length);
    });
});
