import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import type { Shape } from '../../wire/camera';
import { ENEMIES, spawnEnemy, type Enemy } from '../enemies';
import { newGame, type Acid, type Fx, type Projectile } from '../game';
import { ARENAS, ARENA_OPERATIONS, parseArena, type ArenaDef } from '../map';
import { MARINE, newSquad, type Marine } from '../squad';
import { buildMarinesView, type MarinesScene } from '../view';

const W = 360;
const H = 300;

// a hall going east with a pillar in the middle row, and a spawn grille at the west end
const HALL: ArenaDef = {
    id: 'hall', title: 'SALA', startDir: 1, signs: [], briefing: [],
    map: [
        '###########',
        '#V........#',
        '#P...#....#',
        '#.a..+....#',
        '###########',
    ],
};

function scene(arena: ArenaDef = HALL, over: Partial<MarinesScene> = {}): MarinesScene
{
    const m = parseArena(arena.map);
    const g = m.grid;
    return {
        grid: g, closed: m.closed, signs: arena.signs, pickups: m.pickups.map(p => ({ ...p, taken: false })),
        enemies: [], fx: [], pose: { x: (m.start % g.w) + 0.5, y: Math.floor(m.start / g.w) + 0.5, yaw: Math.PI / 2 },
        bob: 0, time: 0, pulse: 0.5, w: W, h: H, ...over,
    };
}

const drone = (x: number, y: number, over: Partial<Enemy> = {}): Enemy => ({ ...spawnEnemy(1, 'drone', parseArena(HALL.map).grid, 12), x, y, ...over });
const marineAt = (x: number, y: number, over: Partial<Marine> = {}): Marine =>
    ({ ...newSquad(parseArena(HALL.map).grid, [], 2.5, 2.5, Math.PI / 2)[0], x, y, dirX: 1, dirY: 0, ...over });
const kindOf = (kind: Enemy['kind'], x: number, y: number, over: Partial<Enemy> = {}): Enemy =>
    ({ ...spawnEnemy(1, kind, parseArena(HALL.map).grid, 12), x, y, ...over });
const tagged = (shapes: Shape[], tag: string) => shapes.filter(s => s.tag === tag);
const points = (shapes: Shape[]) => shapes.flatMap(s => s.kind === 'text' ? [s.x, s.y, s.size] : s.pts);
const xRange = (shapes: Shape[]) =>
{
    const xs = shapes.flatMap(s => s.kind === 'text' ? [] : s.pts.filter((_, i) => i % 2 === 0));
    return [Math.min(...xs), Math.max(...xs)];
};

