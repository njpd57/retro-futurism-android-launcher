import { describe, expect, it } from 'vitest';
import { birdVertices } from '../figures';
import { dinerLine, DINER_LINES, DINERS, dinersAt, mealAt, MEALS, nextMeal } from '../mess';
import { STRIDE } from '../mesh';
import { biteLift, birdTilt, BITE_S, DIP_S, elbowFor, poseBird, poseSeated, SEAT_H } from '../pose';
import type { V3 } from '../math';
import { BIRD, BIRD_GLASS, TABLE_TOP } from '../world';

const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);

describe('the mess timetable', () =>
{
    it('serves breakfast, lunch and dinner and nothing in between', () =>
    {
        expect(mealAt(at(8, 30))?.name).toBe('DESAYUNO');
        expect(mealAt(at(13))?.name).toBe('ALMUERZO');
        expect(mealAt(at(21, 59))?.name).toBe('CENA');
        expect(mealAt(at(9))).toBeNull();
        expect(mealAt(at(3))).toBeNull();
    });

    it('says when the next meal is, tomorrow after the last one', () =>
    {
        expect(nextMeal(at(10)).meal.name).toBe('ALMUERZO');
        expect(nextMeal(at(10)).at.getHours()).toBe(13);
        const late = nextMeal(at(23));
        expect(late.meal).toBe(MEALS[0]);
        expect(late.at.getDate()).toBe(23);
    });

    it('fills the table at mealtimes', () =>
    {
        expect(dinersAt(at(14))).toBe(DINERS.meal);
        expect(dinersAt(at(17))).toBe(DINERS.between);
        expect(DINERS.meal).toBeGreaterThan(DINERS.between);
    });

    it('gives each diner a line, changing as the table is talked to', () =>
    {
        expect(DINER_LINES).toContain(dinerLine('diner3', 0));
        expect(dinerLine('diner3', 0)).toBe(dinerLine('diner3', 0));
        expect(dinerLine('diner3', 1)).not.toBe(dinerLine('diner3', 0));
    });
});

describe('a seated diner', () =>
{
    const lowest = (parts: ReturnType<typeof poseSeated>) => Math.min(...parts.flatMap(p => [p.a[1], p.b[1]]));
    // legs (6), body, left arm (2), then the right arm: its forearm ends at the hand
    const hand = (parts: ReturnType<typeof poseSeated>) => parts[10].b;

    it('sits on the seat with the feet on the floor', () =>
    {
        const parts = poseSeated({ time: 0, seed: 0, headYaw: 0 });
        expect(lowest(parts)).toBeGreaterThanOrEqual(0);
        expect(lowest(parts)).toBeLessThan(0.06);
        expect(parts[0].a[1]).toBeCloseTo(SEAT_H);
    });

    it('brings the spoon to the mouth once a spoonful and keeps still at time 0', () =>
    {
        const lifts = Array.from({ length: 100 }, (_, i) => biteLift((i / 100) * BITE_S));
        expect(Math.max(...lifts)).toBeCloseTo(1, 1);
        expect(Math.min(...lifts)).toBe(0);
        const rest = hand(poseSeated({ time: 0, seed: 0, headYaw: 0 }));
        const up = hand(poseSeated({ time: 0.72 * BITE_S, seed: 0, headYaw: 0 }));
        expect(up[1]).toBeGreaterThan(rest[1] + 0.3);
        expect(rest[2]).toBeGreaterThan(0.4);
    });

    it('keeps its arms their own length', () =>
    {
        const s: V3 = [0, 1, 0];
        for (const target of [[0.2, 0.8, 0.5], [0, 1.1, 0.2], [0, 1, 3]] as V3[])
        {
            const j = elbowFor(s, target, 0.29, 0.28, [0.5, -1, 0]);
            expect(Math.hypot(j.elbow[0] - s[0], j.elbow[1] - s[1], j.elbow[2] - s[2])).toBeCloseTo(0.29, 5);
            expect(Math.hypot(j.hand[0] - j.elbow[0], j.hand[1] - j.elbow[1], j.hand[2] - j.elbow[2])).toBeCloseTo(0.28, 3);
        }
    });
});

describe('the drinking bird', () =>
{
    it('stands upright at time 0, rocks, and dips once a cycle', () =>
    {
        expect(birdTilt(0)).toBe(0);
        const tilts = Array.from({ length: 900 }, (_, i) => birdTilt(0.001 + (i / 900) * DIP_S));
        expect(Math.max(...tilts)).toBeCloseTo(1.45);
        expect(Math.min(...tilts)).toBeGreaterThan(-0.6);
        expect(tilts.filter(t => t === 1.45).length).toBeGreaterThan(50);
    });

    it('puts its beak at the glass when it dips', () =>
    {
        const beak = poseBird(1.45).at(-1)!.b;
        // the glass is BIRD_GLASS ahead of the bird, 0.23 tall: the beak dips below its rim
        expect(beak[2]).toBeGreaterThan(BIRD_GLASS - 0.045);
        expect(beak[2]).toBeLessThan(BIRD_GLASS + 0.045);
        expect(beak[1]).toBeLessThan(0.23);
        expect(beak[1]).toBeGreaterThan(0.08);
    });

    it('is drawn on the table top', () =>
    {
        const data = birdVertices(1.3);
        expect(data.length % (STRIDE * 3)).toBe(0);
        for (let i = 0; i < data.length; i += STRIDE)
        {
            expect(data[i + 1]).toBeGreaterThanOrEqual(TABLE_TOP - 1e-6);
            expect(Math.hypot(data[i] - BIRD.x, data[i + 2] - BIRD.y)).toBeLessThan(0.5);
        }
    });
});
