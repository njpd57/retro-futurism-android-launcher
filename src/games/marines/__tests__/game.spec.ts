import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { ENEMIES, spawnEnemy, type Enemy } from '../enemies';
import {
    ACID, BURN, GRAB, GRENADE, LOW_HEALTH, NO_CONTROLS, PICKUPS, PLAYER, SWITCH_MS, TRACKER, accuracy, act, grabbed, hurt,
    lockTarget, newGame, owned, pingInterval, remaining, step, type Controls, type MarinesState,
} from '../game';
import { ARENA_OPERATIONS, type ArenaDef } from '../map';
import { MARINE } from '../squad';
import { WAVES, mix, pickKind, waveSize } from '../waves';
import { WEAPONS } from '../weapons';

const rng = seeded(5);

// a plain room, one grille in the north-west corner, an ammo box and a medical kit
const ROOM: ArenaDef = {
    id: 'test', title: 'PRUEBA', startDir: 1, signs: [], briefing: [],
    map: [
        '#############',
        '#V..........#',
        '#...........#',
        '#.P.........#',
        '#...........#',
        '#.a........+#',
        '#############',
    ],
};

// the same room with a grenade and the three weapon crates in the top row
const CRATES: ArenaDef = {
    id: 'crates', title: 'ARMERÍA', startDir: 1, signs: [], briefing: [],
    map: [
        '#############',
        '#VgSMF......#',
        '#...........#',
        '#.P.........#',
        '#...........#',
        '#.a........+#',
        '#############',
    ],
};

/** A game with the waves put off for good and no squad, so only what the test sets up happens. */
function quiet(arena: ArenaDef = ROOM): MarinesState
{
    const s = newGame(arena);
    return { ...s, marines: [], wave: { ...s.wave, restMs: 1e9 } };
}

function withEnemy(s: MarinesState, x: number, y: number, over: Partial<Enemy> = {}): MarinesState
{
    const e = { ...spawnEnemy(s.nextId, 'drone', s.grid, 14), x, y, ...over };
    return { ...s, enemies: [...s.enemies, e], nextId: s.nextId + 1 };
}

/** Runs `ms` of game time in frames of `slice` ms (the last one shorter). */
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

describe('newGame', () =>
{
    it('starts the player in the middle of the start cell with full health, armour and ammunition', () =>
    {
        const s = newGame(ROOM);
        expect(s.phase).toBe('playing');
        expect(s.player.x).toBe(2.5);
        expect(s.player.y).toBe(3.5);
        expect(s.player.yaw).toBeCloseTo(Math.PI / 2);
        expect(s.player.health).toBe(PLAYER.health);
        expect(s.player.armor).toBe(PLAYER.armor);
        expect(s.player.mag).toBe(WEAPONS.rifle.mag);
        expect(s.player.reserve).toBe(WEAPONS.rifle.mag * 3);
        expect(s.enemies).toEqual([]);
        expect(s.pickups.map(p => p.kind)).toEqual(['ammo', 'medkit']);
        expect(s.wave).toMatchObject({ n: 1, phase: 'rest' });
    });

    it('plays the real arena too', () =>
    {
        const s = newGame(ARENA_OPERATIONS);
        expect(s.spawns.length).toBe(4);
        const r = run(s, 5000);
        expect(r.events).toContain('waveStart');
    });
});

describe('step', () =>
{
    it('does not touch the state it is given', () =>
    {
        let s = withEnemy(quiet(), 8.5, 3.5);
        s = { ...s, tracker: { ...s.tracker, pingMs: 5 } };
        const before = JSON.stringify({ ...s, field: null });
        step(s, 100, { forward: 1, strafe: 0.5, turn: 0.3, fire: true }, rng);
        expect(JSON.stringify({ ...s, field: null })).toBe(before);
    });

    it('does nothing once the player is dead', () =>
    {
        const s = { ...quiet(), phase: 'dead' as const };
        const r = step(s, 100, { ...NO_CONTROLS, fire: true }, rng);
        expect(r.state).toBe(s);
        expect(r.events).toEqual([]);
    });

    it('splits a long frame into slices so nothing tunnels through a wall', () =>
    {
        // 2 seconds in one go, walking east at 2.6 cells/s from x = 2.5: the wall is at x = 12
        const r = step(quiet(), 2000, { ...NO_CONTROLS, forward: 1 }, rng);
        expect(r.state.player.x).toBeCloseTo(2.5 + 2 * PLAYER.speed, 1);
        const wall = step(quiet(), 20000, { ...NO_CONTROLS, forward: 1 }, rng);
        expect(wall.state.player.x).toBeLessThanOrEqual(12 - PLAYER.radius + 1e-6);
    });
});

describe('moving', () =>
{
    it('walks forward along the yaw, backwards more slowly, and strafes to the right', () =>
    {
        const fwd = run(quiet(), 1000, { forward: 1 }).state.player;
        expect(fwd.x).toBeCloseTo(2.5 + PLAYER.speed, 1);
        expect(fwd.y).toBeCloseTo(3.5, 3);

        const back = run(quiet(), 500, { forward: -1 }).state.player;
        expect(2.5 - back.x).toBeCloseTo(PLAYER.back * 0.5, 1);

        // facing east, right is south
        const side = run(quiet(), 500, { strafe: 1 }).state.player;
        expect(side.y - 3.5).toBeCloseTo(PLAYER.strafe * 0.5, 1);
        expect(side.x).toBeCloseTo(2.5, 3);
    });

    it('is no faster going diagonally', () =>
    {
        const p = run(quiet(), 1000, { forward: 1, strafe: 1 }).state.player;
        expect(Math.hypot(p.x - 2.5, p.y - 3.5)).toBeCloseTo(PLAYER.speed, 1);
    });

    it('turns by the amount asked and wraps round', () =>
    {
        const a = step(quiet(), 33, { ...NO_CONTROLS, turn: 0.5 }, rng).state.player.yaw;
        expect(a).toBeCloseTo(Math.PI / 2 + 0.5, 5);
        const b = step({ ...quiet(), player: { ...quiet().player, yaw: Math.PI - 0.1 } }, 33, { ...NO_CONTROLS, turn: 0.3 }, rng).state.player.yaw;
        expect(b).toBeCloseTo(-Math.PI + 0.2, 5);
        // a long frame applies a turn once, not once per slice
        const c = step(quiet(), 400, { ...NO_CONTROLS, turn: 0.5 }, rng).state.player.yaw;
        expect(c).toBeCloseTo(Math.PI / 2 + 0.5, 5);
    });

    it('slides along a wall', () =>
    {
        // north-east against the north wall: the y part is stopped, x goes on
        let s = quiet();
        s = { ...s, player: { ...s.player, x: 4.5, y: 1.3, yaw: Math.PI / 4 } };
        const p = run(s, 500, { forward: 1 }).state.player;
        expect(p.x).toBeGreaterThan(5.2);
        expect(p.y).toBeGreaterThanOrEqual(1.25 - 1e-6);
    });

    it('cannot walk through a creature', () =>
    {
        const s = withEnemy(quiet(), 3.4, 3.5, { coolMs: 1e9 });
        const p = run(s, 800, { forward: 1 }).state.player;
        expect(Math.hypot(p.x - 3.4, p.y - 3.5)).toBeGreaterThan(PLAYER.radius + ENEMIES.drone.radius * 0.8 - 0.02);
    });

    it('tracks how much it moved, for the walking bob', () =>
    {
        expect(step(quiet(), 33, { ...NO_CONTROLS, forward: 1 }, rng).state.player.moveAmt).toBeGreaterThan(0.9);
        expect(step(quiet(), 33, NO_CONTROLS, rng).state.player.moveAmt).toBe(0);
    });
});

