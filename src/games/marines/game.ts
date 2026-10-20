import { rectMask, type Grid, type Sign } from '../isolation/grid';
import type { Rng } from '../isolation/rng';
import { dirYaw } from '../wire/camera';
import { DIFFICULTY, missionById, missionDone, type DifficultyId, type Rules } from './campaign';
import { castRay } from '../wire/occlusion';
import {
    SPIT, TURRET, WELD, landedSpits, placeTurret, stepTurrets, weldTarget,
    type Spit, type Turret, type Weld, type WeldTarget,
} from './defenses';
import { ENEMIES, buildField, spawnEnemy, stepEnemies, weldKey, type Enemy, type EnemyKind, type Field } from './enemies';
import { parseArena, type ArenaDef, type PickupKind } from './map';
import { angleDiff, angleTo, forward, lineClear, moveCircle, rayCircle, right } from './physics';
import { MARINE, newSquad, spotNear, stepSquad, type Marine, type Order } from './squad';
import { WAVES, aliveCap, pickKind, pickSpawn, spawnIntervalMs, waveBonus, waveSize } from './waves';
import {
    WEAPONS, WEAPON_ORDER, assistTarget, damageAt, flameReach, resolveShot, spreadAt, type Target, type WeaponId,
} from './weapons';

export const PLAYER = {
    radius: 0.25,
    /** cells per second */
    speed: 2.6,
    back: 1.8,
    strafe: 2.2,
    health: 100,
    armor: 50,
    /** the share of every blow the armour takes while it lasts */
    armorShare: 2 / 3,
    /** the share of its speed left while a facehugger clings to the face */
    grabSlow: 0.45,
};

export const TRACKER = {
    /** cells: the grilles are just out of range, so what comes out of them shows up as it gets near */
    range: 10,
    /** a contact stays on the screen this long after a ping */
    blipMs: 1600,
};

export const PICKUPS = { medkit: 40, ammo: WEAPONS.rifle.box, grenade: 2 };

/** The rifle's grenade launcher: a pump action that throws straight and bursts on the first thing it meets. */
export const GRENADE = {
    start: 3,
    max: 6,
    /** cells per second, and the farthest it flies before it bursts on its own */
    speed: 12,
    range: 14,
    cooldownMs: 1000,
    /** cells: the blast hurts everything inside, most at the middle */
    radius: 2,
    damage: 14,
    /** the blast hurts the shooter and the squad too, but only close by */
    selfRadius: 1.6,
    selfDamage: 20,
};

/** A facehugger on the face: it harms every moment until something shoots it off. */
export const GRAB = { tickMs: 600, damage: 4 };

/** What a creature leaves when it falls: a pool that burns whoever stands in it, and a splash on whoever is close. */
export const ACID = { lifeMs: 7000, radius: 0.45, tickMs: 400, damage: 3.5, splashRange: 0.9, splash: 5, max: 10 };

/** Fire keeps hurting after the flame has moved on. */
export const BURN = { ms: 2200, dps: 2.5 };

/** Degrees: the least cone the automatic fire looks along, for weapons with little or no aim assist. */
export const AUTO_CONE_DEG = 4;

/** Time spent drawing another weapon. */
export const SWITCH_MS = 350;

/** Health under which the biomonitor warns. */
export const LOW_HEALTH = 30;

/** The longest slice of time simulated at once, so nothing tunnels through a wall. */
const MAX_SUBSTEP_MS = 50;

export interface Ammo { mag: number; reserve: number }

export interface Player
{
    /** continuous map position */
    x: number;
    y: number;
    yaw: number;
    health: number;
    armor: number;
    /** the weapon in hand, and its magazine and reserve */
    weapon: WeaponId;
    mag: number;
    reserve: number;
    /** the other weapons carried, with their own ammunition */
    stash: Partial<Record<WeaponId, Ammo>>;
    grenades: number;
    /** ms until the next round may leave, and until the reload ends (0 when idle) */
    cooldownMs: number;
    reloadMs: number;
    /** 0..1, grows with sustained fire and widens the spread */
    heat: number;
    /** ms since the last blow, for the flash at the edges of the screen */
    hurtMs: number;
    /** ms since the last round, for the recoil and the muzzle flash */
    firedMs: number;
    /** ms since the last grenade, for the launcher's kick and to space them */
    launchMs: number;
    /** sentry turrets and blowtorch charges carried */
    turrets: number;
    welds: number;
    /** time standing in acid and with a facehugger on the face since the last tick of damage */
    acidMs: number;
    grabMs: number;
    /** 0..1 how much of its speed it moved at last step: the walking bob */
    moveAmt: number;
}

export interface Pickup { cell: number; kind: PickupKind; taken: boolean }

/** A contact the tracker showed, in map units. */
export interface Blip { x: number; y: number; ageMs: number }

/**
 * A short-lived mark. `tracer`: from the player's muzzle to (x2, y2). `beam`: a marine's round from (x, y) to (x2, y2).
 * `spark`: where a round landed. `splat`: a burst where a creature fell. `flame`: the fire from the muzzle to (x2, y2).
 * `blast`: a grenade bursting at (x, y), with radius `r`.
 */
export interface Fx
{
    kind: 'tracer' | 'beam' | 'spark' | 'splat' | 'flame' | 'blast';
    x: number;
    y: number;
    x2: number;
    y2: number;
    ageMs: number;
    lifeMs: number;
    r?: number;
}