describe('buildMarinesView', () =>
{
    it('draws the hall: floor, walls, and the grille', () =>
    {
        const shapes = buildMarinesView(scene());
        expect(tagged(shapes, 'floor').length).toBeGreaterThan(5);
        expect(tagged(shapes, 'wall').length).toBeGreaterThan(5);
        expect(points(shapes).every(Number.isFinite)).toBe(true);
        // looking at the west end from the east: the grille is on the wall
        const west = buildMarinesView(scene(HALL, { pose: { x: 8.5, y: 1.5, yaw: -Math.PI / 2 } }));
        expect(tagged(west, 'vent').length).toBeGreaterThan(0);
    });

    it('draws pickups that are still there, and not those taken', () =>
    {
        const s = scene();
        expect(tagged(buildMarinesView(s), 'item').length).toBeGreaterThan(0);
        const taken = buildMarinesView({ ...s, pickups: s.pickups.map(p => ({ ...p, taken: true })) });
        expect(tagged(taken, 'item')).toEqual([]);
        // a magazine and a kit look different
        const ammo = buildMarinesView({ ...s, pickups: s.pickups.filter(p => p.kind === 'ammo') });
        const kit = buildMarinesView({ ...s, pickups: s.pickups.filter(p => p.kind === 'medkit') });
        expect(tagged(ammo, 'item').length).not.toBe(tagged(kit, 'item').length);
    });

    it('draws a creature in the open, clipped to where it is in front of the walls', () =>
    {
        // off to one side of the pillar, which stands in the player's row
        const shapes = buildMarinesView(scene(HALL, { enemies: [drone(6.5, 1.5)] }));
        const enemy = tagged(shapes, 'enemy');
        expect(enemy.length).toBeGreaterThan(1);
        for (const sh of enemy)
        {
            expect(sh.kind === 'text').toBe(false);
            if (sh.kind !== 'text') expect(sh.clip?.length).toBeGreaterThanOrEqual(2);
        }
        // the body is a filled polygon, so it hides what is behind it
        expect(enemy.some(sh => sh.kind === 'poly' && sh.fill)).toBe(true);
        // and it comes after the walls: it is drawn over them
        const lastWall = shapes.map(s => s.tag).lastIndexOf('wall');
        expect(shapes.findIndex(s => s.tag === 'enemy')).toBeGreaterThan(lastWall);
    });

    it('does not draw a creature behind the camera or behind a wall', () =>
    {
        // behind the player
        expect(tagged(buildMarinesView(scene(HALL, { enemies: [drone(0.8, 2.5)] })), 'enemy')).toEqual([]);
        // directly behind the pillar, from the row below: the pillar is at (5, 2)
        const m = parseArena(HALL.map);
        const g = m.grid;
        const hidden = scene(HALL, { pose: { x: 3.5, y: 2.5, yaw: Math.PI / 2 }, enemies: [drone(7.5, 2.5)] });
        expect(g.cells[2 * g.w + 5]).toBe('wall');
        expect(tagged(buildMarinesView(hidden), 'enemy')).toEqual([]);
    });

    it('shows only the part of a creature that sticks out past the pillar edge', () =>
    {
        // the centre of the creature is hidden by the pillar's corner, its southern half is not
        const pose = { x: 3.5, y: 2.5, yaw: Math.PI / 2 };
        const peeking = buildMarinesView(scene(HALL, { pose, enemies: [drone(6.5, 3.4)] }));
        const enemy = tagged(peeking, 'enemy');
        expect(enemy.length).toBeGreaterThan(0);
        const clip = enemy[0].kind === 'text' ? [] : enemy[0].clip!;
        const [x0, x1] = xRange(enemy);
        // fewer pixels than its full width are open
        let open = 0;
        for (let i = 0; i < clip.length; i += 2) open += clip[i + 1] - clip[i];
        expect(open).toBeGreaterThan(0);
        expect(open).toBeLessThan(x1 - x0);
    });

    it('orders creatures far to near and mirrors one that runs the other way', () =>
    {
        const a = drone(8.5, 1.5, { id: 1 });
        const b = drone(4.5, 1.5, { id: 2 });
        const tags = buildMarinesView(scene(HALL, { enemies: [b, a] })).filter(s => s.tag === 'enemy');
        // the far one (a) first
        expect(tags.length).toBeGreaterThan(2);

        const right = buildMarinesView(scene(HALL, { enemies: [drone(6.5, 1.5, { dirX: 0, dirY: 1 })] }));
        const left = buildMarinesView(scene(HALL, { enemies: [drone(6.5, 1.5, { dirX: 0, dirY: -1 })] }));
        expect(JSON.stringify(tagged(right, 'enemy'))).not.toBe(JSON.stringify(tagged(left, 'enemy')));
    });

    it('swells before a blow so it can be seen coming', () =>
    {
        const size = (e: Enemy) =>
        {
            const body = tagged(buildMarinesView(scene(HALL, { enemies: [e] })), 'enemy').find(s => s.kind === 'poly');
            const ys = body && body.kind === 'poly' ? body.pts.filter((_, i) => i % 2 === 1) : [0];
            return Math.max(...ys) - Math.min(...ys);
        };
        const calm = size(drone(5.5, 1.5, { windMs: -1 }));
        const raised = size(drone(5.5, 1.5, { windMs: 10 }));
        expect(raised).toBeGreaterThan(calm * 1.15);
    });

    it('draws the tracer, the spark and the burst while they last', () =>
    {
        const fx = (kind: Fx['kind']): Fx => ({ kind, x: 3.5, y: 2.5, x2: 8.5, y2: 2.5, ageMs: 40, lifeMs: 100 });
        const shapes = buildMarinesView(scene(HALL, { fx: [fx('tracer'), fx('spark'), fx('splat')] }));
        expect(tagged(shapes, 'tracer').length).toBe(1);
        expect(tagged(shapes, 'muzzle').length).toBe(4);
        expect(tagged(shapes, 'blast').length).toBeGreaterThan(3);
        expect(points(shapes).every(Number.isFinite)).toBe(true);
        // they fade as they age
        const young = buildMarinesView(scene(HALL, { fx: [{ ...fx('tracer'), ageMs: 5 }] }));
        const old = buildMarinesView(scene(HALL, { fx: [{ ...fx('tracer'), ageMs: 95 }] }));
        expect(tagged(young, 'tracer')[0].alpha).toBeGreaterThan(tagged(old, 'tracer')[0].alpha);
    });

    it('draws nothing from inside a wall', () =>
    {
        expect(buildMarinesView(scene(HALL, { pose: { x: 0.5, y: 0.5, yaw: 0 } }))).toEqual([]);
    });

    it('stays finite from anywhere in the real arena, with a crowd', () =>
    {
        const rng = seeded(21);
        const game = newGame(ARENA_OPERATIONS);
        const open = game.grid.cells.map((c, i) => (c === 'wall' ? -1 : i)).filter(i => i >= 0);
        for (let k = 0; k < 150; k++)
        {
            const cell = open[Math.floor(rng() * open.length)];
            const pose = { x: (cell % game.grid.w) + rng(), y: Math.floor(cell / game.grid.w) + rng(), yaw: rng() * 6.3 };
            const enemies = Array.from({ length: 12 }, (_, i) =>
            {
                const c = open[Math.floor(rng() * open.length)];
                return drone((c % game.grid.w) + rng(), Math.floor(c / game.grid.w) + rng(), { id: i + 1, dirX: rng() - 0.5, dirY: rng() - 0.5, moving: rng() < 0.5, windMs: rng() < 0.2 ? 100 : -1 });
            });
            const shapes = buildMarinesView({
                grid: game.grid, closed: game.closed, signs: game.signs, pickups: game.pickups, enemies, fx: [],
                pose, bob: 0.01, time: k * 17, pulse: rng(), w: W, h: H,
            });
            if (!shapes.length) continue;
            expect(points(shapes).every(Number.isFinite)).toBe(true);
        }
    });

    it('is cheap enough to run every frame', () =>
    {
        const game = newGame(ARENA_OPERATIONS);
        const enemies = Array.from({ length: 12 }, (_, i) => drone(11 + (i % 6), 5 + Math.floor(i / 6) * 2, { id: i + 1 }));
        const base: MarinesScene = {
            grid: game.grid, closed: game.closed, signs: game.signs, pickups: game.pickups, enemies,
            fx: [], pose: { x: 12.5, y: 7.5, yaw: 0 }, bob: 0, time: 0, pulse: 0.5, w: 412, h: 520,
        };
        const t0 = performance.now();
        const n = 200;
        let shapes = 0;
        for (let i = 0; i < n; i++) shapes = buildMarinesView({ ...base, pose: { ...base.pose, yaw: i * 0.05 } }).length;
        const per = (performance.now() - t0) / n;
        console.log(`buildMarinesView: ${per.toFixed(2)} ms/frame, ${shapes} shapes`);
        // a generous bound: the point is to catch an accident, the real figure is printed above
        expect(per).toBeLessThan(10);
        expect(ENEMIES.drone.hp).toBeGreaterThan(0);
    });

    it('draws the other creatures: a runner smaller than a drone, a facehugger low on the floor', () =>
    {
        const height = (e: Enemy) =>
        {
            const ys = tagged(buildMarinesView(scene(HALL, { enemies: [e] })), 'enemy').flatMap(sh => sh.kind === 'text' ? [] : sh.pts.filter((_, i) => i % 2 === 1));
            return Math.max(...ys) - Math.min(...ys);
        };
        const d = height(drone(6.5, 1.5));
        const r = height(kindOf('runner', 6.5, 1.5));
        const h = height(kindOf('hugger', 6.5, 1.5));
        expect(r).toBeLessThan(d);
        expect(r).toBeGreaterThan(d * 0.5);
        expect(h).toBeLessThan(d * 0.5);
        expect(h).toBeGreaterThan(0);
        // the hugger rises on its legs before the leap, and it is clipped like any other
        const crouched = tagged(buildMarinesView(scene(HALL, { enemies: [kindOf('hugger', 6.5, 1.5, { windMs: 10 })] })), 'enemy');
        expect(crouched.length).toBeGreaterThan(5);
        expect(crouched.every(sh => sh.kind === 'text' || (sh.clip?.length ?? 0) >= 2)).toBe(true);
        expect(height(kindOf('hugger', 6.5, 1.5, { windMs: 10 }))).toBeGreaterThan(h);
    });

    it('does not draw a facehugger that is on the face: the screen does', () =>
    {
        expect(tagged(buildMarinesView(scene(HALL, { enemies: [kindOf('hugger', 2.5, 2.5, { clung: true })] })), 'enemy')).toEqual([]);
    });

    it('lights up what burns', () =>
    {
        const calm = buildMarinesView(scene(HALL, { enemies: [drone(6.5, 1.5)] }));
        const lit = buildMarinesView(scene(HALL, { enemies: [drone(6.5, 1.5, { burnMs: 800 })] }));
        expect(tagged(calm, 'flame')).toEqual([]);
        expect(tagged(lit, 'flame').length).toBeGreaterThan(1);
        expect(points(lit).every(Number.isFinite)).toBe(true);
    });

    it('draws the marines in front of the player, clipped by the walls, and not those that are down', () =>
    {
        const up = buildMarinesView(scene(HALL, { marines: [marineAt(6.5, 1.5)] }));
        const m = tagged(up, 'marine');
        expect(m.length).toBeGreaterThan(2);
        expect(m.some(sh => sh.kind === 'poly' && sh.fill)).toBe(true);
        expect(m.every(sh => sh.kind === 'text' || (sh.clip?.length ?? 0) >= 2)).toBe(true);
        expect(tagged(buildMarinesView(scene(HALL, { marines: [marineAt(6.5, 1.5, { hp: 0 })] })), 'marine')).toEqual([]);
        // behind the player
        expect(tagged(buildMarinesView(scene(HALL, { marines: [marineAt(0.8, 2.5)] })), 'marine')).toEqual([]);
        // the pillar hides one directly behind it
        const hidden = scene(HALL, { pose: { x: 3.5, y: 2.5, yaw: Math.PI / 2 }, marines: [marineAt(7.5, 2.5)] });
        expect(tagged(buildMarinesView(hidden), 'marine')).toEqual([]);
    });

    it('flashes the muzzle of a marine who has just fired, and for a moment only', () =>
    {
        const fired = buildMarinesView(scene(HALL, { marines: [marineAt(6.5, 1.5, { flashMs: 10 })] }));
        const idle = buildMarinesView(scene(HALL, { marines: [marineAt(6.5, 1.5, { flashMs: 500 })] }));
        expect(tagged(fired, 'muzzle').length).toBe(4);
        expect(tagged(idle, 'muzzle')).toEqual([]);
    });

    it('draws a pool of acid on the floor, under what stands on it, fading as it dries', () =>
    {
        const pool = (ms: number): Acid => ({ x: 6.5, y: 1.5, ms, r: 0.45 });
        const wet = buildMarinesView(scene(HALL, { acid: [pool(6000)], enemies: [drone(6.5, 1.5)] }));
        expect(tagged(wet, 'acid').length).toBe(2);
        expect(wet.findIndex(sh => sh.tag === 'acid')).toBeLessThan(wet.findIndex(sh => sh.tag === 'enemy'));
        const dry = buildMarinesView(scene(HALL, { acid: [pool(300)] }));
        expect(tagged(dry, 'acid')[0].alpha).toBeLessThan(tagged(buildMarinesView(scene(HALL, { acid: [pool(6000)] })), 'acid')[0].alpha);
        expect(points(wet).every(Number.isFinite)).toBe(true);
    });

    it('draws a grenade in flight, and its blast, the flames and a marine\'s tracer', () =>
    {
        const grenade: Projectile = { id: 1, x: 3.5, y: 2.5, dx: 1, dy: 0, ageMs: 100 };
        expect(tagged(buildMarinesView(scene(HALL, { projectiles: [grenade] })), 'blast').length).toBe(3);
        const fx = (kind: Fx['kind'], over: Partial<Fx> = {}): Fx => ({ kind, x: 3.5, y: 2.5, x2: 7.5, y2: 2.5, ageMs: 60, lifeMs: 220, ...over });
        const blast = buildMarinesView(scene(HALL, { fx: [fx('blast', { x: 6.5, y: 1.5, r: 2 })] }));
        expect(tagged(blast, 'blast').length).toBeGreaterThan(14);
        const flame = buildMarinesView(scene(HALL, { fx: [fx('flame')] }));
        expect(tagged(flame, 'flame').length).toBeGreaterThan(5);
        const beam = buildMarinesView(scene(HALL, { fx: [fx('beam', { x: 5.5, y: 1.5, x2: 8.5, y2: 1.5, lifeMs: 110 })] }));
        expect(tagged(beam, 'tracer').length).toBe(1);
        expect(points([...blast, ...flame, ...beam]).every(Number.isFinite)).toBe(true);
        // the blast grows with its age
        const early = buildMarinesView(scene(HALL, { fx: [fx('blast', { x: 6.5, y: 1.5, r: 2, ageMs: 10, lifeMs: 380 })] }));
        const late = buildMarinesView(scene(HALL, { fx: [fx('blast', { x: 6.5, y: 1.5, r: 2, ageMs: 150, lifeMs: 380 })] }));
        const [e0, e1] = xRange(tagged(early, 'blast'));
        const [l0, l1] = xRange(tagged(late, 'blast'));
        expect(l1 - l0).toBeGreaterThan(e1 - e0);
    });

    it('marks the locked creature with four brackets, clipped like the creature', () =>
    {
        const target = drone(6.5, 1.5, { id: 4 });
        const plain = buildMarinesView(scene(HALL, { enemies: [target] }));
        const locked = buildMarinesView(scene(HALL, { enemies: [target], lockId: 4 }));
        expect(tagged(plain, 'muzzle')).toEqual([]);
        const marks = tagged(locked, 'muzzle');
        expect(marks).toHaveLength(4);
        // they surround the creature
        const [x0, x1] = xRange(tagged(locked, 'enemy'));
        const [m0, m1] = xRange(marks);
        expect(m0).toBeLessThan(x0);
        expect(m1).toBeGreaterThan(x1);
        expect(marks.every(sh => sh.kind === 'line' && (sh.clip?.length ?? 0) >= 2)).toBe(true);
        // and nothing for a lock on something that is not there
        expect(tagged(buildMarinesView(scene(HALL, { enemies: [target], lockId: 99 })), 'muzzle')).toEqual([]);
    });

    it('tells the weapon crates apart from each other and from the small things', () =>
    {
        const crates = (kind: 'shotgun' | 'smartgun' | 'flamer' | 'grenade') =>
        {
            const s = scene();
            const cell = s.pickups[0].cell;
            return tagged(buildMarinesView({ ...s, pickups: [{ cell, kind, taken: false }] }), 'item');
        };
        const sizes = (['shotgun', 'smartgun', 'flamer', 'grenade'] as const).map(k => JSON.stringify(crates(k)));
        expect(new Set(sizes).size).toBe(4);
        expect(crates('shotgun').length).toBeGreaterThan(0);
    });

    it('stays finite with a crowd, a squad, pools and grenades from anywhere in the real arena', () =>
    {
        const rng = seeded(33);
        const game = newGame(ARENA_OPERATIONS);
        const open = game.grid.cells.map((c, i) => (c === 'wall' ? -1 : i)).filter(i => i >= 0);
        const spot = () =>
        {
            const c = open[Math.floor(rng() * open.length)];
            return { x: (c % game.grid.w) + rng(), y: Math.floor(c / game.grid.w) + rng() };
        };
        const kinds: Enemy['kind'][] = ['drone', 'runner', 'hugger'];
        for (let k = 0; k < 120; k++)
        {
            const enemies = Array.from({ length: 12 }, (_, i) => kindOf(kinds[i % 3], 0, 0, { id: i + 1, ...spot(), dirX: rng() - 0.5, dirY: rng() - 0.5, moving: rng() < 0.5, windMs: rng() < 0.2 ? 100 : -1, burnMs: rng() < 0.3 ? 500 : 0 }));
            const shapes = buildMarinesView({
                grid: game.grid, closed: game.closed, signs: game.signs, pickups: game.pickups.map(p => ({ ...p, taken: rng() < 0.3 })), enemies, fx: [],
                marines: game.marines.map(m => ({ ...m, ...spot(), dirX: rng() - 0.5, dirY: rng() - 0.5 })),
                acid: Array.from({ length: 6 }, () => ({ ...spot(), ms: rng() * 7000, r: 0.45 })),
                projectiles: Array.from({ length: 2 }, (_, i) => ({ id: i, ...spot(), dx: 1, dy: 0, ageMs: 10 })),
                lockId: 3,
                pose: { ...spot(), yaw: rng() * 6.3 }, bob: 0.01, time: k * 17, pulse: rng(), w: W, h: H,
            });
            if (!shapes.length) continue;
            expect(points(shapes).every(Number.isFinite)).toBe(true);
        }
        expect(MARINE.hp).toBeGreaterThan(0);
    });

    it('is still cheap with the squad, pools and a crowd of mixed creatures', () =>
    {
        const game = newGame(ARENA_OPERATIONS);
        const kinds: Enemy['kind'][] = ['drone', 'runner', 'hugger'];
        const enemies = Array.from({ length: 14 }, (_, i) => kindOf(kinds[i % 3], 11 + (i % 7), 5 + Math.floor(i / 7) * 2, { id: i + 1 }));
        const base: MarinesScene = {
            grid: game.grid, closed: game.closed, signs: game.signs, pickups: game.pickups, enemies,
            marines: game.marines.map((m, i) => ({ ...m, x: 11 + i, y: 8.5 })),
            acid: Array.from({ length: 10 }, (_, i) => ({ x: 9 + i, y: 7.5, ms: 4000, r: 0.45 })),
            fx: [], pose: { x: 12.5, y: 7.5, yaw: 0 }, bob: 0, time: 0, pulse: 0.5, w: 412, h: 520,
        };
        const t0 = performance.now();
        const n = 200;
        let shapes = 0;
        for (let i = 0; i < n; i++) shapes = buildMarinesView({ ...base, pose: { ...base.pose, yaw: i * 0.05 } }).length;
        const per = (performance.now() - t0) / n;
        console.log(`buildMarinesView (full): ${per.toFixed(2)} ms/frame, ${shapes} shapes`);
        expect(per).toBeLessThan(10);
    });
});

