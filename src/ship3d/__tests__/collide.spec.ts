import { describe, expect, it } from 'vitest';
import { collides, moveCircle, pushOut } from '../collide';
import { collisionSegments, inside, ROOMS, roomAt, START, type Seg } from '../world';

const wall: Seg[] = [{ ax: -10, ay: 0, bx: 10, by: 0 }];

describe('pushOut and moveCircle', () =>
{
    it('pushes a circle out of a wall', () =>
    {
        const p = pushOut(wall, 0, 0.1, 0.3);
        expect(p.y).toBeCloseTo(0.3);
        expect(pushOut(wall, 0, -0.1, 0.3).y).toBeCloseTo(-0.3);
    });

    it('stops at a wall and slides along it', () =>
    {
        const p = moveCircle(wall, 0, 2, 3, -4, 0.3);
        expect(p.y).toBeCloseTo(0.3, 3);
        expect(p.x).toBeGreaterThan(2);
    });

    it('cannot tunnel through in one big step', () =>
    {
        expect(moveCircle(wall, 0, 1, 0, -5, 0.3).y).toBeGreaterThan(0);
    });

    it('settles in a corner', () =>
    {
        const corner: Seg[] = [{ ax: 0, ay: 0, bx: 10, by: 0 }, { ax: 0, ay: 0, bx: 0, by: 10 }];
        const p = moveCircle(corner, 2, 2, -5, -5, 0.3);
        expect(p.x).toBeGreaterThanOrEqual(0.3 - 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(0.3 - 1e-6);
        expect(collides(corner, p.x, p.y, 0.29)).toBe(false);
    });

    it('leaves a free circle alone', () =>
    {
        const p = moveCircle(wall, 0, 5, 1, 1, 0.3);
        expect(p.x).toBeCloseTo(1);
        expect(p.y).toBeCloseTo(6);
    });
});

describe('the ship', () =>
{
    const segs = collisionSegments();

    it('lets the camera walk from the bridge to the hub through the corridor', () =>
    {
        let p = { x: START.x, y: START.y };
        // straight south along the axis: dome, door, corridor, door, hub
        for (let i = 0; i < 200; i++) p = moveCircle(segs, p.x, p.y, 0, 0.1, 0.3);
        expect(roomAt(p.x, p.y)?.id === 'hub' || p.y > 4).toBe(true);
    });

    it('keeps the camera inside the ship whatever the push', () =>
    {
        const rng = (n: number) => Math.sin(n * 12.9898) * 43758.5453 % 1;
        let p = { x: START.x, y: START.y };
        for (let i = 0; i < 4000; i++)
        {
            const a = rng(i) * Math.PI * 2;
            p = moveCircle(segs, p.x, p.y, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.3);
            expect(ROOMS.some(r => inside(r.poly, p.x, p.y, -0.05)), `${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe(true);
        }
    });

    it('stops at a column', () =>
    {
        // the reactor core stands at (0, 39.6): walk into it from the north
        let p = { x: 0, y: 34 };
        for (let i = 0; i < 100; i++) p = moveCircle(segs, p.x, p.y, 0, 0.1, 0.3);
        expect(p.y).toBeLessThan(39.6 - 2.2);
    });
});