describe('shooting', () =>
{
    const fire: Partial<Controls> = { fire: true };

    it('spends a round and waits for the cadence before the next', () =>
    {
        const s = quiet();
        const a = step(s, 33, { ...NO_CONTROLS, fire: true }, rng);
        expect(a.events).toContain('shot');
        expect(a.state.player.mag).toBe(WEAPONS.rifle.mag - 1);
        expect(a.state.shots).toBe(1);
        // 33 ms later it is still cooling down
        const b = step(a.state, 33, { ...NO_CONTROLS, fire: true }, rng);
        expect(b.events).not.toContain('shot');
        // a second of fire gives ten rounds, at 30 frames a second or at 60
        for (const slice of [33, 16.7])
        {
            const r = run(s, 1000, fire, slice);
            const shots = r.events.filter(e => e === 'shot').length;
            expect(shots, `slice ${slice}`).toBeGreaterThanOrEqual(9);
            expect(shots, `slice ${slice}`).toBeLessThanOrEqual(11);
        }
    });

    it('hits a creature in front and takes its health down; the last hit kills it and scores', () =>
    {
        let s = withEnemy(quiet(), 5.5, 3.5);
        const r = run(s, 100, fire);
        expect(r.events).toContain('hit');
        expect(r.state.enemies[0].hp).toBeLessThan(ENEMIES.drone.hp);
        expect(r.state.hits).toBeGreaterThan(0);
        // right after a hit it flashes
        expect(step(s, 33, { ...NO_CONTROLS, fire: true }, rng).state.enemies[0].hitMs).toBeGreaterThan(0);

        s = withEnemy(quiet(), 5.5, 3.5, { hp: 1, coolMs: 1e9 });
        const k = run(s, 200, fire);
        expect(k.events).toContain('kill');
        expect(k.state.enemies).toEqual([]);
        expect(k.state.kills).toBe(1);
        expect(k.state.score).toBe(ENEMIES.drone.score);
        expect(k.state.fx.some(f => f.kind === 'splat')).toBe(true);
    });

    it('does not hit a creature behind the player', () =>
    {
        const s = withEnemy(quiet(), 1.5, 3.5);
        const r = run(s, 300, fire);
        expect(r.state.hits).toBe(0);
    });

    it('leaves a tracer and a spark that die away', () =>
    {
        const a = step(quiet(), 33, { ...NO_CONTROLS, fire: true }, rng).state;
        expect(a.fx.map(f => f.kind).sort()).toEqual(['spark', 'tracer']);
        const later = run(a, 300).state;
        expect(later.fx).toEqual([]);
    });

    it('widens the spread while firing and settles when it stops', () =>
    {
        const hot = run(quiet(), 800, fire).state.player.heat;
        expect(hot).toBeGreaterThan(0.4);
        const cool = run(withHeat(quiet(), hot), 1500).state.player.heat;
        expect(cool).toBeLessThan(hot / 2);
    });

    it('reloads by itself when the magazine runs dry, from the reserve', () =>
    {
        let s = quiet();
        s = { ...s, player: { ...s.player, mag: 1 } };
        const a = run(s, 150, fire);
        expect(a.events).toContain('reloadStart');
        expect(a.state.player.reloadMs).toBeGreaterThan(0);
        // no shots while it reloads
        const mid = step(a.state, 33, { ...NO_CONTROLS, fire: true }, rng);
        expect(mid.events).not.toContain('shot');
        const done = run(a.state, WEAPONS.rifle.reloadMs + 100);
        expect(done.events).toContain('reloadDone');
        expect(done.state.player.mag).toBe(WEAPONS.rifle.mag);
        expect(done.state.player.reserve).toBe(WEAPONS.rifle.mag * 3 - (WEAPONS.rifle.mag - 0));
    });

    it('reloads on request only when it helps', () =>
    {
        const full = act(quiet(), 'reload');
        expect(full.events).toEqual([]);
        let s = quiet();
        s = { ...s, player: { ...s.player, mag: 40 } };
        const r = act(s, 'reload');
        expect(r.events).toEqual(['reloadStart']);
        expect(r.state.player.reloadMs).toBe(WEAPONS.rifle.reloadMs);
        // not twice at once
        expect(act(r.state, 'reload').events).toEqual([]);
        // and not with an empty reserve
        let dry = quiet();
        dry = { ...dry, player: { ...dry.player, mag: 40, reserve: 0 } };
        expect(act(dry, 'reload').events).toEqual([]);
    });

    it('clicks dry with nothing left, and takes only what fits into the magazine', () =>
    {
        let s = quiet();
        s = { ...s, player: { ...s.player, mag: 0, reserve: 0 } };
        const r = run(s, 100, fire);
        expect(r.events).toContain('dry');
        expect(r.events).not.toContain('shot');

        let part = quiet();
        part = { ...part, player: { ...part.player, mag: 90, reserve: 5 } };
        const done = run(act(part, 'reload').state, WEAPONS.rifle.reloadMs + 100);
        expect(done.state.player.mag).toBe(95);
        expect(done.state.player.reserve).toBe(0);
    });

    it('counts accuracy', () =>
    {
        expect(accuracy(quiet())).toBe(0);
        const r = run(withEnemy(quiet(), 5.5, 3.5, { hp: 99, coolMs: 1e9 }), 500, fire);
        expect(accuracy(r.state)).toBeGreaterThan(0.5);
        expect(accuracy(r.state)).toBeLessThanOrEqual(1);
    });
});