/** A grenade in flight. */
export interface Projectile { id: number; x: number; y: number; dx: number; dy: number; ageMs: number }

/** A pool of acid on the floor. */
export interface Acid { x: number; y: number; ms: number; r: number }

export interface Wave
{
    n: number;
    phase: 'rest' | 'fight';
    restMs: number;
    /** creatures still to come out of the grilles */
    toSpawn: number;
    spawnMs: number;
}

export interface MarinesState
{
    phase: 'playing' | 'dead' | 'won';
    arena: string;
    /** the campaign mission being played, if any, and the multipliers of its difficulty */
    mission: string | null;
    rules: Rules;
    /** per cell: without light, so only what the shoulder lamp reaches shows (all false in a lit arena) */
    dark: readonly boolean[];
    /** the mission's queen has come out of a grille */
    queenOut: boolean;
    title: string;
    grid: Grid;
    closed: readonly number[];
    spawns: readonly number[];
    signs: readonly Sign[];
    pickups: readonly Pickup[];
    player: Player;
    /** the squad; one with no health left is down */
    marines: readonly Marine[];
    order: Order;
    enemies: readonly Enemy[];
    projectiles: readonly Projectile[];
    acid: readonly Acid[];
    /** the sentry turrets standing, the doors welded shut and the acid in the air */
    turrets: readonly Turret[];
    welds: readonly Weld[];
    spits: readonly Spit[];
    nextId: number;
    wave: Wave;
    score: number;
    kills: number;
    /** kills of each kind, and what was set up: for the report */
    killsBy: Record<EnemyKind, number>;
    built: { turrets: number; welds: number };
    shots: number;
    hits: number;
    tracker: { pingMs: number; blips: readonly Blip[]; nearest: number | null };
    fx: readonly Fx[];
    timeMs: number;
    /** distances to the player's cell: where the creatures flow */
    field: Field;
}

export interface Controls
{
    /** -1..1; positive walks forward */
    forward: number;
    /** -1..1; positive walks to the right */
    strafe: number;
    /** radians to turn this frame, positive clockwise (the drag on the view) */
    turn: number;
    fire: boolean;
}

export const NO_CONTROLS: Controls = { forward: 0, strafe: 0, turn: 0, fire: false };

/** `switch`: the next weapon carried; `select:<weapon>`: that one; `order`: the squad's order, follow or hold. */
export type Action = 'reload' | 'grenade' | 'switch' | 'order' | 'turret' | 'weld' | `select:${WeaponId}`;

export type GameEvent =
    | 'shot' | 'dry' | 'reloadStart' | 'reloadDone' | 'hit' | 'kill' | 'hurt' | 'lowHealth'
    | 'pickupAmmo' | 'pickupMed' | 'pickupGrenade' | 'waveStart' | 'waveClear' | 'reinforce' | 'spawn' | 'ping' | 'dead'
    | 'turretPlaced' | 'noTurrets' | 'turretShot' | 'turretDown' | 'weldDone' | 'weldCut' | 'noWelds' | 'noDoor' | 'weldBroken' | 'spit'
    | 'launch' | 'blast' | 'won' | 'queen' | 'noGrenades' | 'switch' | 'orderFollow' | 'orderHold' | 'squadShot' | 'grab' | 'acid' | 'splash'
    | `pickupWeapon:${WeaponId}` | `marineDown:${number}`;

export function newGame(arena: ArenaDef, opts: { difficulty?: DifficultyId; mission?: string } = {}): MarinesState
{
    const map = parseArena(arena.map);
    const g = map.grid;
    const def = WEAPONS.rifle;
    const px = (map.start % g.w) + 0.5;
    const py = Math.floor(map.start / g.w) + 0.5;
    const yaw = dirYaw(arena.startDir);
    return {
        phase: 'playing',
        arena: arena.id,
        mission: opts.mission ?? null,
        dark: rectMask(g, arena.dark ?? []),
        queenOut: false,
        rules: { ...DIFFICULTY[opts.difficulty ?? 'veterano'].rules },
        title: arena.title,
        grid: g,
        closed: map.closed,
        spawns: map.spawns,
        signs: arena.signs,
        pickups: map.pickups.map(p => ({ ...p, taken: false })),
        player: {
            x: px, y: py, yaw, health: PLAYER.health, armor: PLAYER.armor,
            weapon: 'rifle', mag: def.mag, reserve: def.mag * 3, stash: {}, grenades: GRENADE.start,
            turrets: TURRET.start, welds: WELD.max,
            cooldownMs: 0, reloadMs: 0, heat: 0, hurtMs: 0, firedMs: 1e6, launchMs: 1e6, acidMs: 0, grabMs: 0, moveAmt: 0,
        },
        marines: newSquad(g, map.closed, px, py, yaw),
        order: 'follow',
        enemies: [],
        projectiles: [],
        acid: [],
        turrets: [],
        welds: [],
        spits: [],
        nextId: 1,
        wave: { n: 1, phase: 'rest', restMs: WAVES.firstRestMs, toSpawn: 0, spawnMs: 0 },
        score: 0,
        kills: 0,
        killsBy: { drone: 0, runner: 0, hugger: 0, spitter: 0, queen: 0 },
        built: { turrets: 0, welds: 0 },
        shots: 0,
        hits: 0,
        tracker: { pingMs: 800, blips: [], nearest: null },
        fx: [],
        timeMs: 0,
        field: buildField(g, map.closed, map.start),
    };
}

