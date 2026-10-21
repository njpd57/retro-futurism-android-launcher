import { describe, expect, it } from 'vitest';
import { PRESS_MIN_MS, animEnabled, noiseParams, pressHoldLeft, stepAt, tweenValue, typeDuration, typedLength, typewriterAdvance } from '../anim';

const on = { text: true, transitions: true, ambient: false };

describe('animEnabled', () =>
{
    it('follows the toggle of each category', () =>
    {
        expect(animEnabled('text', on, false)).toBe(true);
        expect(animEnabled('ambient', on, false)).toBe(false);
    });

    it('turns everything off under reduced motion', () =>
    {
        expect(animEnabled('text', on, true)).toBe(false);
        expect(animEnabled('transitions', on, true)).toBe(false);
    });
});

describe('stepAt', () =>
{
    it('moves in whole steps and holds the last one', () =>
    {
        expect(stepAt(0, 400, 4)).toBe(0);
        expect(stepAt(99, 400, 4)).toBe(0);
        expect(stepAt(100, 400, 4)).toBe(1);
        expect(stepAt(399, 400, 4)).toBe(3);
        expect(stepAt(400, 400, 4)).toBe(4);
        expect(stepAt(9999, 400, 4)).toBe(4);
        expect(stepAt(-50, 400, 4)).toBe(0);
    });

    it('jumps to the end when there is no duration', () =>
    {
        expect(stepAt(0, 0, 4)).toBe(4);
    });
});

describe('typedLength', () =>
{
    it('reveals characters at the given rate, never more than the text', () =>
    {
        expect(typedLength(10, 0, 20)).toBe(0);
        expect(typedLength(10, 100, 20)).toBe(2);
        expect(typedLength(10, 5000, 20)).toBe(10);
    });

    it('shows everything when the rate is zero', () =>
    {
        expect(typedLength(10, 0, 0)).toBe(10);
    });
});

describe('typeDuration', () =>
{
    it('is proportional to the length and capped', () =>
    {
        expect(typeDuration(40, 40)).toBe(1000);
        expect(typeDuration(4000, 40)).toBe(1500);
        expect(typeDuration(4000, 40, 800)).toBe(800);
        expect(typeDuration(10, 0)).toBe(0);
    });
});

describe('typewriterAdvance', () =>
{
    it('types at the given rate when it is not behind', () =>
    {
        expect(typewriterAdvance(0, 1000, 100, 50)).toBeCloseTo(5 + 0.1 * 1000 * 2, 5);
        expect(typewriterAdvance(0, 4, 100, 50)).toBeCloseTo(5.4 > 4 ? 4 : 5.4, 5);
    });

    it('speeds up the further behind it is', () =>
    {
        const near = typewriterAdvance(90, 100, 100, 50) - 90;
        const far = typewriterAdvance(0, 400, 100, 50);
        expect(far).toBeGreaterThan(near * 3);
    });

    it('never passes the end and keeps going as the text grows', () =>
    {
        expect(typewriterAdvance(9.9, 10, 1000, 50)).toBe(10);
        expect(typewriterAdvance(10, 10, 16, 50)).toBe(10);
        expect(typewriterAdvance(10, 40, 100, 50)).toBeGreaterThan(10);
    });

    it('does not move without time or rate, and tolerates a shrinking text', () =>
    {
        expect(typewriterAdvance(3, 10, 0, 50)).toBe(3);
        expect(typewriterAdvance(3, 10, 100, 0)).toBe(3);
        expect(typewriterAdvance(12, 10, 100, 50)).toBe(10);
    });
});

describe('pressHoldLeft', () =>
{
    it('keeps a quick tap lit for the minimum time', () =>
    {
        expect(pressHoldLeft(1000, 1030)).toBe(PRESS_MIN_MS - 30);
        expect(pressHoldLeft(1000, 1000)).toBe(PRESS_MIN_MS);
    });

    it('lets a long press go at once', () =>
    {
        expect(pressHoldLeft(1000, 1000 + PRESS_MIN_MS)).toBe(0);
        expect(pressHoldLeft(1000, 5000)).toBe(0);
    });
});

describe('noiseParams', () =>
{
    it('is stable for a seed and differs between seeds', () =>
    {
        expect(noiseParams('clock-1')).toEqual(noiseParams('clock-1'));
        const all = ['a', 'b', 'c', 'd', 'e', 'f'].map(k => JSON.stringify(noiseParams(k)));
        expect(new Set(all).size).toBeGreaterThan(3);
    });

    it('stays inside its ranges', () =>
    {
        for (const seed of ['', 'x', 'w1', 'a long widget id 42', 'ñ'])
        {
            const n = noiseParams(seed);
            expect(n.y).toBeGreaterThanOrEqual(12);
            expect(n.y).toBeLessThanOrEqual(88);
            expect(n.durS).toBeGreaterThanOrEqual(13);
            expect(n.durS).toBeLessThanOrEqual(27);
            expect(n.delayS).toBeLessThanOrEqual(0);
            expect(n.delayS).toBeGreaterThanOrEqual(-n.durS);
        }
    });
});

describe('tweenValue', () =>
{
    it('counts linearly in whole numbers and holds the end', () =>
    {
        expect(tweenValue(10, 50, 0, 400)).toBe(10);
        expect(tweenValue(10, 50, 200, 400)).toBe(30);
        expect(tweenValue(10, 50, 400, 400)).toBe(50);
        expect(tweenValue(10, 50, 9999, 400)).toBe(50);
    });

    it('counts down too and jumps without a duration', () =>
    {
        expect(tweenValue(100, 0, 100, 400)).toBe(75);
        expect(tweenValue(10, 50, 0, 0)).toBe(50);
    });
});
