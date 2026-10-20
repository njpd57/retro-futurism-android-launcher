import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { buildField, spawnEnemy, type Enemy } from '../enemies';
import { parseArena } from '../map';
import { MARINE, newSquad, spotNear, stepSquad, type Marine, type Order, type SquadWorld } from '../squad';

// a hall going east with a long wall between its halves, joined only at the east end
const MAP = parseArena([
    '###########',
    '#V........#',
    '#########.#',
    '#P........#',
    '###########',
]);
const G = MAP.grid;
const cell = (x: number, y: number) => y * G.w + x;
const EAST = Math.PI / 2;

function world(px: number, py: number, order: Order = 'follow', enemies: Enemy[] = []): SquadWorld
{
    return { grid: G, closed: [], field: buildField(G, [], cell(Math.floor(px), Math.floor(py))), px, py, yaw: EAST, order, enemies };
}

const marine = (id: number, x: number, y: number, over: Partial<Marine> = {}): Marine =>
    ({ id, name: MARINE.names[id - 1], x, y, hp: MARINE.hp, dirX: 1, dirY: 0, coolMs: 0, flashMs: 1e6, hitMs: 0, moving: false, stuckMs: 0, ...over });

const drone = (x: number, y: number, over: Partial<Enemy> = {}): Enemy => ({ ...spawnEnemy(7, 'drone', G, cell(Math.floor(x), Math.floor(y))), x, y, ...over });

/** Runs `ms` of time in slices of 50 ms. */
function run(marines: Marine[], w: SquadWorld, ms: number, rng = seeded(3))
{
    let shots = 0;
    for (let t = 0; t < ms; t += 50) shots += stepSquad(marines, w, 50, rng).length;
    return shots;
}

describe('newSquad', () =>
{
    it('puts two named marines on open floor beside and behind the player', () =>
    {
        const squad = newSquad(G, [], 3.5, 3.5, EAST);
        expect(squad.map(m => m.name)).toEqual([...MARINE.names]);
        expect(squad.map(m => m.id)).toEqual([1, 2]);
        for (const m of squad)
        {
            expect(m.hp).toBe(MARINE.hp);
            expect(m.x).toBeLessThan(3.5);
            expect(Math.hypot(m.x - 3.5, m.y - 3.5)).toBeGreaterThan(0.4);
            expect(m.y).toBeGreaterThan(3);
            expect(m.y).toBeLessThan(4);
        }
        // in a corridor they stand in line, one behind the other
        expect(squad[0].x).not.toBe(squad[1].x);
    });

    it('finds a spot even squeezed against a wall', () =>
    {
        const at = spotNear(G, [], 1.5, 3.5, EAST, 0);
        expect(Number.isFinite(at.x + at.y)).toBe(true);
        expect(at.x).toBeGreaterThanOrEqual(1);
    });
});

describe('following', () =>
{
    it('catches up with a player who walked away, and keeps close', () =>
    {
        const marines = [marine(1, 1.5, 3.5), marine(2, 1.5, 3.5)];
        const w = world(7.5, 3.5);
        run(marines, w, 4000);
        for (const m of marines) expect(Math.hypot(m.x - 7.5, m.y - 3.5)).toBeLessThan(2.5);
        // and not on top of the player, nor of each other
        for (const m of marines) expect(Math.hypot(m.x - 7.5, m.y - 3.5)).toBeGreaterThan(0.5);
        expect(Math.hypot(marines[0].x - marines[1].x, marines[0].y - marines[1].y)).toBeGreaterThan(0.5);
    });

    it('goes round a wall by the way the player went', () =>
    {
        // in the upper hall, the player below: the way is east and back
        const m = marine(1, 1.5, 1.5);
        const w = world(1.5, 3.5);
        run([m], w, 600);
        expect(m.x).toBeGreaterThan(2.5);
        run([m], w, 12000);
        expect(Math.hypot(m.x - 1.5, m.y - 3.5)).toBeLessThan(3);
    });

    it('stays put when told to hold, however far the player goes', () =>
    {
        const m = marine(1, 3.5, 3.5);
        run([m], world(9.5, 3.5, 'hold'), 3000);
        expect([m.x, m.y]).toEqual([3.5, 3.5]);
        expect(m.moving).toBe(false);
    });

    it('does not stand in the way of the player', () =>
    {
        const m = marine(1, 5.5, 3.5);
        run([m], world(5.6, 3.5), 1000);
        expect(Math.hypot(m.x - 5.6, m.y - 3.5)).toBeGreaterThanOrEqual(0.5);
    });
});