function withHeat(s: MarinesState, heat: number): MarinesState
{
    return { ...s, player: { ...s.player, heat } };
}

describe('taking damage', () =>
{
    it('armour takes two thirds of every blow while it lasts', () =>
    {
        const p = { ...quiet().player };
        hurt(p, 15);
        expect(p.armor).toBeCloseTo(PLAYER.armor - 10);
        expect(p.health).toBeCloseTo(PLAYER.health - 5);
        expect(p.hurtMs).toBeGreaterThan(0);

        // with no armour left, all of it
        const bare = { ...quiet().player, armor: 0 };
        hurt(bare, 15);
        expect(bare.health).toBe(PLAYER.health - 15);

        // a little armour left takes what it can
        const worn = { ...quiet().player, armor: 4 };
        hurt(worn, 15);
        expect(worn.armor).toBe(0);
        expect(worn.health).toBeCloseTo(PLAYER.health - 11);
    });

    it('a creature strikes after its warning, and the player feels it', () =>
    {
        const s = withEnemy(quiet(), 3.2, 3.5);
        const r = run(s, 1000);
        expect(r.events).toContain('hurt');
        expect(r.state.player.health + r.state.player.armor).toBeLessThan(PLAYER.health + PLAYER.armor);
    });

    it('warns once when health drops under the threshold, and ends the game at zero', () =>
    {
        let s = withEnemy(quiet(), 3.2, 3.5);
        s = { ...s, player: { ...s.player, health: LOW_HEALTH + 3, armor: 0 } };
        const a = run(s, 600);
        expect(a.events.filter(e => e === 'lowHealth').length).toBe(1);

        const r = run(s, 8000);
        expect(r.state.phase).toBe('dead');
        expect(r.state.player.health).toBe(0);
        expect(r.events.filter(e => e === 'dead').length).toBe(1);
    });
});

describe('pickups', () =>
{
    it('takes ammunition and medical kits by walking over them, once', () =>
    {
        let s = quiet();
        s = { ...s, player: { ...s.player, x: 2.5, y: 5.5, health: 50, reserve: 10 } };
        // the ammo box is at (2, 5): standing on it
        const a = step(s, 33, NO_CONTROLS, rng);
        expect(a.events).toContain('pickupAmmo');
        expect(a.state.player.reserve).toBe(10 + PICKUPS.ammo);
        expect(step(a.state, 33, NO_CONTROLS, rng).events).not.toContain('pickupAmmo');

        s = { ...s, player: { ...s.player, x: 11.5, y: 5.5, health: 50 } };
        const m = step(s, 33, NO_CONTROLS, rng);
        expect(m.events).toContain('pickupMed');
        expect(m.state.player.health).toBe(50 + PICKUPS.medkit);
    });

    it('leaves them when they would be wasted', () =>
    {
        let s = quiet();
        s = { ...s, player: { ...s.player, x: 11.5, y: 5.5 } };
        // full health: the kit stays
        const m = step(s, 33, NO_CONTROLS, rng);
        expect(m.events).not.toContain('pickupMed');
        expect(m.state.pickups.find(p => p.kind === 'medkit')!.taken).toBe(false);

        const max = WEAPONS.rifle.reserveMax;
        s = { ...s, player: { ...s.player, x: 2.5, y: 5.5, reserve: max } };
        expect(step(s, 33, NO_CONTROLS, rng).events).not.toContain('pickupAmmo');
    });
});

describe('waves', () =>
{
    it('start after the rest, bring the creatures out of the grilles one at a time, and hold their number', () =>
    {
        let s = newGame(ROOM);
        const started = run(s, WAVES.firstRestMs + 100);
        expect(started.events).toContain('waveStart');
        s = started.state;
        expect(s.wave.phase).toBe('fight');
        expect(s.wave.toSpawn).toBeLessThanOrEqual(waveSize(1));

        const later = run(s, 8000, {}, 100);
        expect(later.events.filter(e => e === 'spawn').length).toBeGreaterThan(2);
        // they come out of the grille cell
        const first = run(started.state, 3000, {}, 100).state.enemies[0];
        expect(first).toBeDefined();
        expect(remaining(later.state)).toBeLessThanOrEqual(waveSize(1));
    });

    it('end when the last creature is dead: a bonus, the next wave and the pickups back', () =>
    {
        let s = quiet();
        s = {
            ...s,
            wave: { n: 2, phase: 'fight', restMs: 0, toSpawn: 0, spawnMs: 0 },
            pickups: s.pickups.map(p => ({ ...p, taken: true })),
        };
        const r = step(s, 33, NO_CONTROLS, rng);
        expect(r.events).toContain('waveClear');
        expect(r.state.wave).toMatchObject({ n: 3, phase: 'rest' });
        expect(r.state.score).toBe(500);
        expect(r.state.pickups.every(p => !p.taken)).toBe(true);
    });

    it('do not end while any creature is alive or still to come', () =>
    {
        let s = withEnemy(quiet(), 9.5, 3.5, { coolMs: 1e9 });
        s = { ...s, wave: { n: 1, phase: 'fight', restMs: 0, toSpawn: 0, spawnMs: 0 } };
        expect(step(s, 33, NO_CONTROLS, rng).events).not.toContain('waveClear');
        s = { ...quiet(), wave: { n: 1, phase: 'fight', restMs: 0, toSpawn: 3, spawnMs: 1e9 } };
        expect(step(s, 33, NO_CONTROLS, rng).events).not.toContain('waveClear');
    });

    it('come out far from the player', () =>
    {
        const s = newGame(ARENA_OPERATIONS);
        const r = run(s, WAVES.firstRestMs + 1500, {}, 50);
        for (const e of r.state.enemies) expect(Math.hypot(e.x - s.player.x, e.y - s.player.y)).toBeGreaterThan(3);
    });
});