export const cellOf = (g: Grid, x: number, y: number) => Math.floor(y) * g.w + Math.floor(x);

/** Shots that landed over shots fired, 0..1. */
export const accuracy = (s: MarinesState) => s.shots ? s.hits / s.shots : 0;

/** Creatures alive plus those still to come. */
export const remaining = (s: MarinesState) => s.enemies.length + (s.wave.phase === 'fight' ? s.wave.toSpawn : 0);

/** The weapons carried, in the order the weapon key goes through them. */
export const owned = (p: Player): WeaponId[] => WEAPON_ORDER.filter(id => id === p.weapon || p.stash[id]);

/** True while a facehugger is on the player's face. */
export const grabbed = (s: MarinesState) => s.enemies.some(e => e.clung);

/**
 * True while a creature is where the weapon is pointing: inside a narrow cone, in range and in plain view. The
 * automatic fire uses it, so the weapon shoots only when it is aimed.
 */
export function inSights(s: MarinesState): boolean
{
    const p = s.player;
    if (s.phase !== 'playing') return false;
    const def = WEAPONS[p.weapon];
    const cone = Math.max(def.assistDeg, def.coneDeg, AUTO_CONE_DEG);
    return assistTarget(s.grid, s.closed, p.x, p.y, p.yaw, targetsOf(s.enemies.filter(e => !e.clung)), { ...def, assistDeg: cone }) !== null;
}

/** The creature the sights are marking, for weapons that mark one. */
export function lockTarget(s: MarinesState): number | null
{
    const p = s.player;
    const def = WEAPONS[p.weapon];
    if (!def.lock || s.phase !== 'playing') return null;
    return assistTarget(s.grid, s.closed, p.x, p.y, p.yaw, targetsOf(s.enemies.filter(e => !e.clung)), def)?.id ?? null;
}

/** The door the blowtorch would work on from where the player stands, or null. */
export function weldAim(s: MarinesState): WeldTarget | null
{
    const p = s.player;
    const bodies = [
        { x: p.x, y: p.y },
        ...s.enemies.filter(e => !e.clung),
        ...s.marines.filter(m => m.hp > 0),
        ...s.turrets,
    ];
    return weldTarget(s.grid, s.closed, s.welds, p.x, p.y, p.yaw, bodies);
}

const targetsOf = (enemies: readonly Enemy[]): Target[] => enemies.map(e => ({ id: e.id, x: e.x, y: e.y, radius: ENEMIES[e.kind].radius }));

/** The player's discrete actions. */
export function act(s: MarinesState, action: Action): { state: MarinesState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    // the stash is written to below: it is copied so that the state we were given stays as it was
    const p: Player = { ...s.player, stash: { ...s.player.stash } };

    if (action === 'reload')
    {
        if (startReload(p, events)) return { state: { ...s, player: p }, events };
    }
    else if (action === 'order')
    {
        const order: Order = s.order === 'follow' ? 'hold' : 'follow';
        return { state: { ...s, order }, events: [order === 'follow' ? 'orderFollow' : 'orderHold'] };
    }
    else if (action === 'turret')
    {
        if (p.turrets <= 0 || s.turrets.length >= TURRET.max) return { state: s, events: ['noTurrets'] };
        const id = TURRET.idBase + s.nextId;
        const turret = placeTurret(s.grid, s.closed, p.x, p.y, p.yaw, id, s.turrets);
        if (!turret) return { state: s, events: ['noTurrets'] };
        p.turrets--;
        return {
            state: { ...s, player: p, turrets: [...s.turrets, turret], nextId: s.nextId + 1, built: { ...s.built, turrets: s.built.turrets + 1 } },
            events: ['turretPlaced'],
        };
    }
    else if (action === 'weld')
    {
        const target = weldAim(s);
        if (!target) return { state: s, events: ['noDoor'] };
        if (target.action === 'cut')
        {
            p.welds = Math.min(WELD.max, p.welds + 1);
            return {
                state: { ...s, player: p, welds: s.welds.filter(w => w.cell !== target.cell), closed: s.closed.filter(c => c !== target.cell), field: { ...s.field, key: '?' } },
                events: ['weldCut'],
            };
        }
        if (p.welds <= 0) return { state: s, events: ['noWelds'] };
        p.welds--;
        return {
            state: {
                ...s, player: p, welds: [...s.welds, { cell: target.cell, hp: WELD.hp }], closed: [...s.closed, target.cell],
                field: { ...s.field, key: '?' }, built: { ...s.built, welds: s.built.welds + 1 },
            },
            events: ['weldDone'],
        };
    }
    else if (action === 'grenade')
    {
        if (p.launchMs < GRENADE.cooldownMs) return { state: s, events };
        if (p.grenades <= 0) return { state: s, events: ['noGrenades'] };
        // thrown at the creature the rifle would aim at, if any
        const mark = assistTarget(s.grid, s.closed, p.x, p.y, p.yaw, targetsOf(s.enemies.filter(e => !e.clung)), WEAPONS.rifle);
        const aim = mark ? angleTo(p.x, p.y, mark.x, mark.y) : p.yaw;
        const [dx, dy] = forward(aim);
        p.grenades--;
        p.launchMs = 0;
        const grenade: Projectile = { id: s.nextId, x: p.x + dx * 0.2, y: p.y + dy * 0.2, dx, dy, ageMs: 0 };
        return { state: { ...s, player: p, projectiles: [...s.projectiles, grenade], nextId: s.nextId + 1 }, events: ['launch'] };
    }
    else
    {
        const have = owned(p);
        const target = action === 'switch' ? have[(have.indexOf(p.weapon) + 1) % have.length] : action.slice('select:'.length) as WeaponId;
        if (target !== p.weapon && have.includes(target))
        {
            drawWeapon(p, target);
            return { state: { ...s, player: p }, events: ['switch'] };
        }
    }
    return { state: s, events };
}

