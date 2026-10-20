import { describe, expect, it } from 'vitest';
import { STICK, stickAxes } from '../stick';

const R = STICK.radius;

describe('stickAxes', () =>
{
    it('asks for nothing at rest or inside the dead zone, though the knob follows the thumb', () =>
    {
        expect(stickAxes(0, 0)).toEqual({ strafe: 0, forward: 0, knobX: 0, knobY: 0 });
        const a = stickAxes(R * STICK.dead * 0.9, 0);
        expect(a.strafe).toBe(0);
        expect(a.forward).toBe(0);
        expect(a.knobX).toBeCloseTo(R * STICK.dead * 0.9);
    });

    it('up is forward, down is back, right is to the right (the screen\'s y grows downwards)', () =>
    {
        expect(stickAxes(0, -R).forward).toBeCloseTo(1);
        expect(stickAxes(0, R).forward).toBeCloseTo(-1);
        expect(stickAxes(R, 0).strafe).toBeCloseTo(1);
        expect(stickAxes(-R, 0).strafe).toBeCloseTo(-1);
        // straight up has no sideways part
        expect(stickAxes(0, -R).strafe).toBeCloseTo(0);
    });

    it('goes from zero at the edge of the dead zone to full at the radius', () =>
    {
        const edge = stickAxes(R * STICK.dead + 1e-6, 0).strafe;
        expect(edge).toBeCloseTo(0, 3);
        let prev = 0;
        for (const f of [0.3, 0.5, 0.7, 0.9, 1])
        {
            const s = stickAxes(R * f, 0).strafe;
            expect(s).toBeGreaterThan(prev);
            prev = s;
        }
        expect(prev).toBeCloseTo(1);
    });

    it('a light push is slower than a hard one', () =>
    {
        expect(stickAxes(0, -R * 0.4).forward).toBeLessThan(stickAxes(0, -R * 0.8).forward);
        expect(stickAxes(0, -R * 0.4).forward).toBeGreaterThan(0);
    });

    it('is no faster diagonally, nor past the radius', () =>
    {
        for (const [dx, dy] of [[R, R], [-3 * R, 2 * R], [R * 0.6, -R * 0.6], [500, -500]])
        {
            const a = stickAxes(dx, dy);
            expect(Math.hypot(a.strafe, a.forward)).toBeLessThanOrEqual(1 + 1e-9);
            expect(Math.hypot(a.knobX, a.knobY)).toBeLessThanOrEqual(R + 1e-9);
        }
        // pushed far past the radius it is still full speed in that direction
        const far = stickAxes(0, -10 * R);
        expect(far.forward).toBeCloseTo(1);
        expect(far.knobY).toBeCloseTo(-R);
    });

    it('keeps the direction of the drag', () =>
    {
        const a = stickAxes(R * 0.5, -R * 0.5);
        expect(a.strafe).toBeGreaterThan(0);
        expect(a.forward).toBeGreaterThan(0);
        expect(a.strafe).toBeCloseTo(a.forward);
    });

    it('survives nonsense', () =>
    {
        expect(stickAxes(NaN, 5)).toEqual({ strafe: 0, forward: 0, knobX: 0, knobY: 0 });
        expect(stickAxes(Infinity, 0)).toEqual({ strafe: 0, forward: 0, knobX: 0, knobY: 0 });
    });
});
