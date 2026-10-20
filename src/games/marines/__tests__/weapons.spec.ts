import { describe, expect, it } from 'vitest';
import { parseArena } from '../map';
import { WEAPONS, WEAPON_ORDER, assistTarget, damageAt, flameReach, resolveShot, spreadAt } from '../weapons';
import { seeded } from '../../isolation/rng';

const DEG = Math.PI / 180;
const RIFLE = WEAPONS.rifle;

// a long hall going east, with a pillar half way along the lower row
const MAP = parseArena([
    '###########',
    '#V........#',
    '#P........#',
    '#....#....#',
    '###########',
]);
const G = MAP.grid;
const zero = () => 0.5;

describe('spreadAt', () =>
{
    it('widens from the minimum to the maximum with heat', () =>
    {
        expect(spreadAt(RIFLE, 0)).toBeCloseTo(RIFLE.spreadMin * DEG);
        expect(spreadAt(RIFLE, 1)).toBeCloseTo(RIFLE.spreadMax * DEG);
        expect(spreadAt(RIFLE, 0.5)).toBeGreaterThan(spreadAt(RIFLE, 0));
        expect(spreadAt(RIFLE, 7)).toBeCloseTo(RIFLE.spreadMax * DEG);
        expect(spreadAt(RIFLE, -1)).toBeCloseTo(RIFLE.spreadMin * DEG);
    });
});

describe('assistTarget', () =>
{
    const east = Math.PI / 2;
    const at = (id: number, x: number, y: number) => ({ id, x, y, radius: 0.3 });

    it('picks the target closest to where the shooter looks, within the cone', () =>
    {
        // 4 cells east: one dead ahead, one a few degrees off
        const ahead = at(1, 5.5, 2.5);
        const off = at(2, 5.5, 2.5 - 4 * Math.tan(3 * DEG));
        expect(assistTarget(G, [], 1.5, 2.5, east, [off, ahead], RIFLE)?.id).toBe(1);
        expect(assistTarget(G, [], 1.5, 2.5, east, [off], RIFLE)?.id).toBe(2);
    });

    it('ignores targets outside the cone, out of range, or behind a wall', () =>
    {
        expect(assistTarget(G, [], 1.5, 2.5, east, [at(1, 5.5, 1.5)], RIFLE)).toBeNull();
        expect(assistTarget(G, [], 1.5, 2.5, east, [at(1, 20, 2.5)], { ...RIFLE, range: 5 })).toBeNull();
        // the pillar at (5, 3) is between them
        expect(assistTarget(G, [], 3.5, 3.5, east, [at(1, 7.5, 3.5)], RIFLE)).toBeNull();
        // facing away
        expect(assistTarget(G, [], 1.5, 2.5, -east, [at(1, 5.5, 2.5)], RIFLE)).toBeNull();
    });
});

describe('resolveShot', () =>
{
    const east = Math.PI / 2;
    const at = (id: number, x: number, y: number, radius = 0.3) => ({ id, x, y, radius });

    it('hits a target in line and stops at it', () =>
    {
        const shot = resolveShot(G, [], 1.5, 2.5, east, [at(1, 5.5, 2.5)], RIFLE, 0, zero);
        expect(shot.hitId).toBe(1);
        expect(shot.distance).toBeCloseTo(3.7, 5);
        expect(shot.impactX).toBeCloseTo(5.2, 5);
    });

    it('hits the nearer of two targets in line', () =>
    {
        const shot = resolveShot(G, [], 1.5, 2.5, east, [at(2, 7.5, 2.5), at(1, 4.5, 2.5)], RIFLE, 0, zero);
        expect(shot.hitId).toBe(1);
    });

    it('ends on the wall when nothing is in the way, and not on targets beyond it', () =>
    {
        const miss = resolveShot(G, [], 1.5, 2.5, east, [], RIFLE, 0, zero);
        expect(miss.hitId).toBeNull();
        // the hall ends at x = 10: 8.5 cells away, inside the range
        expect(miss.distance).toBeCloseTo(8.5, 5);

        // behind the pillar, from the lower row
        const hidden = resolveShot(G, [], 1.5, 3.5, east, [at(1, 8.5, 3.5)], { ...RIFLE, assistDeg: 0 }, 0, zero);
        expect(hidden.hitId).toBeNull();
        expect(hidden.distance).toBeCloseTo(3.5, 5);
    });

    it('aims at a target inside the assist cone, then spreads', () =>
    {
        // looking 4 degrees to the side of a target 8 cells away (it is 4.3 degrees wide only at 4 cells)
        const look = east - 4 * DEG;
        const far = at(1, 9.5, 2.5);
        const assisted = resolveShot(G, [], 1.5, 2.5, look, [far], RIFLE, 0, zero);
        expect(assisted.hitId).toBe(1);
        expect(assisted.aim).toBeCloseTo(east, 5);
        // the same look with the assist off misses it
        const manual = resolveShot(G, [], 1.5, 2.5, look, [far], { ...RIFLE, assistDeg: 0 }, 0, zero);
        expect(manual.hitId).toBeNull();
        expect(manual.aim).toBeCloseTo(look, 5);
    });

    it('spreads rounds evenly either side of the aim', () =>
    {
        const rng = seeded(11);
        const spread = 5 * DEG;
        const aims = Array.from({ length: 400 }, () => resolveShot(G, [], 1.5, 2.5, east, [], { ...RIFLE, assistDeg: 0 }, spread, rng).aim - east);
        expect(Math.max(...aims)).toBeLessThanOrEqual(spread + 1e-9);
        expect(Math.min(...aims)).toBeGreaterThanOrEqual(-spread - 1e-9);
        const mean = aims.reduce((a, b) => a + b, 0) / aims.length;
        expect(Math.abs(mean)).toBeLessThan(spread / 5);
    });

    it('loses accuracy with distance: a long shot at full spread misses what a short one hits', () =>
    {
        const rng = seeded(3);
        const spread = RIFLE.spreadMax * DEG;
        const rate = (dist: number) =>
        {
            let hits = 0;
            for (let i = 0; i < 300; i++)
                if (resolveShot(G, [], 1.5, 2.5, east, [at(1, 1.5 + dist, 2.5)], { ...RIFLE, range: 14 }, spread, rng).hitId === 1) hits++;
            return hits / 300;
        };
        expect(rate(2)).toBeGreaterThan(0.95);
        expect(rate(8)).toBeLessThan(rate(2));
    });
});