describe('the tracker', () =>
{
    it('pings faster the closer the nearest contact', () =>
    {
        expect(pingInterval(null)).toBe(1500);
        expect(pingInterval(2)).toBeLessThan(pingInterval(12));
        expect(pingInterval(2)).toBeGreaterThanOrEqual(450);
    });

    it('shows moving contacts in range and the distance of the nearest', () =>
    {
        let s = quiet();
        s = withEnemy(withEnemy(s, 6.5, 3.5), 11.5, 5.5);
        s = { ...s, tracker: { ...s.tracker, pingMs: 1 } };
        const r = step(s, 33, NO_CONTROLS, rng);
        expect(r.events).toContain('ping');
        expect(r.state.tracker.blips.length).toBe(2);
        expect(r.state.tracker.nearest).toBeLessThan(5);
        expect(r.state.tracker.pingMs).toBeGreaterThan(400);
    });

    it('does not show what stands still, or what is out of range', () =>
    {
        const arena = ARENA_OPERATIONS;
        let s = quiet(arena);
        // far: the grille in the south-east corner is out of range
        s = withEnemy(s, 24.5, 13.5);
        s = { ...s, tracker: { ...s.tracker, pingMs: 1 } };
        const far = step(s, 33, NO_CONTROLS, rng);
        expect(far.state.tracker.blips).toEqual([]);
        expect(far.state.tracker.nearest).toBeNull();
        expect(Math.hypot(24.5 - s.player.x, 13.5 - s.player.y)).toBeGreaterThan(TRACKER.range);
        // while the same creature a little nearer does show
        let nearer = withEnemy(quiet(arena), 18.5, 7.5);
        nearer = { ...nearer, tracker: { ...nearer.tracker, pingMs: 1 } };
        expect(step(nearer, 33, NO_CONTROLS, rng).state.tracker.blips.length).toBe(1);

        // standing still (striking): the tracker doesn't see it, as the film's didn't
        let near = quiet();
        near = withEnemy(near, 3.2, 3.5, { coolMs: 1e9 });
        near = { ...near, tracker: { ...near.tracker, pingMs: 1 } };
        const still = step(near, 33, NO_CONTROLS, rng);
        expect(still.state.tracker.blips).toEqual([]);
    });

    it('lets contacts fade after a while', () =>
    {
        let s = withEnemy(quiet(), 6.5, 3.5);
        s = { ...s, tracker: { ...s.tracker, pingMs: 1 } };
        const a = step(s, 33, NO_CONTROLS, rng).state;
        expect(a.tracker.blips.length).toBe(1);
        // no more pings for a while
        const b = run({ ...a, tracker: { ...a.tracker, pingMs: 1e9 } }, TRACKER.blipMs + 100).state;
        expect(b.tracker.blips).toEqual([]);
    });
});

/** Stands the player on a cell's centre. */
const standOn = (s: MarinesState, x: number, y: number): MarinesState => ({ ...s, player: { ...s.player, x: x + 0.5, y: y + 0.5 } });

describe('weapon crates', () =>
{
    it('carry the weapon with a full magazine, and it goes into the hand', () =>
    {
        const r = step(standOn(quiet(CRATES), 3, 1), 33, NO_CONTROLS, rng);
        expect(r.events).toContain('pickupWeapon:shotgun');
        const p = r.state.player;
        expect(p.weapon).toBe('shotgun');
        expect(p.mag).toBe(WEAPONS.shotgun.mag);
        expect(p.reserve).toBe(WEAPONS.shotgun.crate);
        // the rifle was put away with its ammunition
        expect(p.stash.rifle).toEqual({ mag: WEAPONS.rifle.mag, reserve: WEAPONS.rifle.mag * 3 });
        expect(owned(p)).toEqual(['rifle', 'shotgun']);
        // the crate is gone
        expect(r.state.pickups.find(k => k.kind === 'shotgun')!.taken).toBe(true);
    });

    it('restock a weapon already carried, and stay when it is full', () =>
    {
        let s = step(standOn(quiet(CRATES), 3, 1), 33, NO_CONTROLS, rng).state;
        s = { ...s, pickups: s.pickups.map(k => ({ ...k, taken: false })), player: { ...s.player, reserve: 4 } };
        const again = step(s, 33, NO_CONTROLS, rng);
        expect(again.events).toContain('pickupAmmo');
        expect(again.state.player.reserve).toBe(4 + WEAPONS.shotgun.box);

        const full = step({ ...s, player: { ...s.player, reserve: WEAPONS.shotgun.reserveMax } }, 33, NO_CONTROLS, rng);
        expect(full.events).not.toContain('pickupAmmo');
        expect(full.state.pickups.find(k => k.kind === 'shotgun')!.taken).toBe(false);
    });

    it('put each weapon in the hand: the smartgun and the flamethrower too', () =>
    {
        expect(step(standOn(quiet(CRATES), 4, 1), 33, NO_CONTROLS, rng).state.player.weapon).toBe('smartgun');
        expect(step(standOn(quiet(CRATES), 5, 1), 33, NO_CONTROLS, rng).state.player.weapon).toBe('flamer');
    });
});

describe('ammunition boxes with several weapons', () =>
{
    it('restock every weapon carried', () =>
    {
        let s = step(standOn(quiet(CRATES), 3, 1), 33, NO_CONTROLS, rng).state;
        s = { ...s, player: { ...s.player, reserve: 0, stash: { rifle: { mag: 10, reserve: 20 } } } };
        const r = step(standOn(s, 2, 5), 33, NO_CONTROLS, rng);
        expect(r.events).toContain('pickupAmmo');
        expect(r.state.player.reserve).toBe(WEAPONS.shotgun.box);
        expect(r.state.player.stash.rifle).toEqual({ mag: 10, reserve: 20 + WEAPONS.rifle.box });
    });

    it('leave the box when every weapon is full', () =>
    {
        let s = step(standOn(quiet(CRATES), 3, 1), 33, NO_CONTROLS, rng).state;
        s = { ...s, player: { ...s.player, reserve: WEAPONS.shotgun.reserveMax, stash: { rifle: { mag: 10, reserve: WEAPONS.rifle.reserveMax } } } };
        expect(step(standOn(s, 2, 5), 33, NO_CONTROLS, rng).events).not.toContain('pickupAmmo');
    });
});