describe('shooting', () =>
{
    it('fires at the nearest creature in plain view, at its cadence, and wounds it', () =>
    {
        const near = drone(6.5, 3.5, { hp: 99 });
        const far = drone(8.5, 3.5, { hp: 99, id: 8 });
        const m = marine(1, 3.5, 3.5);
        const shots = run([m], world(3.5, 3.5, 'hold', [near, far]), 3000);
        expect(shots).toBeGreaterThanOrEqual(3000 / MARINE.fireMs - 2);
        expect(shots).toBeLessThanOrEqual(3000 / MARINE.fireMs + 1);
        expect(near.hp).toBeLessThan(99);
        expect(far.hp).toBe(99);
        // it turns to face it
        expect(m.dirX).toBeGreaterThan(0.9);
    });

    it('misses a share of its rounds, more at a distance', () =>
    {
        const hits = (d: number) =>
        {
            const e = drone(2.5 + d, 3.5, { hp: 1e6 });
            run([marine(1, 2.5, 3.5)], world(2.5, 3.5, 'hold', [e]), 20000, seeded(11));
            return 1e6 - e.hp;
        };
        const close = hits(2);
        const away = hits(7);
        expect(close).toBeGreaterThan(away);
        expect(away).toBeGreaterThan(5);
        expect(close).toBeLessThan(20000 / MARINE.fireMs);
    });

    it('does not shoot what is behind a wall, out of range, or already dead', () =>
    {
        const m = marine(1, 3.5, 3.5);
        const behind = drone(3.5, 1.5, { hp: 99 });
        const far = drone(3.5 + MARINE.range + 1, 3.5, { hp: 99, id: 8 });
        const dead = drone(5.5, 3.5, { hp: 0, id: 9 });
        expect(run([m], world(3.5, 3.5, 'hold', [behind, far, dead]), 2000)).toBe(0);
    });

    it('leaves a creature that is clinging to the player to the player', () =>
    {
        const clinging = drone(3.5, 3.5, { hp: 99, clung: true });
        expect(run([marine(1, 2.5, 3.5)], world(3.5, 3.5, 'hold', [clinging]), 1500)).toBe(0);
    });

    it('does nothing once down', () =>
    {
        const m = marine(1, 3.5, 3.5, { hp: 0 });
        const e = drone(6.5, 3.5, { hp: 99 });
        expect(run([m], world(9.5, 3.5, 'follow', [e]), 1500)).toBe(0);
        expect([m.x, m.y]).toEqual([3.5, 3.5]);
    });

    it('reports where each round went, a miss ending in a wall at worst', () =>
    {
        const e = drone(6.5, 3.5, { hp: 1e6 });
        const m = marine(1, 3.5, 3.5);
        const rng = seeded(4);
        const all = [];
        for (let t = 0; t < 4000; t += 50) all.push(...stepSquad([m], world(3.5, 3.5, 'hold', [e]), 50, rng));
        expect(all.length).toBeGreaterThan(5);
        expect(all.some(s => s.hit)).toBe(true);
        expect(all.some(s => !s.hit)).toBe(true);
        for (const s of all)
        {
            expect(s.marine).toBe(1);
            expect(Number.isFinite(s.x2 + s.y2)).toBe(true);
            expect(s.x2).toBeGreaterThan(0.9);
            expect(s.x2).toBeLessThan(10.1);
            expect(s.y2).toBeGreaterThan(2.9);
            expect(s.y2).toBeLessThan(4.1);
        }
    });
});
