import { describe, expect, it } from 'vitest';
import { MAX_DOORS, alienSpeed, newGame, pingInterval, seal, step } from '../tracker';

const rng0 = () => 0;
const fixed = (v: number) => () => v;

describe('tracker', () =>
{
    it('starts far away with all doors', () =>
    {
        const s = newGame(rng0);
        expect(s).toMatchObject({ phase: 'playing', dist: 1, doors: MAX_DOORS, score: 0 });
    });

    it('approaches over time and loses at zero', () =>
    {
        let s = newGame(rng0);
        let lost = false;
        for (let i = 0; i < 400 && !lost; i++)
        {
            const r = step(s, 100, fixed(0.9));
            s = r.state;
            lost = r.events.includes('lost');
        }
        expect(lost).toBe(true);
        expect(s.phase).toBe('lost');
        expect(step(s, 100, rng0).events).toEqual([]);
    });

    it('pings faster when closer', () =>
    {
        expect(pingInterval(0.1)).toBeLessThan(pingInterval(1));
        expect(alienSpeed(5)).toBeGreaterThan(alienSpeed(0));
    });

    it('emits a ping that reveals the alien sector', () =>
    {
        const s = newGame(rng0);
        const r = step(s, 700, fixed(0.9));
        expect(r.events).toContain('ping');
        expect(r.state.ping).toMatchObject({ sector: s.sector });
    });

    it('sealing the right sector repels the alien and scores', () =>
    {
        const s = newGame(rng0);
        const r = seal(s, s.sector, fixed(0.5));
        expect(r.result).toBe('hit');
        expect(r.state).toMatchObject({ score: 1, dist: 1, doors: MAX_DOORS - 1 });
    });

    it('sealing the wrong sector wastes a door; no doors does nothing', () =>
    {
        let s = newGame(rng0);
        const wrong = (s.sector + 1) % 6;
        for (let i = 0; i < MAX_DOORS; i++)
        {
            const r = seal(s, wrong, rng0);
            expect(r.result).toBe('miss');
            s = r.state;
        }
        expect(seal(s, wrong, rng0).result).toBe('none');
    });

    it('doors recharge', () =>
    {
        let s = { ...newGame(rng0), doors: 0, dist: 1000 };
        s = step(s, 8100, rng0).state;
        expect(s.doors).toBe(1);
    });
});