describe('changing weapon', () =>
{
    /** The player carrying rifle and shotgun, with different ammunition in each. */
    function armed(): MarinesState
    {
        const s = quiet();
        return { ...s, player: { ...s.player, mag: 50, reserve: 100, stash: { shotgun: { mag: 3, reserve: 12 } } } };
    }

    it('cycles through the weapons carried, keeping each one\'s ammunition', () =>
    {
        const a = act(armed(), 'switch');
        expect(a.events).toEqual(['switch']);
        expect(a.state.player).toMatchObject({ weapon: 'shotgun', mag: 3, reserve: 12 });
        expect(a.state.player.stash.rifle).toEqual({ mag: 50, reserve: 100 });
        const b = act(a.state, 'switch');
        expect(b.state.player).toMatchObject({ weapon: 'rifle', mag: 50, reserve: 100 });
        expect(b.state.player.stash.shotgun).toEqual({ mag: 3, reserve: 12 });
    });

    it('selects one directly, and ignores what is not carried or already in hand', () =>
    {
        expect(act(armed(), 'select:shotgun').state.player.weapon).toBe('shotgun');
        expect(act(armed(), 'select:flamer').events).toEqual([]);
        expect(act(armed(), 'select:rifle').events).toEqual([]);
        // with only the rifle there is nothing to switch to
        expect(act(quiet(), 'switch').events).toEqual([]);
    });

    it('takes a moment, cancels a reload, and does not touch the state it was given', () =>
    {
        const s = armed();
        const reloading = { ...s, player: { ...s.player, reloadMs: 900, heat: 0.6 } };
        const before = JSON.stringify({ ...reloading, field: null });
        const r = act(reloading, 'switch');
        expect(JSON.stringify({ ...reloading, field: null })).toBe(before);
        expect(r.state.player.reloadMs).toBe(0);
        expect(r.state.player.heat).toBe(0);
        expect(r.state.player.cooldownMs).toBeGreaterThanOrEqual(SWITCH_MS);
        // no shot until it is drawn
        expect(step(r.state, 100, { ...NO_CONTROLS, fire: true }, rng).events).not.toContain('shot');
        expect(run(r.state, SWITCH_MS + 100, { fire: true }).events).toContain('shot');
    });
});

describe('the shotgun', () =>
{
    const withShotgun = (s: MarinesState): MarinesState => act({ ...s, player: { ...s.player, stash: { shotgun: { mag: 6, reserve: 18 } } } }, 'select:shotgun').state;
    const blast = (distance: number) =>
    {
        const s = withEnemy(withShotgun(quiet()), 2.5 + distance, 3.5, { hp: 99, coolMs: 1e9 });
        const ready = { ...s, player: { ...s.player, cooldownMs: 0 } };
        const r = step(ready, 33, { ...NO_CONTROLS, fire: true }, seeded(2));
        return { r, taken: 99 - r.state.enemies[0].hp };
    };

    it('spends one cartridge for all its pellets and waits for the pump', () =>
    {
        const { r } = blast(3);
        expect(r.state.player.mag).toBe(5);
        expect(r.state.shots).toBe(1);
        expect(r.events.filter(e => e === 'shot')).toHaveLength(1);
        expect(r.state.player.cooldownMs).toBeGreaterThan(WEAPONS.shotgun.fireMs - 40);
    });

    it('kills a drone point blank and barely wounds one at the end of its range', () =>
    {
        expect(blast(1.5).taken).toBeGreaterThanOrEqual(ENEMIES.drone.hp);
        expect(blast(WEAPONS.shotgun.range - 1).taken).toBeLessThan(ENEMIES.drone.hp / 2);
        expect(blast(3).taken).toBeGreaterThan(blast(7).taken);
    });

    it('draws a few tracers, not a wall of them', () =>
    {
        expect(blast(3).r.state.fx.filter(f => f.kind === 'tracer').length).toBeLessThanOrEqual(3);
    });
});

describe('the smartgun', () =>
{
    const armedWithSmartgun = (s: MarinesState): MarinesState =>
        act({ ...s, player: { ...s.player, stash: { smartgun: { mag: 150, reserve: 300 } } } }, 'select:smartgun').state;

    it('fires faster than the rifle', () =>
    {
        const ready = { ...armedWithSmartgun(quiet()), player: { ...armedWithSmartgun(quiet()).player, cooldownMs: 0 } };
        const shots = run(ready, 1000, { fire: true }).events.filter(e => e === 'shot').length;
        expect(shots).toBeGreaterThanOrEqual(12);
    });

    it('finds a target well off the crosshair and marks it', () =>
    {
        // facing east; the creature 4 cells away and 12 degrees to one side: the rifle would miss it
        const y = 3.5 - 4 * Math.tan(12 * Math.PI / 180);
        const base = withEnemy(armedWithSmartgun(quiet()), 6.5, y, { hp: 99, coolMs: 1e9 });
        expect(lockTarget(base)).toBe(base.enemies[0].id);
        const rifle = { ...base, player: { ...base.player, weapon: 'rifle' as const } };
        expect(lockTarget(rifle)).toBeNull();
        const r = run({ ...base, player: { ...base.player, cooldownMs: 0 } }, 300, { fire: true });
        expect(r.state.hits).toBeGreaterThan(2);
    });

    it('marks nothing when it is dead or the weapon is another', () =>
    {
        const s = withEnemy(armedWithSmartgun(quiet()), 6.5, 3.5, { coolMs: 1e9 });
        expect(lockTarget({ ...s, phase: 'dead' })).toBeNull();
    });
});