/** Puts the weapon in hand away with its ammunition and takes `id` out of the stash. */
function drawWeapon(p: Player, id: WeaponId)
{
    const next = p.stash[id];
    if (!next) return;
    p.stash[p.weapon] = { mag: p.mag, reserve: p.reserve };
    delete p.stash[id];
    p.weapon = id;
    p.mag = next.mag;
    p.reserve = next.reserve;
    p.reloadMs = 0;
    p.heat = 0;
    p.cooldownMs = Math.max(p.cooldownMs, SWITCH_MS);
}

function startReload(p: Player, events: GameEvent[]): boolean
{
    const def = WEAPONS[p.weapon];
    if (p.reloadMs > 0 || p.mag >= def.mag || p.reserve <= 0) return false;
    p.reloadMs = def.reloadMs;
    events.push('reloadStart');
    return true;
}

/** Armour takes its share of the blow while it lasts; the rest hurts. */
export function hurt(p: Player, damage: number)
{
    const soak = Math.min(p.armor, damage * PLAYER.armorShare);
    p.armor -= soak;
    p.health -= damage - soak;
    p.hurtMs = 350;
}

/** Time passing: the player moves and shoots, the squad fights, the creatures come and strike, the tracker pings. */
export function step(s: MarinesState, dtMs: number, controls: Controls, rng: Rng): { state: MarinesState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    let state = s;
    let left = dtMs;
    let c = controls;
    while (left > 0 && state.phase === 'playing')
    {
        const slice = Math.min(MAX_SUBSTEP_MS, left);
        const r = stepOnce(state, slice, c, rng);
        state = r.state;
        events.push(...r.events);
        left -= slice;
        // the turn is applied once, the rest of the controls hold for every slice
        c = { ...c, turn: 0 };
    }
    return { state, events };
}

/** The copy `stepOnce` works on and mutates: the same shape as the state, with its lists open. */
interface Work extends Omit<MarinesState, 'enemies' | 'pickups' | 'fx' | 'tracker' | 'marines' | 'projectiles' | 'acid' | 'turrets' | 'welds' | 'spits' | 'closed' | 'killsBy' | 'built'>
{
    closed: number[];
    turrets: Turret[];
    welds: Weld[];
    spits: Spit[];
    killsBy: Record<EnemyKind, number>;
    built: { turrets: number; welds: number };
    enemies: Enemy[];
    pickups: Pickup[];
    fx: Fx[];
    marines: Marine[];
    projectiles: Projectile[];
    acid: Acid[];
    tracker: { pingMs: number; blips: Blip[]; nearest: number | null };
}

