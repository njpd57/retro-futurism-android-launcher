import { describe, expect, it } from 'vitest';
import { collides } from '../collide';
import { clear, glideRoute, pointAt, roomPath, routeLength, STANDS } from '../glide';
import { collisionSegments, inside, ROOMS, roomAt } from '../world';

const segs = collisionSegments();
const names = Object.keys(STANDS);

describe('stands', () =>
{
    it('are free floor inside their own room', () =>
    {
        for (const [id, [x, y]] of Object.entries(STANDS))
        {
            expect(roomAt(x, y)?.id, id).toBe(id);
            expect(collides(segs, x, y, 0.3), id).toBe(false);
        }
    });
});

describe('roomPath', () =>
{
    it('is empty in the same room and goes door by door otherwise', () =>
    {
        expect(roomPath('hub', 'hub')).toEqual([]);
        expect(roomPath('puente', 'hub')?.map(p => p.room)).toEqual(['p-puente', 'hub']);
        expect(roomPath('hangar', 'puente')?.map(p => p.room)).toEqual(['p-hangar', 'motor', 'p-motor', 'bodega', 'p-bodega', 'hub', 'p-puente', 'puente']);
    });
});

describe('glideRoute', () =>
{
    it('walks between every pair of rooms without touching a wall, a crate or a column', () =>
    {
        for (const a of names) for (const b of names)
        {
            if (a === b) continue;
            const route = glideRoute(STANDS[a][0], STANDS[a][1], b);
            expect(route, `${a} to ${b}`).not.toBeNull();
            expect(route![0]).toEqual(STANDS[a]);
            expect(route![route!.length - 1]).toEqual(STANDS[b]);
            for (let i = 1; i < route!.length; i++) expect(clear(route![i - 1], route![i]), `${a} to ${b} leg ${i}`).toBe(true);
        }
    });

    it('stays inside the ship all along', () =>
    {
        const route = glideRoute(STANDS.hangar[0], STANDS.hangar[1], 'comms')!;
        const total = routeLength(route);
        for (let s = 0; s <= total; s += 0.3)
        {
            const p = pointAt(route, s);
            expect(ROOMS.some(r => inside(r.poly, p.x, p.y, -0.01)), `${s}`).toBe(true);
        }
    });

    it('starts from wherever the camera is and fails for an unknown room', () =>
    {
        expect(glideRoute(0, -11.8, 'bodega')?.[0]).toEqual([0, -11.8]);
        expect(glideRoute(0, -11.8, 'nowhere')).toBeNull();
        expect(glideRoute(500, 500, 'hub')).toBeNull();
    });
});

describe('pointAt', () =>
{
    const route: [number, number][] = [[0, 0], [0, -4], [3, -4]];

    it('walks the legs and heads the way they point', () =>
    {
        expect(routeLength(route)).toBeCloseTo(7);
        expect(pointAt(route, 2)).toMatchObject({ x: 0, y: -2, yaw: 0 });
        const second = pointAt(route, 5);
        expect(second.x).toBeCloseTo(1);
        expect(second.y).toBeCloseTo(-4);
        expect(second.yaw).toBeCloseTo(Math.PI / 2);
    });

    it('stops at the end', () =>
    {
        const end = pointAt(route, 99);
        expect(end.x).toBeCloseTo(3);
        expect(end.y).toBeCloseTo(-4);
    });
});