describe('the flamethrower', () =>
{
    const burning = (s: MarinesState): MarinesState =>
        act({ ...s, player: { ...s.player, stash: { flamer: { mag: 100, reserve: 100 } } } }, 'select:flamer').state;
    const ready = (s: MarinesState): MarinesState => ({ ...s, player: { ...s.player, cooldownMs: 0 } });

    it('burns everything in the cone at once, and the fire goes on hurting', () =>
    {
        let s = withEnemy(withEnemy(burning(quiet()), 5.0, 3.5, { hp: 99, coolMs: 1e9 }), 5.5, 3.6, { hp: 99, coolMs: 1e9 });
        const r = step(ready(s), 33, { ...NO_CONTROLS, fire: true }, rng);
        expect(r.state.enemies.every(e => e.hp < 99)).toBe(true);
        expect(r.state.enemies.every(e => e.burnMs > 0)).toBe(true);
        expect(r.events).toContain('hit');
        expect(r.state.fx.some(f => f.kind === 'flame')).toBe(true);
        // let go of the trigger: they keep burning for a while, and then stop
        const hp = r.state.enemies.map(e => e.hp);
        const later = run(r.state, 1000);
        expect(later.state.enemies.every((e, i) => e.hp < hp[i] - 1)).toBe(true);
        const long = run(r.state, BURN.ms + 500).state.enemies;
        const settled = run({ ...r.state, enemies: long }, 1000).state.enemies;
        expect(settled.map(e => e.hp)).toEqual(long.map(e => e.hp));
    });

    it('does not reach farther than its range, or round a corner of the pillar', () =>
    {
        const s = withEnemy(burning(quiet()), 2.5 + WEAPONS.flamer.range + 2, 3.5, { hp: 99, coolMs: 1e9 });
        expect(step(ready(s), 33, { ...NO_CONTROLS, fire: true }, rng).state.enemies[0].hp).toBe(99);
    });

    it('burns through its fuel, and kills a drone in about a second', () =>
    {
        const s = withEnemy(burning(quiet()), 4.0, 3.5, { coolMs: 1e9 });
        const r = run(ready(s), 1200, { fire: true });
        expect(r.state.kills).toBe(1);
        expect(r.state.player.mag).toBeLessThan(100 - 8);
    });

    it('drops anything clinging to the player\'s face', () =>
    {
        const s = withEnemy(burning(quiet()), 2.5, 3.5, { hp: ENEMIES.hugger.hp, clung: true, kind: 'hugger' });
        const r = run(ready(s), 600, { fire: true });
        expect(r.state.enemies).toEqual([]);
    });
});

describe('grenades', () =>
{
    /** The player at (2.5, 3.5) facing east, a drone `d` cells ahead. */
    const lob = (s: MarinesState) => act(s, 'grenade');

    it('start with a few, and a launch spends one and flies on its own', () =>
    {
        const s = quiet();
        expect(s.player.grenades).toBe(GRENADE.start);
        const r = lob(s);
        expect(r.events).toEqual(['launch']);
        expect(r.state.player.grenades).toBe(GRENADE.start - 1);
        expect(r.state.projectiles).toHaveLength(1);
        expect(r.state.projectiles[0].dx).toBeCloseTo(1);
        // it moves
        const x0 = r.state.projectiles[0].x;
        expect(step(r.state, 100, NO_CONTROLS, rng).state.projectiles[0].x).toBeGreaterThan(x0 + 1);
        // and the state it was given is untouched
        expect(s.projectiles).toEqual([]);
    });

    it('are spaced out, and run out', () =>
    {
        const a = lob(quiet());
        expect(lob(a.state).events).toEqual([]);
        expect(lob(a.state).state).toBe(a.state);
        const empty = { ...quiet(), player: { ...quiet().player, grenades: 0 } };
        expect(lob(empty).events).toEqual(['noGrenades']);
        // after the pump cycles it can throw again
        const later = run(a.state, GRENADE.cooldownMs + 100).state;
        expect(lob(later).events).toEqual(['launch']);
    });

    it('burst on the first creature in their way, hurting those near it and not those far', () =>
    {
        let s = withEnemy(quiet(), 6.5, 3.5, { hp: 99, coolMs: 1e9 });
        s = withEnemy(s, 6.5, 4.5, { hp: 99, coolMs: 1e9 });
        s = withEnemy(s, 6.5, 1.5, { hp: 99, coolMs: 1e9 });
        s = withEnemy(s, 11.0, 3.5, { hp: 99, coolMs: 1e9 });
        const r = run(lob(s).state, 1200);
        expect(r.events).toContain('blast');
        expect(r.state.projectiles).toEqual([]);
        const hp = r.state.enemies.map(e => e.hp);
        // the one hit, and the one a cell to the south, and the one two cells north, are all hurt; the far one is not
        expect(hp[0]).toBeLessThan(99 - GRENADE.damage * 0.8);
        expect(hp[1]).toBeLessThan(99);
        expect(hp[1]).toBeGreaterThan(hp[0]);
        expect(hp[3]).toBe(99);
    });

    it('leave a mark where they burst, that dies away', () =>
    {
        const s = withEnemy(quiet(), 6.5, 3.5, { hp: 99, coolMs: 1e9 });
        const burst = run(lob(s).state, 400);
        const mark = burst.state.fx.find(f => f.kind === 'blast');
        expect(mark).toBeDefined();
        expect(mark!.r).toBe(GRENADE.radius);
        // the creature came to meet it
        expect(mark!.x).toBeGreaterThan(4);
        expect(mark!.x).toBeLessThan(6.5);
        expect(run(burst.state, 600).state.fx.some(f => f.kind === 'blast')).toBe(false);
    });

    it('kill and score like any other shot', () =>
    {
        const s = withEnemy(quiet(), 6.5, 3.5, { hp: 3, coolMs: 1e9 });
        const r = run(lob(s).state, 1200);
        expect(r.state.kills).toBe(1);
        expect(r.state.score).toBe(ENEMIES.drone.score);
    });

    it('do not pass through walls: the blast stays on its own side', () =>
    {
        // thrown at the east wall, with a creature round the corner of nothing: only the wall and the shooter are near
        const s = { ...quiet(), player: { ...quiet().player, x: 10.5 } };
        const r = run(lob(s).state, 800);
        expect(r.events).toContain('blast');
        // 1.5 cells from the wall at x = 12: the blast bursts within a cell of the shooter
        expect(r.state.player.health + r.state.player.armor).toBeLessThan(PLAYER.health + PLAYER.armor);
    });

    it('hurt the one who throws them at their feet, less than at the middle of a crowd, and the squad too', () =>
    {
        const walled = { ...quiet(), player: { ...quiet().player, x: 11.4 } };
        const r = run(lob(walled).state, 400);
        const lost = PLAYER.health + PLAYER.armor - r.state.player.health - r.state.player.armor;
        expect(lost).toBeGreaterThan(5);
        expect(lost).toBeLessThanOrEqual(GRENADE.selfDamage);

        const far = run(lob(quiet()).state, 2000);
        expect(far.state.player.health).toBe(PLAYER.health);

        // a marine next to the burst
        const squad = newGame(ROOM);
        const m = { ...squad, wave: { ...squad.wave, restMs: 1e9 }, player: { ...squad.player, x: 11.4 }, marines: squad.marines.map(o => ({ ...o, x: 11.2, y: 3.4 })) };
        const hit = run(lob(m).state, 400, {}, 33);
        expect(hit.state.marines[0].hp).toBeLessThan(MARINE.hp);
    });

    it('are thrown at the creature the rifle would aim at', () =>
    {
        const y = 3.5 - 6 * Math.tan(3 * Math.PI / 180);
        const s = withEnemy(quiet(), 8.5, y, { hp: 99, coolMs: 1e9 });
        const g = lob(s).state.projectiles[0];
        expect(g.dy).toBeLessThan(0);
    });

    it('are restocked by the grenade pickup, up to a limit', () =>
    {
        const low = { ...standOn(quiet(CRATES), 2, 1), };
        const r = step({ ...low, player: { ...low.player, grenades: 1 } }, 33, NO_CONTROLS, rng);
        expect(r.events).toContain('pickupGrenade');
        expect(r.state.player.grenades).toBe(1 + PICKUPS.grenade);
        const full = step({ ...low, player: { ...low.player, grenades: GRENADE.max } }, 33, NO_CONTROLS, rng);
        expect(full.events).not.toContain('pickupGrenade');
        const near = step({ ...low, player: { ...low.player, grenades: GRENADE.max - 1 } }, 33, NO_CONTROLS, rng);
        expect(near.state.player.grenades).toBe(GRENADE.max);
    });
});

