import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { lineClear } from '../physics';
import { SPIT, TURRET, WELD, placeTurret, weldTarget } from '../defenses';
import { ENEMIES, WELD_COST, buildField, spawnEnemy, type Enemy, type EnemyKind } from '../enemies';
import { NO_CONTROLS, act, newGame, step, weldAim, type Controls, type MarinesState } from '../game';
import type { ArenaDef } from '../map';

const rng = seeded(11);

// two rooms joined by one open door; the grille is in the west room, the player starts in the east one looking west
const DOORS: ArenaDef = {
    id: 'doors', title: 'PUERTAS', startDir: 3, signs: [], briefing: [],
    map: [
        '###########',
        '#V...#....#',
        '#....d..P.#',
        '#....#....#',
        '###########',
    ],
};
const DOOR = 2 * 11 + 5;

/** The waves put off for good and no squad, the player two steps from the door. */
function quiet(arena: ArenaDef = DOORS): MarinesState
{
    const s = newGame(arena);
    return { ...s, marines: [], player: { ...s.player, x: 6.5, y: 2.5 }, wave: { ...s.wave, restMs: 1e9 } };
}

function withEnemy(s: MarinesState, kind: EnemyKind, x: number, y: number, over: Partial<Enemy> = {}): MarinesState
{
    const e = { ...spawnEnemy(s.nextId, kind, s.grid, 13), x, y, ...over };
    return { ...s, enemies: [...s.enemies, e], nextId: s.nextId + 1 };
}

const run = (s: MarinesState, ms: number, c: Partial<Controls> = {}, slice = 33) =>
{
    let state = s;
    const events: string[] = [];
    for (let t = 0; t < ms; t += slice)
    {
        const r = step(state, Math.min(slice, ms - t), { ...NO_CONTROLS, ...c }, rng);
        state = r.state;
        events.push(...r.events);
    }
    return { state, events };
};

describe('the blowtorch', () =>
{
    it('finds the door the player is facing and nothing behind them', () =>
    {
        const s = quiet();
        expect(weldAim(s)).toEqual({ cell: DOOR, action: 'weld' });
        const turned = { ...s, player: { ...s.player, yaw: Math.PI / 2 } };
        expect(weldAim(turned)).toBeNull();
        const far = { ...s, player: { ...s.player, x: 8.5 } };
        expect(weldAim(far)).toBeNull();
    });

    it('will not seal a door somebody stands in', () =>
    {
        const s = withEnemy(quiet(), 'drone', 5.5, 2.5);
        expect(weldAim(s)).toBeNull();
    });

    it('seals a door: it blocks the sight, costs a charge and counts as built', () =>
    {
        const s = quiet();
        expect(lineClear(s.grid, s.closed, 6.5, 2.5, 3.5, 2.5)).toBe(true);
        const r = act(s, 'weld');
        expect(r.events).toEqual(['weldDone']);
        expect(r.state.closed).toContain(DOOR);
        expect(r.state.welds).toEqual([{ cell: DOOR, hp: WELD.hp }]);
        expect(r.state.player.welds).toBe(WELD.max - 1);
        expect(r.state.built.welds).toBe(1);
        expect(lineClear(r.state.grid, r.state.closed, 6.5, 2.5, 3.5, 2.5)).toBe(false);
        // the state it was given is untouched
        expect(s.closed).not.toContain(DOOR);
        expect(s.welds).toEqual([]);
    });

    it('cuts a weld open again and gives the charge back', () =>
    {
        const sealed = act(quiet(), 'weld').state;
        expect(weldAim(sealed)).toEqual({ cell: DOOR, action: 'cut' });
        const r = act(sealed, 'weld');
        expect(r.events).toEqual(['weldCut']);
        expect(r.state.closed).not.toContain(DOOR);
        expect(r.state.welds).toEqual([]);
        expect(r.state.player.welds).toBe(WELD.max);
    });

    it('says so when there are no charges or no door', () =>
    {
        const s = quiet();
        expect(act({ ...s, player: { ...s.player, welds: 0 } }, 'weld').events).toEqual(['noWelds']);
        expect(act({ ...s, player: { ...s.player, x: 8.5 } }, 'weld').events).toEqual(['noDoor']);
    });

    it('never offers a door that was shut from the start', () =>
    {
        const s = quiet();
        const shut = { ...s, closed: [DOOR] };
        expect(weldTarget(shut.grid, shut.closed, [], 6.5, 2.5, shut.player.yaw, [])).toBeNull();
    });
});

