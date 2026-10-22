import { describe, expect, it } from 'vitest';
import { bakeVertex } from '../bake';
import { LIGHTS, roomById, roomAt } from '../world';

const comms = roomById('comms')!;
const bodega = roomById('bodega')!;
const UP: [number, number, number] = [0, 1, 0];
const EAST: [number, number, number] = [-1, 0, 0];

describe('baked occlusion and light', () =>
{
    it('is open air and no light for what has no room', () =>
    {
        expect(bakeVertex(null, 0, 1, 0, UP)).toEqual({ ao: 1, lit: 0, dir: [0, 1, 0] });
    });

    it('darkens the floor where it meets a wall and opens up toward the middle', () =>
    {
        const at = (x: number) => bakeVertex(comms, x, 0, 2.5, UP).ao;
        // comms runs from x = -26 to -14
        expect(at(-25.95)).toBeLessThan(at(-24.4));
        expect(at(-24.4)).toBeLessThan(at(-20));
        expect(at(-20)).toBeGreaterThan(0.9);
    });

    it('darkens a wall at the foot, at the ceiling and in a corner', () =>
    {
        const wall = (up: number, y: number) => bakeVertex(comms, -14, up, y, EAST).ao;
        expect(wall(0, 0)).toBeLessThan(wall(1.2, 0));
        expect(wall(comms.height, 0)).toBeLessThan(wall(comms.height - 1.5, 0));
        // the north end of the east wall is a corner of the room
        expect(wall(2, -4)).toBeLessThan(wall(2, 0));
    });

    it('shades the floor round a crate', () =>
    {
        // the crate at (-6, 17.4), 2.4 m wide
        const near = bakeVertex(bodega, -6, 0, 17.4 - 1.4, UP).ao;
        const far = bakeVertex(bodega, 0, 0, 14.4, UP).ao;
        expect(near).toBeLessThan(far);
    });

    it('lights the floor under a lamp more than a corner of the room', () =>
    {
        const lamp = LIGHTS.find(l => roomAt(l.x, l.y)?.id === 'comms' && l.z > 3)!;
        const under = bakeVertex(comms, lamp.x, 0, lamp.y, UP).lit;
        const corner = bakeVertex(comms, -25.9, 0, 5.5, UP).lit;
        expect(under).toBeGreaterThan(corner);
        expect(under).toBeGreaterThan(0);
    });

    it('turns up the lamps of a tall room, where they hang far from the floor', () =>
    {
        const lamp = LIGHTS.find(l => roomAt(l.x, l.y)?.id === 'bodega' && l.z > 6)!;
        // same distance from a lamp, a tall room gives more than the plain formula would
        const lit = bakeVertex(bodega, lamp.x, 0, lamp.y, UP).lit;
        const plain = (lamp.power * 1) / (1 + 0.3 * lamp.z * lamp.z);
        expect(lit).toBeGreaterThan(plain);
    });

    it('says the light comes from the lamps: down onto the floor, a unit vector everywhere', () =>
    {
        const lamp = LIGHTS.find(l => roomAt(l.x, l.y)?.id === 'comms' && l.z > 3)!;
        const under = bakeVertex(comms, lamp.x, 0, lamp.y, UP).dir;
        expect(under[1]).toBeGreaterThan(0.9);
        for (const [x, y] of [[-25.9, 5.5], [-19.4, 0], [-14.4, -5]])
            expect(Math.hypot(...bakeVertex(comms, x, 0, y, UP).dir)).toBeCloseTo(1, 6);
        // on the wall, the light comes from the room's side
        const wall = bakeVertex(comms, -26, 2, 0, [1, 0, 0]).dir;
        expect(wall[0]).toBeGreaterThan(0);
    });
});