describe('the arsenal', () =>
{
    it('lists every weapon once, each with sane numbers', () =>
    {
        expect([...WEAPON_ORDER].sort()).toEqual(Object.keys(WEAPONS).sort());
        for (const id of WEAPON_ORDER)
        {
            const w = WEAPONS[id];
            expect(w.id).toBe(id);
            expect(w.mag).toBeGreaterThan(0);
            expect(w.reserveMax).toBeGreaterThanOrEqual(w.mag);
            expect(w.box).toBeGreaterThan(0);
            expect(w.fireMs).toBeGreaterThan(0);
            expect(w.pellets).toBeGreaterThanOrEqual(1);
            expect(w.spreadMax).toBeGreaterThanOrEqual(w.spreadMin);
        }
    });

    it('gives the smartgun a much wider assist than the rifle, and marks its target', () =>
    {
        expect(WEAPONS.smartgun.assistDeg).toBeGreaterThan(WEAPONS.rifle.assistDeg * 3);
        expect(WEAPONS.smartgun.lock).toBe(true);
        expect(WEAPONS.rifle.lock).toBe(false);
        const t = { id: 1, x: 5.5, y: 2.5 - 4 * Math.tan(15 * DEG), radius: 0.3 };
        expect(assistTarget(G, [], 1.5, 2.5, Math.PI / 2, [t], WEAPONS.smartgun)?.id).toBe(1);
        expect(assistTarget(G, [], 1.5, 2.5, Math.PI / 2, [t], RIFLE)).toBeNull();
    });
});

describe('damageAt', () =>
{
    it('is flat for weapons without falloff and drops to a third at the end of the range for the others', () =>
    {
        expect(damageAt(RIFLE, 1)).toBe(RIFLE.damage);
        expect(damageAt(RIFLE, 14)).toBe(RIFLE.damage);
        const sg = WEAPONS.shotgun;
        expect(damageAt(sg, 0)).toBe(sg.damage);
        expect(damageAt(sg, sg.range)).toBeCloseTo(sg.damage * 0.33, 2);
        expect(damageAt(sg, 2 * sg.range)).toBeCloseTo(sg.damage * 0.33, 2);
        expect(damageAt(sg, 3)).toBeGreaterThan(damageAt(sg, 6));
    });

    it('lets the shotgun kill a drone at a couple of cells and not at the end of its range', () =>
    {
        const sg = WEAPONS.shotgun;
        expect(sg.pellets * damageAt(sg, 2)).toBeGreaterThanOrEqual(8);
        expect(sg.pellets * damageAt(sg, sg.range)).toBeLessThan(4);
    });
});

describe('flameReach', () =>
{
    const FLAME = WEAPONS.flamer;
    const east = Math.PI / 2;
    const at = (id: number, x: number, y: number) => ({ id, x, y, radius: 0.3 });

    it('reaches what is in the cone and in range, nearest and farthest alike', () =>
    {
        const r = flameReach(G, [], 1.5, 2.5, east, [at(1, 3.5, 2.5), at(2, 5.0, 2.5)], FLAME);
        expect(r.hits.map(h => h.id)).toEqual([1, 2]);
        expect(r.hits[0].distance).toBeCloseTo(2);
        expect(r.tip).toBeCloseTo(FLAME.range);
    });

    it('misses what is to the side, behind, too far, or behind a wall', () =>
    {
        const side = at(1, 3.5, 2.5 - 2 * Math.tan(30 * DEG));
        const behind = at(2, 0.9, 2.5);
        const far = at(3, 1.5 + FLAME.range + 1, 2.5);
        expect(flameReach(G, [], 1.5, 2.5, east, [side, behind, far], FLAME).hits).toEqual([]);
        // the pillar at (5, 3) hides the target behind it from the shooter standing in the row above... in the same row
        const hidden = flameReach(G, [], 4.5, 3.5, east, [at(1, 6.5, 3.5)], FLAME);
        expect(hidden.hits).toEqual([]);
        expect(hidden.tip).toBeLessThan(1);
    });

    it('catches a target whose body only touches the edge of the cone', () =>
    {
        const edge = at(1, 3.5, 2.5 - 2 * Math.tan((FLAME.coneDeg + 4) * DEG));
        expect(flameReach(G, [], 1.5, 2.5, east, [edge], FLAME).hits.length).toBe(1);
    });

    it('always reaches a target on top of the shooter', () =>
    {
        const r = flameReach(G, [], 1.5, 2.5, east, [at(1, 1.5, 2.5)], FLAME);
        expect(r.hits).toEqual([{ id: 1, distance: 0 }]);
    });
});