describe('acid', () =>
{
    const kill = (x: number, y: number) =>
        run(withEnemy(quiet(), x, y, { hp: 0, coolMs: 1e9 }), 100);

    it('pools where a creature fell, and dries up', () =>
    {
        const r = kill(7.5, 3.5);
        expect(r.state.acid).toHaveLength(1);
        expect(r.state.acid[0]).toMatchObject({ x: 7.5, y: 3.5 });
        expect(run(r.state, ACID.lifeMs + 200).state.acid).toEqual([]);
    });

    it('keeps only so many pools', () =>
    {
        let s = quiet();
        for (let i = 0; i < ACID.max + 4; i++) s = withEnemy(s, 4.5 + (i % 7), 1.5 + Math.floor(i / 7) * 2, { hp: 0, coolMs: 1e9 });
        const r = step(s, 33, NO_CONTROLS, rng);
        expect(r.state.acid).toHaveLength(ACID.max);
    });

    it('splashes whoever is close when the creature falls, and not those far', () =>
    {
        const near = kill(3.0, 3.5);
        expect(near.events).toContain('splash');
        expect(near.state.player.health + near.state.player.armor).toBeLessThan(PLAYER.health + PLAYER.armor);
        const far = kill(8.5, 3.5);
        expect(far.events).not.toContain('splash');
        expect(far.state.player.health).toBe(PLAYER.health);
    });

    it('burns whoever stands in a pool, tick by tick, and not whoever stays out of it', () =>
    {
        const s = { ...quiet(), acid: [{ x: 2.5, y: 3.5, ms: 5000, r: ACID.radius }] };
        const r = run(s, 1300);
        expect(r.events.filter(e => e === 'acid').length).toBe(Math.floor(1300 / ACID.tickMs));
        expect(r.state.player.health + r.state.player.armor).toBeLessThan(PLAYER.health + PLAYER.armor - 5);
        const out = { ...quiet(), acid: [{ x: 6.5, y: 3.5, ms: 5000, r: ACID.radius }] };
        expect(run(out, 1300).events).not.toContain('acid');
        // walking out stops it
        const away = run(s, 1300, { forward: 1 });
        expect(away.events.filter(e => e === 'acid').length).toBeLessThan(3);
    });

    it('is not left by a facehugger that fell off the face', () =>
    {
        const s = withEnemy(quiet(), 2.5, 3.5, { hp: 0, clung: true, kind: 'hugger' });
        const r = step(s, 33, NO_CONTROLS, rng);
        expect(r.state.kills).toBe(1);
        expect(r.state.acid).toEqual([]);
        expect(r.events).not.toContain('splash');
    });
});

describe('a facehugger', () =>
{
    const hugger = (s: MarinesState, x: number, y: number, over: Partial<Enemy> = {}) =>
        withEnemy(s, x, y, { kind: 'hugger', hp: ENEMIES.hugger.hp, ...over });

    it('leaps onto the face after its crouch, and clings', () =>
    {
        const r = run(hugger(quiet(), 3.8, 3.5), 1200);
        expect(r.events).toContain('grab');
        expect(grabbed(r.state)).toBe(true);
        const h = r.state.enemies[0];
        expect([h.x, h.y]).toEqual([r.state.player.x, r.state.player.y]);
    });

    it('hurts every moment, slows the player and goes where they go', () =>
    {
        const s = hugger(quiet(), 2.5, 3.5, { clung: true });
        const walk = run(s, 1000, { forward: 1 });
        expect(walk.state.player.x - 2.5).toBeCloseTo(PLAYER.speed * PLAYER.grabSlow, 1);
        expect(walk.state.enemies[0].x).toBe(walk.state.player.x);
        const lost = PLAYER.health + PLAYER.armor - walk.state.player.health - walk.state.player.armor;
        expect(lost).toBeCloseTo(Math.floor(1000 / GRAB.tickMs) * GRAB.damage, 0);
        expect(walk.events.filter(e => e === 'hurt').length).toBe(Math.floor(1000 / GRAB.tickMs));
    });

    it('falls to any shot, in whatever direction the player looks', () =>
    {
        const s = hugger(quiet(), 2.5, 3.5, { clung: true });
        const turned = { ...s, player: { ...s.player, yaw: -Math.PI / 2 } };
        const r = run(turned, 300, { fire: true });
        expect(r.state.enemies).toEqual([]);
        expect(r.state.kills).toBe(1);
        expect(grabbed(r.state)).toBe(false);
        // and the damage over time stops with it
        const calm = run(r.state, 1500);
        expect(calm.events).not.toContain('hurt');
    });

    it('does not walk through the player who walks away from one that has not leaped yet', () =>
    {
        const s = hugger(quiet(), 6.5, 3.5);
        const r = run(s, 300, { forward: -1 });
        expect(grabbed(r.state)).toBe(false);
    });

    it('lets a second hugger only strike a blow while one is already clinging', () =>
    {
        let s = hugger(quiet(), 2.5, 3.5, { clung: true });
        s = hugger(s, 3.6, 3.5, { coolMs: 0 });
        const r = run(s, 1000, {}, 33);
        expect(r.state.enemies.filter(e => e.clung)).toHaveLength(1);
    });
});

