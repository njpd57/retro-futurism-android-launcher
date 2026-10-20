import { describe, expect, it } from 'vitest';
import { ENEMIES, buildField, downhill, separate, spawnEnemy, stepEnemies, type Enemy, type Strike } from '../enemies';
import { parseArena } from '../map';

// two halls joined only at the east end, with a long wall between them: the way round is the only way
const MAP = parseArena([
    '###########',
    '#V........#',
    '#########.#',
    '#P........#',
    '###########',
]);
const G = MAP.grid;
const DRONE = ENEMIES.drone;
const cell = (x: number, y: number) => y * G.w + x;

function world(px: number, py: number)
{
    return { grid: G, closed: [] as number[], field: buildField(G, [], cell(Math.floor(px), Math.floor(py))), px, py };
}

const drone = (x: number, y: number, over: Partial<Enemy> = {}): Enemy => ({ ...spawnEnemy(1, 'drone', G, cell(Math.floor(x), Math.floor(y))), x, y, ...over });

describe('the distance field', () =>
{
    it('counts steps through open space and leaves walls out', () =>
    {
        const f = buildField(G, [], cell(1, 3));
        expect(f.dist[cell(1, 3)]).toBe(0);
        expect(f.dist[cell(2, 3)]).toBe(1);
        expect(f.dist[cell(0, 0)]).toBe(-1);
        // the upper hall is only reachable round the east end
        expect(f.dist[cell(1, 1)]).toBeGreaterThan(10);
    });

    it('leads downhill to the next cell on the way', () =>
    {
        const f = buildField(G, [], cell(1, 3));
        expect(downhill(G, f, cell(3, 3))).toBe(cell(2, 3));
        // the cell above the wall leads east, away from the player it can see
        expect(downhill(G, f, cell(1, 1))).toBe(cell(2, 1));
        // nowhere to go from a walled-in cell
        expect(downhill(G, f, cell(0, 0))).toBe(-1);
    });
});

describe('stepEnemies', () =>
{
    it('runs straight at the player in plain view', () =>
    {
        const e = drone(8.5, 3.5);
        stepEnemies([e], world(2.5, 3.5), 100);
        expect(e.x).toBeCloseTo(8.5 - DRONE.speed * 0.1, 5);
        expect(e.y).toBeCloseTo(3.5, 5);
        expect(e.moving).toBe(true);
        expect(e.dirX).toBeLessThan(0);
    });

    it('goes the long way round a wall instead of pushing against it', () =>
    {
        // above the player, with the wall between: it must go east first
        const e = drone(1.5, 1.5);
        const w = world(1.5, 3.5);
        const start = { x: e.x, y: e.y };
        for (let i = 0; i < 40; i++) stepEnemies([e], w, 50);
        expect(e.x).toBeGreaterThan(start.x + 1);
        // and it gets there in the end
        for (let i = 0; i < 400; i++) stepEnemies([e], w, 50);
        expect(Math.hypot(e.x - 1.5, e.y - 3.5)).toBeLessThan(DRONE.reach);
    });

    it('stops at striking distance and strikes after the warning, then waits', () =>
    {
        const e = drone(2.4, 3.5);
        const w = world(1.5, 3.5);
        // it is within reach already: wind up for windupMs, then land the blow
        let landed: Strike[] = [];
        let t = 0;
        while (!landed.length && t < 2000)
        {
            landed = stepEnemies([e], w, 50);
            t += 50;
        }
        expect(landed.map(l => l.damage)).toEqual([DRONE.damage]);
        expect(landed[0]).toMatchObject({ target: null, grab: false });
        expect(t).toBeGreaterThanOrEqual(DRONE.windupMs);
        expect(t).toBeLessThanOrEqual(DRONE.windupMs + 100);
        expect(e.moving).toBe(false);
        // it waits out the cooldown before the next
        expect(stepEnemies([e], w, 50)).toEqual([]);
        let second = 0;
        for (let k = 0; k < 40 && !second; k++) second = stepEnemies([e], w, 50).length ? k + 1 : 0;
        expect(second * 50).toBeGreaterThanOrEqual(DRONE.cooldownMs - 50);
    });

    it('never walks into the player', () =>
    {
        const e = drone(5.5, 3.5);
        const w = world(2.5, 3.5);
        for (let i = 0; i < 100; i++) stepEnemies([e], w, 50);
        const d = Math.hypot(e.x - 2.5, e.y - 3.5);
        expect(d).toBeGreaterThan(DRONE.reach * 0.8);
        expect(d).toBeLessThanOrEqual(DRONE.reach);
    });

    it('cancels a strike that was winding up when the player gets away', () =>
    {
        const e = drone(2.4, 3.5);
        // first it closes in, then it winds up
        stepEnemies([e], world(1.5, 3.5), 100);
        stepEnemies([e], world(1.5, 3.5), 100);
        expect(e.windMs).toBeGreaterThanOrEqual(0);
        stepEnemies([e], world(6.5, 3.5), 50);
        expect(e.windMs).toBe(-1);
    });
});

