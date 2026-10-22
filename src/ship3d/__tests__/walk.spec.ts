import { describe, expect, it } from 'vitest';
import { eyeHeight, stepWalk, walker, WALK, type Walker } from '../walk';
import { collisionSegments, START } from '../world';

const segs = collisionSegments();
const none = { strafe: 0, forward: 0, turn: 0, tilt: 0 };

function run(w: Walker, input: Partial<typeof none>, seconds: number, dt = 1 / 60)
{
    for (let t = 0; t < seconds; t += dt) w = stepWalk(w, { ...none, ...input }, dt, segs);
    return w;
}

describe('stepWalk', () =>
{
    const start = walker(START.x, START.y, 0);

    it('walks the way it faces and reaches the full speed', () =>
    {
        // south, down the open lane to the corridor (north there is the console)
        const w = run(walker(START.x, START.y, Math.PI), { forward: 1 }, 0.6);
        expect(w.y).toBeGreaterThan(start.y + 1);
        expect(Math.abs(w.x - start.x)).toBeLessThan(0.01);
        expect(Math.hypot(w.vx, w.vy)).toBeCloseTo(WALK.speed, 1);
    });

    it('is no faster on a diagonal and slower backwards', () =>
    {
        const diag = run(walker(2, 3, 0), { forward: 1, strafe: 1 }, 0.5);
        expect(Math.hypot(diag.vx, diag.vy)).toBeLessThanOrEqual(WALK.speed + 1e-6);
        const back = run(walker(0, -7, 0), { forward: -1 }, 0.6);
        expect(Math.hypot(back.vx, back.vy)).toBeCloseTo(WALK.back, 1);
    });

    it('strafes to the right of where it looks', () =>
    {
        const w = run(walker(2, 2, Math.PI / 2), { strafe: 1 }, 0.4);
        expect(w.y).toBeGreaterThan(2.3);
    });

    it('speeds up and slows down smoothly, never jumping', () =>
    {
        let w = start;
        let last = 0;
        for (let i = 0; i < 30; i++)
        {
            w = stepWalk(w, { ...none, forward: 1 }, 1 / 60, segs);
            const v = Math.hypot(w.vx, w.vy);
            expect(v - last).toBeLessThan(WALK.speed * 0.3);
            last = v;
        }
        const stopped = run(w, {}, 1);
        expect(Math.hypot(stopped.vx, stopped.vy)).toBe(0);
    });

    it('turns exactly as asked and keeps the tilt in range', () =>
    {
        const w = stepWalk(start, { ...none, turn: 0.5, tilt: 3 }, 1 / 60, segs);
        expect(w.yaw).toBeCloseTo(0.5);
        expect(w.pitch).toBe(WALK.pitchMax);
        expect(stepWalk(start, { ...none, turn: Math.PI * 2 + 0.3 }, 1 / 60, segs).yaw).toBeCloseTo(0.3);
    });

    it('slides along a wall instead of stopping dead', () =>
    {
        // on the bridge's east side the dome slopes: walking east into it still moves along it
        const w = run(walker(4, -12, Math.PI / 2), { forward: 1 }, 1.5);
        expect(w.x).toBeLessThan(9);
        expect(Math.hypot(w.x - 4, w.y + 12)).toBeGreaterThan(0.5);
    });

    it('walks through the doors to the hub and the hangar', () =>
    {
        // south from the bridge: dome, door, corridor, door, hub centre column is at 0,0 so veer a little
        let w = walker(1, -11.8, Math.PI);
        w = run(w, { forward: 1 }, 8);
        expect(w.y).toBeGreaterThan(4);
    });
});

describe('eyeHeight', () =>
{
    it('is steady when still and bobs when walking', () =>
    {
        expect(eyeHeight(walker(0, 0), false)).toBeCloseTo(1.6);
        const w = { ...walker(0, 0), vx: 0, vy: -2.4, bob: 0.25 };
        expect(eyeHeight(w, false)).toBeGreaterThan(1.6);
        expect(eyeHeight(w, true)).toBeCloseTo(1.6);
    });
});
