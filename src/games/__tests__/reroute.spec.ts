import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, POWER, SYSTEMS, adjust, effectiveNeed, freePower, incidentInterval, needInterval, newGame, pickNeeds, score, step } from '../reroute';

const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const total = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('reroute', () =>
{
    it('picks demands in range with tension', () =>
    {
        for (let i = 0; i < 50; i++)
        {
            const need = pickNeeds(Math.random);
            expect(need).toHaveLength(SYSTEMS.length);
            expect(need.every(n => n >= 0 && n <= MAX_LEVEL)).toBe(true);
            expect(total(need)).toBeGreaterThanOrEqual(POWER - 1);
        }
        expect(pickNeeds(() => 0)).toEqual([2, 2, 2]);
    });

    it('starts balanced and full', () =>
    {
        const s = newGame(Math.random);
        expect(s.alloc).toEqual([2, 2, 2]);
        expect(freePower(s)).toBe(0);
        expect(s.integrity).toEqual([100, 100, 100]);
    });

    it('adjust respects the power budget and level limits', () =>
    {
        const s = newGame(Math.random);
        expect(adjust(s, 0, 1)).toBe(s);
        const lowered = adjust(s, 1, -1);
        expect(lowered.alloc).toEqual([2, 1, 2]);
        expect(adjust(lowered, 0, 1).alloc).toEqual([3, 1, 2]);
        let low = s;
        for (let i = 0; i < 5; i++) low = adjust(low, 0, -1);
        expect(low.alloc[0]).toBe(0);
        expect(adjust(s, 9, 1)).toBe(s);
    });

    it('unmet demand damages and met demand repairs', () =>
    {
        let s = { ...newGame(Math.random), need: [4, 0, 2], alloc: [2, 2, 2], integrity: [100, 50, 100] };
        s = step(s, 1000, Math.random).state;
        expect(s.integrity[0]).toBeCloseTo(100 - 2 * 9);
        expect(s.integrity[1]).toBeCloseTo(53);
        expect(s.integrity[2]).toBe(100);
    });

    it('loses when a system fails and then stops', () =>
    {
        let s = { ...newGame(Math.random), need: [4, 0, 0], alloc: [0, 2, 2] };
        const r = step(s, 60_000, Math.random);
        expect(r.state.phase).toBe('lost');
        expect(r.events).toEqual(['lost']);
        expect(step(r.state, 1000, Math.random).events).toEqual([]);
        expect(adjust(r.state, 0, 1)).toBe(r.state);
    });

    it('changes demands on its timer and speeds up', () =>
    {
        let s = { ...newGame(Math.random), need: [2, 2, 2], needTimerMs: 100 };
        const r = step(s, 200, seq(0.9, 0.5, 0.5, 0.5));
        expect(r.events).toEqual(['demand']);
        expect(r.state.needTimerMs).toBeGreaterThan(0);
        expect(needInterval(1_000_000)).toBe(3000);
        expect(needInterval(0)).toBeGreaterThan(needInterval(100_000));
    });

    it('scores whole seconds survived', () =>
    {
        const s = { ...newGame(Math.random), need: [2, 2, 2] };
        expect(score(step(s, 4500, Math.random).state)).toBe(4);
    });
});

describe('reroute incidents', () =>
{
    // 0..1/3 door fault, 1/3..2/3 sensor alarm, 2/3..1 vent leak
    const calm = { ...newGame(() => 0), need: [2, 2, 2], alloc: [2, 2, 2], needTimerMs: 1e9 };
    const due = (over = {}) => ({ ...calm, incidentTimerMs: 10, ...over });

    it('does not start before the first interval', () =>
    {
        expect(newGame(() => 0).incidentTimerMs).toBeGreaterThanOrEqual(15000);
        expect(step(calm, 1000, () => 0).events).toEqual([]);
    });

    it('a door fault takes a quarter of PUERTAS but never kills by itself', () =>
    {
        const r = step(due(), 100, () => 0.1);
        expect(r.events).toEqual(['doorFault']);
        expect(r.state.integrity[0]).toBe(75);
        const low = step(due({ integrity: [20, 100, 100] }), 100, () => 0.1);
        expect(low.state.integrity[0]).toBe(5);
        expect(low.state.phase).toBe('playing');
    });

    it('a sensor alarm doubles what SENSORES asks for, for a while', () =>
    {
        const r = step(due({ need: [2, 2, 1] }), 100, () => 0.5);
        expect(r.events).toEqual(['sensorAlarm']);
        expect(effectiveNeed(r.state)).toEqual([2, 2, 2]);
        expect(effectiveNeed({ ...r.state, need: [2, 2, 3] })[2]).toBe(MAX_LEVEL);
        const later = step(r.state, 9000, () => 0.5).state;
        expect(later.sensorAlarmMs).toBe(0);
        expect(effectiveNeed(later)).toEqual(later.need);
    });

    it('the extra demand hurts SENSORES when it is not met', () =>
    {
        const alarm = due({ need: [2, 2, 1], alloc: [2, 2, 1] });
        let s = step(alarm, 100, () => 0.5).state;
        s = step(s, 1000, () => 0.5).state;
        expect(s.integrity[2]).toBeLessThan(100);
    });

    it('a vent leak bleeds SOPORTE VITAL even when it has its power', () =>
    {
        const r = step(due(), 100, () => 0.9);
        expect(r.events).toEqual(['ventLeak']);
        const after = step(r.state, 1000, () => 0.9).state;
        expect(after.integrity[1]).toBeLessThan(100);
        expect(after.integrity[0]).toBe(100);
    });

    it('incidents come closer together as the run goes on, never under the minimum', () =>
    {
        expect(incidentInterval(0, () => 0)).toBeGreaterThan(incidentInterval(200_000, () => 0));
        expect(incidentInterval(10_000_000, () => 0)).toBe(8000);
    });
});