describe('separate', () =>
{
    it('pushes overlapping creatures apart, along the line between them', () =>
    {
        const a = drone(4.5, 3.5, { id: 1 });
        const b = drone(4.7, 3.5, { id: 2 });
        separate([a, b], G, []);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.54);
        expect(a.x).toBeLessThan(b.x);
    });

    it('splits two on exactly the same point', () =>
    {
        const a = drone(4.5, 3.5, { id: 1 });
        const b = drone(4.5, 3.5, { id: 2 });
        separate([a, b], G, []);
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.5);
        expect(Number.isFinite(a.x + a.y + b.x + b.y)).toBe(true);
    });

    it('leaves creatures that are apart alone and keeps them out of walls', () =>
    {
        const a = drone(4.5, 3.5, { id: 1 });
        const b = drone(6.5, 3.5, { id: 2 });
        separate([a, b], G, []);
        expect([a.x, b.x]).toEqual([4.5, 6.5]);
        // squeezed against the south wall they do not end up inside it
        const c = drone(4.5, 3.7, { id: 3 });
        const d = drone(4.6, 3.7, { id: 4 });
        separate([c, d], G, []);
        expect(c.y).toBeLessThanOrEqual(3.7);
        expect(d.y).toBeLessThanOrEqual(3.7);
    });
});

describe('the other creatures', () =>
{
    const RUNNER = ENEMIES.runner;
    const HUGGER = ENEMIES.hugger;
    const as = (kind: 'runner' | 'hugger', x: number, y: number, over: Partial<Enemy> = {}): Enemy =>
        ({ ...spawnEnemy(2, kind, G, cell(Math.floor(x), Math.floor(y))), x, y, ...over });

    it('runs faster than a drone, and faster than the player can', () =>
    {
        const e = as('runner', 8.5, 3.5);
        stepEnemies([e], world(2.5, 3.5), 100);
        expect(8.5 - e.x).toBeCloseTo(RUNNER.speed * 0.1, 5);
        expect(RUNNER.speed).toBeGreaterThan(DRONE.speed);
        expect(RUNNER.hp).toBeLessThan(DRONE.hp);
    });

    it('leaps from farther away, after its crouch, and the landed strike is a grab', () =>
    {
        const e = as('hugger', 3.9, 3.5);
        const w = world(2.5, 3.5);
        let landed: Strike[] = [];
        let t = 0;
        while (!landed.length && t < 3000)
        {
            landed = stepEnemies([e], w, 50);
            t += 50;
        }
        expect(landed).toHaveLength(1);
        expect(landed[0]).toMatchObject({ target: null, grab: true });
        expect(t).toBeGreaterThanOrEqual(HUGGER.windupMs);
        expect(HUGGER.reach).toBeGreaterThan(DRONE.reach * 1.5);
    });

    it('lands a grab as an ordinary blow on a marine', () =>
    {
        const e = as('hugger', 3.9, 3.5);
        const w = { ...world(9.5, 3.5), marines: [{ id: 1, x: 2.8, y: 3.5 }] };
        let landed: Strike[] = [];
        for (let t = 0; !landed.length && t < 3000; t += 50) landed = stepEnemies([e], w, 50);
        expect(landed[0]).toMatchObject({ target: 1, grab: false, damage: HUGGER.damage });
    });

    it('rides on the player once it clings, and takes no part in the crowd', () =>
    {
        const e = as('hugger', 5.5, 3.5, { clung: true });
        const other = drone(4.0, 3.5, { id: 9 });
        const w = world(2.5, 3.5);
        expect(stepEnemies([e, other], w, 50)).toEqual([]);
        expect([e.x, e.y]).toEqual([2.5, 3.5]);
        expect(e.moving).toBe(false);
        // standing right on a drone, it is not pushed about
        const near = drone(2.6, 3.5, { id: 10, coolMs: 1e9 });
        stepEnemies([e, near], w, 50);
        expect([e.x, e.y]).toEqual([2.5, 3.5]);
    });
});

describe('going for a marine', () =>
{
    it('turns on a marine that is nearer than the player and in plain view', () =>
    {
        const e = drone(6.5, 3.5);
        const w = { ...world(1.5, 3.5), marines: [{ id: 2, x: 5.0, y: 3.5 }] };
        let landed: Strike[] = [];
        for (let t = 0; !landed.length && t < 3000; t += 50) landed = stepEnemies([e], w, 50);
        expect(landed[0]).toMatchObject({ target: 2, grab: false, damage: DRONE.damage });
    });

    it('keeps after the player when the marine is far, behind a wall, or farther than the player', () =>
    {
        // far: beyond the notice distance
        const far = drone(6.5, 3.5);
        stepEnemies([far], { ...world(2.5, 3.5), marines: [{ id: 1, x: 9.5, y: 3.5 }] }, 100);
        expect(far.x).toBeLessThan(6.5);
        // behind the wall between the halls: the drone in the upper hall does not see it
        const up = drone(5.5, 1.5);
        stepEnemies([up], { ...world(1.5, 3.5), marines: [{ id: 1, x: 5.5, y: 3.5 }] }, 100);
        expect(up.x).toBeGreaterThan(5.5);
        // the player is the nearer
        const near = drone(3.0, 3.5);
        const w = { ...world(2.2, 3.5), marines: [{ id: 1, x: 4.5, y: 3.5 }] };
        let landed: Strike[] = [];
        for (let t = 0; !landed.length && t < 3000; t += 50) landed = stepEnemies([near], w, 50);
        expect(landed[0].target).toBeNull();
    });
});