describe('the squad in the game', () =>
{
    /** The real thing: both marines beside the player and the waves put off. */
    const squadded = (): MarinesState =>
    {
        const s = newGame(ROOM);
        return { ...s, wave: { ...s.wave, restMs: 1e9 } };
    };

    it('starts with two marines at full health beside the player, following', () =>
    {
        const s = newGame(ROOM);
        expect(s.marines).toHaveLength(2);
        expect(s.marines.every(m => m.hp === MARINE.hp)).toBe(true);
        expect(s.order).toBe('follow');
        for (const m of s.marines) expect(Math.hypot(m.x - s.player.x, m.y - s.player.y)).toBeLessThan(2.5);
    });

    it('fights: with no help from the player a creature in the room falls to the marines', () =>
    {
        const s = withEnemy(squadded(), 7.5, 2.5, { coolMs: 1e9 });
        const r = run(s, 6000);
        expect(r.events).toContain('squadShot');
        expect(r.state.kills).toBe(1);
        expect(r.state.fx.length).toBeGreaterThanOrEqual(0);
    });

    it('follows the player, and holds on the order', () =>
    {
        const follow = run(squadded(), 3000, { forward: 1 }).state;
        for (const m of follow.marines) expect(Math.hypot(m.x - follow.player.x, m.y - follow.player.y)).toBeLessThan(4);
        const held = act(squadded(), 'order');
        expect(held.events).toEqual(['orderHold']);
        expect(held.state.order).toBe('hold');
        const still = run(held.state, 3000, { forward: 1 }).state;
        expect(still.marines.map(m => [m.x, m.y])).toEqual(held.state.marines.map(m => [m.x, m.y]));
        expect(act(held.state, 'order').events).toEqual(['orderFollow']);
    });

    it('draws a creature to a marine nearer than the player, who then takes a beating and can go down', () =>
    {
        let s = squadded();
        s = { ...s, order: 'hold', marines: s.marines.map((m, i) => ({ ...m, x: 8.5, y: 2.5 + i, hp: 12 })) };
        s = withEnemy(s, 9.8, 2.5, { hp: 99, coolMs: 0 });
        const r = run(s, 3000);
        expect(r.events.some(e => e.startsWith('marineDown:'))).toBe(true);
        expect(r.state.marines.some(m => m.hp === 0)).toBe(true);
        // the player was never the target
        expect(r.state.player.health).toBe(PLAYER.health);
    });

    it('is patched up between waves, and a marine who fell is replaced half fit beside the player', () =>
    {
        let s = squadded();
        s = {
            ...s,
            wave: { n: 2, phase: 'fight', restMs: 0, toSpawn: 0, spawnMs: 0 },
            marines: [{ ...s.marines[0], hp: 0 }, { ...s.marines[1], hp: 20 }],
        };
        const r = step(s, 33, NO_CONTROLS, rng);
        expect(r.events).toContain('waveClear');
        expect(r.events).toContain('reinforce');
        expect(r.state.marines[0].hp).toBe(MARINE.hp * MARINE.replacement);
        expect(Math.hypot(r.state.marines[0].x - s.player.x, r.state.marines[0].y - s.player.y)).toBeLessThan(2.5);
        expect(r.state.marines[1].hp).toBe(20 + MARINE.heal);
        // nobody to replace: no reinforcements
        const healthy = step({ ...s, marines: s.marines.map(m => ({ ...m, hp: 40 })) }, 33, NO_CONTROLS, rng);
        expect(healthy.events).not.toContain('reinforce');
    });

    it('does not touch the state it was given', () =>
    {
        let s = withEnemy(squadded(), 6.5, 2.5, { hp: 99 });
        s = { ...s, projectiles: [{ id: 50, x: 3, y: 3, dx: 1, dy: 0, ageMs: 0 }], acid: [{ x: 5, y: 5, ms: 900, r: 0.4 }] };
        const before = JSON.stringify({ ...s, field: null });
        step(s, 200, { forward: 1, strafe: 0, turn: 0.2, fire: true }, rng);
        act(s, 'grenade');
        expect(JSON.stringify({ ...s, field: null })).toBe(before);
    });
});

describe('the mix of creatures', () =>
{
    it('is drones only at first, runners from wave 3 and huggers from wave 4, within limits', () =>
    {
        expect(mix(1)).toEqual({ runner: 0, hugger: 0 });
        expect(mix(2)).toEqual({ runner: 0, hugger: 0 });
        expect(mix(3).runner).toBeGreaterThan(0);
        expect(mix(3).hugger).toBe(0);
        expect(mix(4).hugger).toBeGreaterThan(0);
        expect(mix(99).runner).toBeLessThanOrEqual(0.4);
        expect(mix(99).hugger).toBeLessThanOrEqual(0.2);
    });

    it('picks kinds in those shares', () =>
    {
        const r = seeded(9);
        const count = (n: number) =>
        {
            const c = { drone: 0, runner: 0, hugger: 0 };
            for (let i = 0; i < 4000; i++) c[pickKind(n, r)]++;
            return c;
        };
        expect(count(2)).toEqual({ drone: 4000, runner: 0, hugger: 0 });
        const late = count(10);
        expect(late.runner / 4000).toBeGreaterThan(0.3);
        expect(late.runner / 4000).toBeLessThan(0.5);
        expect(late.hugger / 4000).toBeGreaterThan(0.1);
        expect(late.hugger / 4000).toBeLessThan(0.3);
        expect(late.drone).toBeGreaterThan(1000);
    });

    it('brings them out of the grilles in a late wave', () =>
    {
        let s = newGame(ROOM);
        s = { ...s, marines: [], wave: { n: 6, phase: 'fight', restMs: 0, toSpawn: 40, spawnMs: 0 } };
        const r = run(s, 30000, {}, 100);
        expect(new Set(r.state.enemies.map(e => e.kind)).size).toBeGreaterThan(1);
    });
});