function clone(s: MarinesState): Work
{
    return {
        ...s,
        player: { ...s.player, stash: { ...s.player.stash } },
        marines: s.marines.map(m => ({ ...m })),
        enemies: s.enemies.map(e => ({ ...e })),
        projectiles: s.projectiles.map(p => ({ ...p })),
        acid: s.acid.map(a => ({ ...a })),
        closed: [...s.closed],
        turrets: s.turrets.map(t => ({ ...t })),
        welds: s.welds.map(w => ({ ...w })),
        spits: s.spits.map(sp => ({ ...sp })),
        killsBy: { ...s.killsBy },
        built: { ...s.built },
        pickups: s.pickups.map(p => ({ ...p })),
        wave: { ...s.wave },
        tracker: { ...s.tracker, blips: s.tracker.blips.map(b => ({ ...b })) },
        fx: s.fx.map(f => ({ ...f })),
    };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** One slice of at most MAX_SUBSTEP_MS. Works on a copy: the state it was given is not touched. */
function stepOnce(s0: MarinesState, dt: number, controls: Controls, rng: Rng): { state: MarinesState; events: GameEvent[] }
{
    const s = clone(s0);
    const events: GameEvent[] = [];
    const p = s.player;
    const g = s.grid;
    const enemies = s.enemies;
    const healthBefore = p.health;

    s.timeMs += dt;
    // the cooldown may run up to one slice past zero: the next round leaves that much sooner, so the cadence
    // doesn't depend on the frame rate
    p.cooldownMs = Math.max(-dt, p.cooldownMs - dt);
    p.hurtMs = Math.max(0, p.hurtMs - dt);
    p.firedMs += dt;
    p.launchMs += dt;

    // turn and walk
    p.yaw = angleDiff(p.yaw + controls.turn, 0);
    movePlayer(s, dt, controls);

    // the creatures flow towards the player's cell; the marines use the same field
    const here = cellOf(g, p.x, p.y);
    const weldMap = new Map(s.welds.map((w): [number, number] => [w.cell, w.hp]));
    if (s.field.cell !== here || s.field.key !== weldKey(weldMap)) s.field = buildField(g, s.closed, here, weldMap);

    // pickups
    for (const pk of s.pickups)
    {
        if (pk.taken) continue;
        if (Math.hypot(p.x - ((pk.cell % g.w) + 0.5), p.y - (Math.floor(pk.cell / g.w) + 0.5)) > 0.55) continue;
        if (take(p, pk.kind, events)) pk.taken = true;
    }

    // the reload ends, or the trigger is pulled
    if (p.reloadMs > 0)
    {
        p.reloadMs -= dt;
        if (p.reloadMs <= 0)
        {
            const def = WEAPONS[p.weapon];
            const taken = Math.min(def.mag - p.mag, p.reserve);
            p.mag += taken;
            p.reserve -= taken;
            p.reloadMs = 0;
            events.push('reloadDone');
        }
    }
    if (controls.fire && p.reloadMs === 0 && p.cooldownMs <= 0)
    {
        if (p.mag > 0) shoot(s, rng, events);
        else if (!startReload(p, events))
        {
            p.cooldownMs = 300;
            events.push('dry');
        }
    }
    // the spread settles only once the trigger is let go (or while it reloads)
    if (!controls.fire || p.reloadMs > 0) p.heat = Math.max(0, p.heat - WEAPONS[p.weapon].heatDecayPerS * dt / 1000);

    stepProjectiles(s, dt, events);

    // fire keeps burning
    for (const e of enemies)
    {
        if (e.burnMs <= 0) continue;
        e.hp -= BURN.dps * Math.min(dt, e.burnMs) / 1000;
        e.burnMs = Math.max(0, e.burnMs - dt);
    }

    // the squad shoots, and walks
    for (const shot of stepSquad(s.marines, { grid: g, closed: s.closed, field: s.field, px: p.x, py: p.y, yaw: p.yaw, order: s.order, enemies }, dt, rng))
    {
        s.fx.push({ kind: 'beam', x: shot.x, y: shot.y, x2: shot.x2, y2: shot.y2, ageMs: 0, lifeMs: 110 });
        events.push('squadShot');
    }

    // the turrets turn and shoot
    for (const shot of stepTurrets(s.turrets, { grid: g, closed: s.closed, enemies }, dt, rng))
    {
        s.fx.push({ kind: 'beam', x: shot.x, y: shot.y, x2: shot.x2, y2: shot.y2, ageMs: 0, lifeMs: 110 });
        events.push('turretShot');
    }

    // creatures that fell
    for (let i = enemies.length - 1; i >= 0; i--)
    {
        const e = enemies[i];
        if (e.hp > 0) continue;
        enemies.splice(i, 1);
        s.kills++;
        s.killsBy[e.kind]++;
        s.score += ENEMIES[e.kind].score;
        s.fx.push({ kind: 'splat', x: e.x, y: e.y, x2: e.x, y2: e.y, ageMs: 0, lifeMs: 450 });
        events.push('kill');
        // the blood is acid: it pools, and it spits at whoever is close. (One that fell off the player's face leaves none.)
        if (e.clung) continue;
        s.acid.push({ x: e.x, y: e.y, ms: ACID.lifeMs, r: ACID.radius * (e.kind === 'hugger' ? 0.7 : e.kind === 'queen' ? 1.7 : 1) });
        while (s.acid.length > ACID.max) s.acid.shift();
        if (Math.hypot(e.x - p.x, e.y - p.y) <= ACID.splashRange)
        {
            hurt(p, ACID.splash);
            events.push('splash');
        }
    }

    stepWave(s, dt, rng, events);

    const victims = [...s.marines.filter(m => m.hp > 0), ...s.turrets].map(m => ({ id: m.id, x: m.x, y: m.y }));
    const strikes = stepEnemies(enemies, { grid: g, closed: s.closed, field: s.field, px: p.x, py: p.y, marines: victims, welds: weldMap }, dt);
    for (const st of strikes)
    {
        if (st.spit)
        {
            const from = enemies.find(en => en.id === st.enemy);
            if (!from) continue;
            s.spits.push({ id: s.nextId++, x: from.x, y: from.y, tx: st.spit.x, ty: st.spit.y, ms: SPIT.flightMs, totalMs: SPIT.flightMs });
            events.push('spit');
            continue;
        }
        if (st.target !== null && st.target >= TURRET.idBase)
        {
            const t = s.turrets.find(o => o.id === st.target);
            if (!t) continue;
            t.hp -= st.damage;
            t.hitMs = 250;
            continue;
        }
        if (st.target === null)
        {
            if (st.grab && !enemies.some(e => e.clung))
            {
                const e = enemies.find(en => en.id === st.enemy);
                if (e)
                {
                    e.clung = true;
                    e.windMs = -1;
                    events.push('grab');
                }
                continue;
            }
            hurt(p, st.damage * s.rules.hurt);
            events.push('hurt');
            continue;
        }
        const m = s.marines.find(o => o.id === st.target);
        if (!m || m.hp <= 0) continue;
        m.hp -= st.damage * s.rules.hurt;
        m.hitMs = 250;
        if (m.hp <= 0)
        {
            m.hp = 0;
            events.push(`marineDown:${s.marines.indexOf(m)}`);
        }
    }

    // the welds that were gnawed through give way, and the turrets that were wrecked or have run dry go
    s.welds = s.welds.map(w => ({ cell: w.cell, hp: weldMap.get(w.cell) ?? w.hp }));
    const broken = s.welds.filter(w => w.hp <= 0).map(w => w.cell);
    if (broken.length)
    {
        s.welds = s.welds.filter(w => w.hp > 0);
        s.closed = s.closed.filter(c => !broken.includes(c));
        events.push('weldBroken');
    }
    const wrecked = s.turrets.length;
    s.turrets = s.turrets.filter(t => t.hp > 0);
    if (s.turrets.length < wrecked) events.push('turretDown');

    // gobs of acid come down
    for (const sp of landedSpits(s.spits, dt))
    {
        s.acid.push({ x: sp.tx, y: sp.ty, ms: ACID.lifeMs, r: SPIT.pool });
        while (s.acid.length > ACID.max) s.acid.shift();
        s.fx.push({ kind: 'splat', x: sp.tx, y: sp.ty, x2: sp.tx, y2: sp.ty, ageMs: 0, lifeMs: 450 });
        if (Math.hypot(p.x - sp.tx, p.y - sp.ty) < SPIT.radius)
        {
            hurt(p, SPIT.damage * s.rules.hurt);
            events.push('splash');
        }
        for (const m of s.marines)
        {
            if (m.hp <= 0 || Math.hypot(m.x - sp.tx, m.y - sp.ty) >= SPIT.radius) continue;
            m.hp -= SPIT.damage;
            m.hitMs = 250;
            if (m.hp <= 0)
            {
                m.hp = 0;
                events.push(`marineDown:${s.marines.indexOf(m)}`);
            }
        }
        for (const t of s.turrets) if (Math.hypot(t.x - sp.tx, t.y - sp.ty) < SPIT.radius) t.hp -= SPIT.damage;
    }

    // a facehugger on the face, and standing in acid
    if (enemies.some(e => e.clung))
    {
        p.grabMs += dt;
        if (p.grabMs >= GRAB.tickMs)
        {
            p.grabMs -= GRAB.tickMs;
            hurt(p, GRAB.damage);
            events.push('hurt');
        }
    }
    else p.grabMs = 0;

    for (const a of s.acid) a.ms -= dt;
    s.acid = s.acid.filter(a => a.ms > 0);
    if (s.acid.some(a => Math.hypot(a.x - p.x, a.y - p.y) < a.r))
    {
        p.acidMs += dt;
        if (p.acidMs >= ACID.tickMs)
        {
            p.acidMs -= ACID.tickMs;
            hurt(p, ACID.damage);
            events.push('acid');
        }
    }
    else p.acidMs = 0;

    stepFx(s, dt);
    stepTracker(s, dt, events);

    if (s.phase === 'playing' && p.health > 0 && missionDone(s))
    {
        s.phase = 'won';
        events.push('won');
    }
    if (healthBefore >= LOW_HEALTH && p.health < LOW_HEALTH && p.health > 0) events.push('lowHealth');
    if (p.health <= 0)
    {
        p.health = 0;
        s.phase = 'dead';
        events.push('dead');
    }
    return { state: s, events };
}

/** Adds up to `amount` to a weapon's reserve; false when it is full or not carried. */
function addReserve(p: Player, id: WeaponId, amount: number): boolean
{
    const max = WEAPONS[id].reserveMax;
    if (id === p.weapon)
    {
        if (p.reserve >= max) return false;
        p.reserve = Math.min(max, p.reserve + amount);
        return true;
    }
    const a = p.stash[id];
    if (!a || a.reserve >= max) return false;
    p.stash[id] = { ...a, reserve: Math.min(max, a.reserve + amount) };
    return true;
}

/** Picks something up; false when it would be wasted, so it stays on the floor. */
function take(p: Player, kind: PickupKind, events: GameEvent[]): boolean
{
    if (kind === 'medkit')
    {
        if (p.health >= PLAYER.health) return false;
        p.health = Math.min(PLAYER.health, p.health + PICKUPS.medkit);
        events.push('pickupMed');
        return true;
    }
    if (kind === 'grenade')
    {
        if (p.grenades >= GRENADE.max) return false;
        p.grenades = Math.min(GRENADE.max, p.grenades + PICKUPS.grenade);
        events.push('pickupGrenade');
        return true;
    }
    if (kind === 'ammo')
    {
        // a box restocks every weapon carried
        let used = false;
        for (const id of owned(p)) used = addReserve(p, id, WEAPONS[id].box) || used;
        if (used) events.push('pickupAmmo');
        return used;
    }
    // a weapon crate: the weapon with a full magazine, and into the hand; one already carried is only restocked
    if (owned(p).includes(kind))
    {
        const used = addReserve(p, kind, WEAPONS[kind].box);
        if (used) events.push('pickupAmmo');
        return used;
    }
    p.stash[kind] = { mag: WEAPONS[kind].mag, reserve: WEAPONS[kind].crate };
    drawWeapon(p, kind);
    events.push(`pickupWeapon:${kind}`);
    return true;
}

function movePlayer(s: Work, dt: number, controls: Controls)
{
    const p = s.player;
    const f = clamp(controls.forward, -1, 1);
    const st = clamp(controls.strafe, -1, 1);
    const [fx, fy] = forward(p.yaw);
    const [rx, ry] = right(p.yaw);
    const fwdSpeed = f >= 0 ? PLAYER.speed : PLAYER.back;
    let vx = fx * f * fwdSpeed + rx * st * PLAYER.strafe;
    let vy = fy * f * fwdSpeed + ry * st * PLAYER.strafe;
    const len = Math.hypot(vx, vy);
    // going diagonally is no faster
    if (len > PLAYER.speed)
    {
        vx *= PLAYER.speed / len;
        vy *= PLAYER.speed / len;
    }
    // a facehugger on the face slows them
    const slow = s.enemies.some(e => e.clung) ? PLAYER.grabSlow : 1;
    const dx = vx * slow * dt / 1000;
    const dy = vy * slow * dt / 1000;
    let moved = { x: p.x, y: p.y };
    if (dx !== 0 || dy !== 0)
    {
        // whole move first, then one axis at a time: it slides along walls and creatures
        for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]])
        {
            if (mx === 0 && my === 0) continue;
            const n = moveCircle(s.grid, s.closed, p.x, p.y, mx, my, PLAYER.radius);
            if (n.x === p.x && n.y === p.y) continue;
            if (blockedByCreature(s, n.x, n.y, p.x, p.y)) continue;
            moved = n;
            break;
        }
    }
    const travelled = Math.hypot(moved.x - p.x, moved.y - p.y);
    p.moveAmt = clamp(travelled / (PLAYER.speed * dt / 1000), 0, 1);
    p.x = moved.x;
    p.y = moved.y;
}