describe('creatures and a welded door', () =>
{
    it('treat it as a long way round when there is another, and as passable at a cost when there is none', () =>
    {
        const s = quiet();
        const open = buildField(s.grid, s.closed, 2 * 11 + 8);
        const welded = buildField(s.grid, [...s.closed, DOOR], 2 * 11 + 8, new Map([[DOOR, WELD.hp]]));
        const west = 2 * 11 + 3;
        expect(open.dist[west]).toBe(5);
        expect(welded.dist[west]).toBe(5 + WELD_COST);
        expect(welded.key).not.toBe(open.key);
    });

    it('gnaw at it until it gives, then come through', () =>
    {
        let s = withEnemy(act(quiet(), 'weld').state, 'drone', 4.5, 2.5);
        s = { ...s, player: { ...s.player, x: 8.5 } };
        const early = run(s, 1500);
        expect(early.state.welds[0].hp).toBeLessThan(WELD.hp);
        expect(early.state.closed).toContain(DOOR);
        const late = run(s, 14000);
        expect(late.events).toContain('weldBroken');
        expect(late.state.welds).toEqual([]);
        expect(late.state.closed).not.toContain(DOOR);
        // and it is through
        expect(late.state.enemies[0].x).toBeGreaterThan(5.5);
    });

    it('are held back for as long as the weld lasts', () =>
    {
        let s = withEnemy(act(quiet(), 'weld').state, 'drone', 4.5, 2.5);
        s = { ...s, player: { ...s.player, x: 8.5 } };
        const r = run(s, 2500);
        expect(r.state.enemies[0].x).toBeLessThan(5);
        expect(r.state.player.health).toBe(s.player.health);
    });
});