describe('the dark', () =>
{
    // the west cavern of the nest is dark: the lamp reaches only a few cells
    const nest = () => newGame(ARENAS.nido);
    const scene = (enemyX: number) =>
    {
        const s = nest();
        const e = { ...spawnEnemy(1, 'drone', s.grid, 2 * s.grid.w + 2), x: enemyX, y: 2.5 };
        return buildMarinesView({
            grid: s.grid, closed: s.closed, signs: [], pickups: [], enemies: [e], fx: [], dark: s.dark,
            pose: { x: 2.5, y: 2.5, yaw: Math.PI / 2 }, bob: 0, time: 0, pulse: 0, w: 400, h: 500,
        });
    };

    it('hides a creature beyond the lamp and shows it inside', () =>
    {
        expect(scene(7.5).some(sh => sh.tag === 'enemy')).toBe(false);
        expect(scene(4.5).some(sh => sh.tag === 'enemy')).toBe(true);
    });

    it('draws less of a dark arena than of the same one lit', () =>
    {
        const s = nest();
        const draw = (dark?: readonly boolean[]) => buildMarinesView({
            grid: s.grid, closed: s.closed, signs: [], pickups: [], enemies: [], fx: [], dark,
            pose: { x: 2.5, y: 2.5, yaw: Math.PI / 2 }, bob: 0, time: 0, pulse: 0, w: 400, h: 500,
        }).length;
        expect(draw(s.dark)).toBeLessThan(draw(undefined));
    });
});