/** True when moving to (x, y) would push into a creature the player was not already touching. */
function blockedByCreature(s: Work, x: number, y: number, fromX: number, fromY: number): boolean
{
    for (const e of s.enemies)
    {
        if (e.clung) continue;
        const min = PLAYER.radius + ENEMIES[e.kind].radius * 0.8;
        if (Math.hypot(e.x - x, e.y - y) < min && Math.hypot(e.x - fromX, e.y - fromY) >= min) return true;
    }
    return false;
}

function shoot(s: Work, rng: Rng, events: GameEvent[])
{
    const p = s.player;
    const def = WEAPONS[p.weapon];
    const spread = spreadAt(def, p.heat);

    p.mag--;
    p.cooldownMs += def.fireMs;
    p.heat = Math.min(1, p.heat + def.heatPerShot);
    p.firedMs = 0;
    s.shots++;
    events.push('shot');

    let landed = false;
    if (def.kind === 'flame')
    {
        const reach = flameReach(s.grid, s.closed, p.x, p.y, p.yaw, targetsOf(s.enemies), def);
        const [fx, fy] = forward(p.yaw);
        s.fx.push({ kind: 'flame', x: p.x, y: p.y, x2: p.x + fx * reach.tip, y2: p.y + fy * reach.tip, ageMs: 0, lifeMs: 220 });
        for (const h of reach.hits)
        {
            const e = s.enemies.find(en => en.id === h.id);
            if (!e) continue;
            e.hp -= damageAt(def, h.distance);
            e.burnMs = BURN.ms;
            e.hitMs = 120;
            landed = true;
        }
    }
    else
    {
        const targets = targetsOf(s.enemies);
        const damage = new Map<number, number>();
        for (let i = 0; i < def.pellets; i++)
        {
            const shot = resolveShot(s.grid, s.closed, p.x, p.y, p.yaw, targets, def, spread, rng);
            // a few of the pellets get a tracer and a spark: all of them would be a wall of lines
            if (i < 3)
            {
                s.fx.push({ kind: 'tracer', x: p.x, y: p.y, x2: shot.impactX, y2: shot.impactY, ageMs: 0, lifeMs: 90 });
                s.fx.push({ kind: 'spark', x: shot.impactX, y: shot.impactY, x2: shot.impactX, y2: shot.impactY, ageMs: 0, lifeMs: 140 });
            }
            if (shot.hitId !== null) damage.set(shot.hitId, (damage.get(shot.hitId) ?? 0) + damageAt(def, shot.distance));
        }
        for (const [id, dmg] of damage)
        {
            const e = s.enemies.find(en => en.id === id);
            if (!e) continue;
            e.hp -= dmg;
            e.hitMs = 120;
            landed = true;
        }
    }
    if (landed)
    {
        s.hits++;
        events.push('hit');
    }
    // an empty magazine reloads by itself
    if (p.mag === 0) startReload(p, events);
}