describe('sentry turrets', () =>
{
    it('are set down ahead of the player, one charge each, and no more than the limit', () =>
    {
        let s = quiet();
        const r = act(s, 'turret');
        expect(r.events).toEqual(['turretPlaced']);
        expect(r.state.turrets).toHaveLength(1);
        expect(r.state.turrets[0].x).toBeLessThan(s.player.x);
        expect(r.state.turrets[0].id).toBeGreaterThanOrEqual(TURRET.idBase);
        expect(r.state.player.turrets).toBe(TURRET.start - 1);
        expect(r.state.built.turrets).toBe(1);
        expect(s.turrets).toEqual([]);

        s = act(r.state, 'turret').state;
        s = { ...s, player: { ...s.player, turrets: 3 } };
        expect(s.turrets).toHaveLength(TURRET.max);
        expect(act(s, 'turret').events).toEqual(['noTurrets']);
        expect(act({ ...quiet(), player: { ...quiet().player, turrets: 0 } }, 'turret').events).toEqual(['noTurrets']);
    });

    it('are not set into a wall', () =>
    {
        const s = quiet();
        const against = { ...s, player: { ...s.player, x: 9.5, y: 2.5, yaw: Math.PI / 2 } };
        expect(placeTurret(against.grid, against.closed, 9.5, 2.5, Math.PI / 2, 1000, [])).toBeNull();
        expect(act(against, 'turret').events).toEqual(['noTurrets']);
    });

    it('turn to a creature in view and shoot it down', () =>
    {
        let s = act(quiet(), 'turret').state;
        // the creature stands in the east room, behind the player, in plain view of the turret: it has to turn
        s = withEnemy(s, 'drone', 9, 1.5, { burnMs: 0 });
        s = { ...s, player: { ...s.player, x: 6.5, y: 3 } };
        const r = run(s, 6000);
        expect(r.events).toContain('turretShot');
        expect(r.state.kills).toBe(1);
        expect(r.state.turrets[0].ammo).toBeLessThan(TURRET.ammo);
    });

    it('do not fire at what they cannot see', () =>
    {
        let s = act(quiet(), 'turret').state;
        s = withEnemy({ ...s, closed: [...s.closed, DOOR] }, 'drone', 2.5, 2.5);
        const r = run({ ...s, player: { ...s.player, x: 8.5 } }, 600);
        expect(r.events).not.toContain('turretShot');
    });

    it('are wrecked by a creature that reaches them', () =>
    {
        let s = act(quiet(), 'turret').state;
        const t = s.turrets[0];
        s = withEnemy(s, 'drone', t.x - 0.5, t.y, {});
        // the turret has no ammunition, and the player is farther away than the turret
        s = { ...s, turrets: s.turrets.map(o => ({ ...o, ammo: 0, hp: 10 })), player: { ...s.player, x: 9.5, y: 3.5 } };
        const r = run(s, 4000);
        expect(r.events).toContain('turretDown');
        expect(r.state.turrets).toHaveLength(0);
    });

    it('are rearmed and a charge returned when a wave is cleared', () =>
    {
        let s = act(quiet(), 'turret').state;
        s = { ...s, turrets: s.turrets.map(o => ({ ...o, ammo: 3, hp: 10 })), wave: { ...s.wave, phase: 'fight', toSpawn: 0, restMs: 0 } };
        const r = run(s, 100);
        expect(r.events).toContain('waveClear');
        expect(r.state.turrets[0].ammo).toBe(TURRET.ammo);
        expect(r.state.turrets[0].hp).toBe(10 + TURRET.mend);
        expect(r.state.player.turrets).toBe(TURRET.start);
        expect(r.state.player.welds).toBe(WELD.max);
    });
});

describe('spitters', () =>
{
    const spitterAt = (s: MarinesState) => withEnemy(s, 'spitter', 2.5, 2.5);

    it('stand off and lob acid after a warning, which lands where the player stood', () =>
    {
        const s = { ...spitterAt(quiet()), player: { ...quiet().player, x: 3.5, y: 1.5 } };
        // in the west room: a clear line, farther than a drone's reach
        const far = { ...s, player: { ...s.player, x: 4.5, y: 3.5 }, enemies: s.enemies.map(e => ({ ...e, x: 1.5, y: 1.5 })) };
        const r = run(far, ENEMIES.spitter.windupMs + 200);
        expect(r.events).toContain('spit');
        expect(r.state.spits.length + r.state.acid.length).toBeGreaterThan(0);
        // it did not close in to melee
        expect(Math.hypot(r.state.enemies[0].x - 4.5, r.state.enemies[0].y - 3.5)).toBeGreaterThan(1.5);
    });

    it('burn whoever is still there when the gob lands, and miss whoever moved', () =>
    {
        const base = { ...quiet(), enemies: [] as Enemy[] };
        const still = { ...base, player: { ...base.player, x: 4.5, y: 3.5 } };
        const spat = { ...still, spits: [{ id: 99, x: 1.5, y: 1.5, tx: 4.5, ty: 3.5, ms: 100, totalMs: SPIT.flightMs }] };
        const hit = run(spat, 300);
        expect(hit.events).toContain('splash');
        expect(hit.state.player.health + hit.state.player.armor).toBeLessThan(still.player.health + still.player.armor);
        expect(hit.state.acid).toHaveLength(1);
        expect(hit.state.spits).toHaveLength(0);

        const moved = { ...spat, player: { ...spat.player, x: 2.5, y: 1.5 } };
        const miss = run(moved, 300);
        expect(miss.events).not.toContain('splash');
        expect(miss.state.player.health).toBe(moved.player.health);
        expect(miss.state.acid).toHaveLength(1);
    });
});
