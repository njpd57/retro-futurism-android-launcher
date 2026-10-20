import { describe, expect, it } from 'vitest';
import { BEAT_COLUMN_MS, POD_FLOOR_C, POD_START_C, heartbeatLine, podTemp, stasisActive, vitals, wakeCountdown } from '../stasis';

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);
const HOUR = 3_600_000;

describe('stasisActive', () =>
{
    it('needs night and an alarm coming up', () =>
    {
        const now = at(23);
        expect(stasisActive(now, now.getTime() + 7 * HOUR)).toBe(true);
        expect(stasisActive(at(15), at(15).getTime() + 7 * HOUR)).toBe(false);
        expect(stasisActive(now, null)).toBe(false);
    });

    it('ignores an alarm that has passed or is too far away', () =>
    {
        const now = at(23);
        expect(stasisActive(now, now.getTime() - 1000)).toBe(false);
        expect(stasisActive(now, now.getTime() + 15 * HOUR)).toBe(false);
        expect(stasisActive(now, now.getTime() + 14 * HOUR)).toBe(true);
    });
});

describe('wakeCountdown', () =>
{
    it('formats hours, minutes and seconds', () =>
    {
        expect(wakeCountdown(0, 6 * HOUR + 42 * 60_000 + 11_000)).toBe('06:42:11');
        expect(wakeCountdown(0, 1000)).toBe('00:00:01');
    });

    it('rounds up to the next second and stops at zero', () =>
    {
        expect(wakeCountdown(0, 500)).toBe('00:00:01');
        expect(wakeCountdown(5000, 1000)).toBe('00:00:00');
    });
});

describe('vitals', () =>
{
    it('stay in a sleeping range and are deterministic', () =>
    {
        for (let i = 0; i < 200; i++)
        {
            const v = vitals(i * 37_000, 3);
            expect(v.bpm).toBeGreaterThanOrEqual(42);
            expect(v.bpm).toBeLessThanOrEqual(48);
            expect(v.resp).toBeGreaterThanOrEqual(8);
            expect(v.resp).toBeLessThanOrEqual(11);
        }
        expect(vitals(123_456, 1)).toEqual(vitals(123_456, 1));
    });
});

describe('heartbeatLine', () =>
{
    it('is as wide as asked and made of the trace characters', () =>
    {
        const line = heartbeatLine(1_000_000, 45, 24);
        expect(line).toHaveLength(24);
        expect(line).toMatch(/^[▁▃▅█]+$/);
    });

    it('has about one spike per beat and drifts left over time', () =>
    {
        const beatMs = 60_000 / 45;
        const width = Math.ceil(beatMs / BEAT_COLUMN_MS) * 3;
        const line = heartbeatLine(10_000_000, 45, width);
        expect((line.match(/█/g) ?? []).length).toBeGreaterThanOrEqual(2);
        const later = heartbeatLine(10_000_000 + BEAT_COLUMN_MS, 45, width);
        expect(later.slice(0, -1)).toBe(line.slice(1));
    });
});

describe('podTemp', () =>
{
    it('starts at body heat and settles near the floor', () =>
    {
        expect(podTemp(1000, 1000)).toBeCloseTo(POD_START_C, 5);
        expect(podTemp(1000 + 8 * HOUR, 1000)).toBeCloseTo(POD_FLOOR_C, 1);
    });

    it('only goes down', () =>
    {
        expect(podTemp(60_000, 0)).toBeLessThan(podTemp(0, 0));
        expect(podTemp(600_000, 0)).toBeLessThan(podTemp(60_000, 0));
        expect(podTemp(-5000, 0)).toBe(POD_START_C);
    });
});