/** Moves the grenades; each bursts on a wall, on a creature, or at the end of its flight. */
function stepProjectiles(s: Work, dt: number, events: GameEvent[])
{
    const keep: Projectile[] = [];
    for (const pr of s.projectiles)
    {
        const move = GRENADE.speed * dt / 1000;
        pr.ageMs += dt;
        let stop: number | null = null;
        // the wall, with a little room so the burst is in the open
        const wall = castRay(s.grid, s.closed, pr.x, pr.y, pr.dx, pr.dy, move + 0.15);
        if (wall < move + 0.15) stop = Math.max(0, wall - 0.15);
        for (const e of s.enemies)
        {
            if (e.clung) continue;
            const d = rayCircle(pr.x, pr.y, pr.dx, pr.dy, e.x, e.y, ENEMIES[e.kind].radius + 0.08);
            if (d !== null && d <= move && (stop === null || d < stop)) stop = d;
        }
        if (stop === null && pr.ageMs >= GRENADE.range / GRENADE.speed * 1000) stop = move;
        if (stop !== null)
        {
            explode(s, pr.x + pr.dx * stop, pr.y + pr.dy * stop, events);
            continue;
        }
        pr.x += pr.dx * move;
        pr.y += pr.dy * move;
        keep.push(pr);
    }
    s.projectiles = keep;
}

/** A grenade bursts: every creature near and in the open takes damage, the more the nearer; so do the player and the squad. */
function explode(s: Work, x: number, y: number, events: GameEvent[])
{
    const p = s.player;
    const open = (tx: number, ty: number) => lineClear(s.grid, s.closed, x, y, tx, ty);
    for (const e of s.enemies)
    {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d > GRENADE.radius + ENEMIES[e.kind].radius || !open(e.x, e.y)) continue;
        e.hp -= GRENADE.damage * (1 - 0.7 * Math.min(1, d / GRENADE.radius));
        e.hitMs = 150;
    }
    const near = (d: number) => GRENADE.selfDamage * (1 - d / GRENADE.selfRadius);
    const dp = Math.hypot(p.x - x, p.y - y);
    if (dp < GRENADE.selfRadius && open(p.x, p.y))
    {
        hurt(p, near(dp));
        events.push('hurt');
    }
    for (const m of s.marines)
    {
        const dm = Math.hypot(m.x - x, m.y - y);
        if (m.hp <= 0 || dm >= GRENADE.selfRadius || !open(m.x, m.y)) continue;
        m.hp -= near(dm);
        m.hitMs = 250;
        if (m.hp <= 0)
        {
            m.hp = 0;
            events.push(`marineDown:${s.marines.indexOf(m)}`);
        }
    }
    s.fx.push({ kind: 'blast', x, y, x2: x, y2: y, ageMs: 0, lifeMs: 380, r: GRENADE.radius });
    events.push('blast');
}

function stepWave(s: Work, dt: number, rng: Rng, events: GameEvent[])
{
    const w = s.wave;
    const enemies = s.enemies;
    if (w.phase === 'rest')
    {
        w.restMs -= dt;
        if (w.restMs <= 0)
        {
            w.phase = 'fight';
            w.toSpawn = Math.max(1, Math.round(waveSize(w.n) * s.rules.count));
            w.spawnMs = 600;
            events.push('waveStart');
            // the mission's queen comes out with the wave she is due in
            const due = s.mission ? missionById(s.mission)?.goals.queen : undefined;
            if (due !== undefined && !s.queenOut && w.n >= due)
            {
                const queen = spawnEnemy(s.nextId++, 'queen', s.grid, pickSpawn(s.grid, s.spawns, enemies, s.player.x, s.player.y, rng));
                queen.hp *= s.rules.hp;
                enemies.push(queen);
                s.queenOut = true;
                events.push('queen');
            }
        }
        return;
    }

    if (w.toSpawn > 0)
    {
        w.spawnMs -= dt;
        if (w.spawnMs <= 0 && enemies.length < aliveCap(w.n))
        {
            const cell = pickSpawn(s.grid, s.spawns, enemies, s.player.x, s.player.y, rng);
            const e = spawnEnemy(s.nextId++, pickKind(w.n, rng), s.grid, cell);
            e.hp *= s.rules.hp;
            enemies.push(e);
            w.toSpawn--;
            w.spawnMs = spawnIntervalMs(w.n);
            events.push('spawn');
        }
    }
    else if (enemies.length === 0)
    {
        s.score += waveBonus(w.n);
        events.push('waveClear');
        for (const pk of s.pickups) pk.taken = false;
        // the turrets are rearmed and patched, and a charge of each kind is given back
        for (const t of s.turrets)
        {
            t.ammo = TURRET.ammo;
            t.hp = Math.min(TURRET.hp, t.hp + TURRET.mend);
        }
        s.player.turrets = Math.min(TURRET.cap, s.player.turrets + 1);
        s.player.welds = WELD.max;
        reinforce(s, events);
        w.n++;
        w.phase = 'rest';
        w.restMs = WAVES.restMs;
    }
}

/** Between waves the squad is patched up, and a marine who fell is replaced by a fresh one, half fit. */
function reinforce(s: Work, events: GameEvent[])
{
    const p = s.player;
    let replaced = false;
    s.marines.forEach((m, i) =>
    {
        if (m.hp > 0)
        {
            m.hp = Math.min(MARINE.hp, m.hp + MARINE.heal);
            return;
        }
        const at = spotNear(s.grid, s.closed, p.x, p.y, p.yaw, i);
        m.x = at.x;
        m.y = at.y;
        m.hp = MARINE.hp * MARINE.replacement;
        m.stuckMs = 0;
        replaced = true;
    });
    if (replaced) events.push('reinforce');
}

function stepFx(s: Work, dt: number)
{
    for (const f of s.fx) f.ageMs += dt;
    s.fx = s.fx.filter(f => f.ageMs < f.lifeMs);
}

function stepTracker(s: Work, dt: number, events: GameEvent[])
{
    const t = s.tracker;
    t.blips = t.blips.map(b => ({ ...b, ageMs: b.ageMs + dt })).filter(b => b.ageMs < TRACKER.blipMs);
    t.pingMs -= dt;
    if (t.pingMs > 0) return;

    // a ping shows what moves within range
    const moving = s.enemies.filter(e => e.moving && Math.hypot(e.x - s.player.x, e.y - s.player.y) <= TRACKER.range);
    t.blips = moving.map(e => ({ x: e.x, y: e.y, ageMs: 0 }));
    t.nearest = moving.length ? Math.min(...moving.map(e => Math.hypot(e.x - s.player.x, e.y - s.player.y))) : null;
    t.pingMs = pingInterval(t.nearest);
    events.push('ping');
}

/** The tracker beeps faster the closer the nearest contact. */
export function pingInterval(nearest: number | null)
{
    return nearest === null ? 1500 : 450 + 900 * Math.min(1, nearest / TRACKER.range);
}
