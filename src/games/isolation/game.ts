import { ALIEN, alienPosition, hear, newAlien, patrolTarget, scare, stepAlien, type Alien, type World } from './alien';
import { newAsh, stepAsh, type Ash, type AshWorld } from './android';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { BAG_MAX, FUEL_FOUND, craft, canCraft, emptyBag, recipeOf, type Bag, type RecipeId } from './crafting';
import { blocks, cellAt, cellX, cellY, distances, mountWall, neighbour, parseMap, rectMask, turn, type Dir, type Grid, type Loot, type Sign } from './grid';
import type { DeckDef } from './decks';
import type { Rng } from './rng';

export const WALK_MS = 380;
export const BACK_MS = 520;
export const TURN_MS = 200;
export const USE_MS = 300;
/** standing at a terminal this long saves; the player can't move meanwhile */
export const SAVE_MS = 3000;

/** How far each sound carries, in cells. */
export const NOISE = { step: 2, door: 5, locker: 1, ping: 2, pickup: 1, terminal: 1, throw: 2, craft: 1, fire: 7, decoy: 7 };

export const TOOLS = {
    craftMs: 1500,
    throwMs: 400,
    fireMs: 700,
    /** cells a thrown decoy or flare flies along the facing line */
    throwRange: 5,
    decoyMs: 10000,
    decoyEveryMs: 1200,
    flareMs: 30000,
    /** cells (steps through open space) a flare lights */
    flareRadius: 4,
    /** cells the flame reaches */
    flameRange: 3,
    /** how long the flame is drawn */
    flameShowMs: 500,
};

/** Pipes that leak: a leaking cell can't be crossed for `onMs` of every `periodMs`. */
export const STEAM = { periodMs: 9000, onMs: 3500, stagger: 3100 };

/** Jones meows while he is carried, and the sound carries. */
export const MEOW = { everyMs: 22000, loudness: 3 };

export const TRACKER = {
    /** cells */
    range: 12,
    /** the tracker only shows what moved this recently */
    motionMs: 1500,
};

/** Distance under which the creature is "near": interference, hiss. */
export const NEAR_CELLS = 3;
/** a vent opening this close is heard */
const VENT_HEARD_CELLS = 6;

/** Each earlier hide in the same locker makes the creature likelier to look inside. */
export function lockerCheckChance(timesHiddenThere: number)
{
    return Math.min(0.6, 0.2 * Math.max(0, timesHiddenThere - 1));
}

export type CraftInput = 'craftDecoy' | 'craftFlare' | 'craftFuel';

export type Input = 'forward' | 'back' | 'left' | 'right' | 'use' | 'tracker' | 'throwDecoy' | 'throwFlare' | 'fire' | CraftInput;

const CRAFT: Record<CraftInput, RecipeId> = { craftDecoy: 'decoy', craftFlare: 'flare', craftFuel: 'fuel' };

export type GameEvent =
    | 'step' | 'turn' | 'bump' | 'doorOpen' | 'doorClose' | 'doorForced' | 'pickup' | 'allCells' | 'exitLocked'
    | 'lootScrap' | 'lootWires' | 'lootChems' | 'lootFlamer' | 'lootCat' | 'bagFull' | 'locked' | 'steamBlock' | 'steam'
    | 'ashSpotted' | 'ashLost' | 'ashOff' | 'diverted' | 'log' | 'mapped' | 'blackout' | 'powerBack' | 'countdown' | 'blast' | 'meow'
    | 'hide' | 'unhide' | 'saveStart' | 'saved' | 'trackerUp' | 'trackerDown' | 'ping'
    | CraftInput | 'noParts' | 'throwDecoy' | 'throwFlare' | 'noDecoy' | 'noFlare' | 'noFlamer' | 'noFuel'
    | 'fire' | 'scare' | 'decoyPing' | 'flareOut'
    | 'heard' | 'spotted' | 'lostTrack' | 'ventIn' | 'ventOut' | 'ventNear' | 'near' | 'far' | 'found'
    | 'dead' | 'won';

const LOOT_EVENT = { scrap: 'lootScrap', wires: 'lootWires', chems: 'lootChems' } as const;

export interface Player
{
    cell: number;
    dir: Dir;
    hidden: boolean;
    /** until the current move or turn ends; new ones are ignored meanwhile */
    busyMs: number;
}

/** A noisemaker lying where it was thrown: it keeps calling the creature until it runs out. */
export interface Decoy { cell: number; ms: number; pulseMs: number }

/** A burning flare: lights the cells around it for a while. */
export interface Flare { cell: number; ms: number; lit: number[] }

/** What a terminal does besides saving, resolved to cell indexes. */
export interface TerminalRole { log?: string; ashOff?: boolean; opens?: number }

/** Why the run ended, for the screen that follows. */
export type Death = 'alien' | 'ash' | 'blast';

/** What the player takes from one deck to the next. */
export interface Carry
{
    difficulty: Difficulty;
    bag: Bag;
    jones: boolean;
    logs: readonly string[];
    fires: number;
    spotted: number;
    score: number;
    timeMs: number;
}

export interface GameState
{
    phase: 'playing' | 'dead' | 'won';
    death: Death | null;
    difficulty: Difficulty;
    deck: string;
    title: string;
    grid: Grid;
    signs: readonly Sign[];
    closed: readonly number[];
    items: readonly number[];
    /** materials and the flamethrower still on the floor */
    loot: readonly Loot[];
    bag: Bag;
    decoys: readonly Decoy[];
    flares: readonly Flare[];
    /** per cell: no power, so unlit unless a flare reaches it (empty when the deck has no dark zone) */
    dark: readonly boolean[];
    /** the zones that lose power now and then: the cells in them, and whether they are out right now */
    blackout: { mask: readonly boolean[]; base: readonly boolean[]; periodMs: number; offMs: number; on: boolean } | null;
    /** doors without power, shut until a terminal diverts it */
    locked: readonly number[];
    /** cells with a steam leak */
    steam: readonly number[];
    /** what each terminal does besides saving (by cell index) */
    roles: Readonly<Record<number, TerminalRole>>;
    /** the android, if the deck has one */
    ash: Ash | null;
    /** self-destruct countdown left, or null */
    countdownMs: number | null;
    /** Jones is with the player */
    jones: boolean;
    /** the crew logs read in this run */
    logs: readonly string[];
    /** flamethrower shots fired in this run, and times the creature spotted the player */
    fires: number;
    spotted: number;
    /** `spotted` when this deck began */
    spottedStart: number;
    /** points of the endless mode, from the decks already done */
    score: number;
    /** a terminal has sent the map of the deck */
    mapped: boolean;
    /** `timeMs` when this deck began */
    startMs: number;
    /** left of the flame being drawn */
    flameMs: number;
    /** times the creature has been burnt: it flees for less each time */
    burns: number;
    needed: number;
    collected: number;
    player: Player;
    alien: Alien;
    tracker: {
        raised: boolean;
        pingMs: number;
        /** where the last ping saw movement, in map units */
        blip: { x: number; y: number; ageMs: number } | null;
    };
    /** left on a terminal save, 0 when not saving */
    saveMs: number;
    /** how often the player has hidden in each locker (cell index → times): the creature learns */
    hides: Readonly<Record<string, number>>;
    near: boolean;
    timeMs: number;
}

export function newGame(deck: DeckDef, rng: Rng, carry?: Carry): GameState
{
    const map = parseMap(deck.map);
    const difficulty = carry?.difficulty ?? 'normal';
    const def = DIFFICULTY[difficulty];
    const base = rectMask(map.grid, deck.dark ?? []);
    const bag: Bag = carry ? { ...carry.bag } : emptyBag();
    // the gift of the easy mode: a decoy and a flare at the start of every deck, up to the limit
    for (const k of ['decoys', 'flares'] as const) bag[k] = Math.min(BAG_MAX, bag[k] + (def.gift[k] ?? 0));
    const cellOfXY = (x: number, y: number) => y * map.grid.w + x;
    const roles: Record<number, TerminalRole> = {};
    for (const t of deck.terminals ?? [])
        roles[cellOfXY(t.x, t.y)] = { log: t.log, ashOff: t.ashOff, opens: t.opens && cellOfXY(t.opens[0], t.opens[1]) };
    const s: GameState = {
        phase: 'playing',
        death: null,
        difficulty,
        deck: deck.id,
        title: deck.title,
        grid: map.grid,
        signs: deck.signs,
        closed: map.closed,
        items: map.items,
        loot: map.loot,
        bag,
        decoys: [],
        flares: [],
        dark: base,
        blackout: deck.blackout ? { mask: rectMask(map.grid, deck.blackout.rects), base, periodMs: deck.blackout.periodMs, offMs: deck.blackout.offMs, on: false } : null,
        locked: map.locked,
        steam: map.steam,
        roles,
        ash: map.ash === null ? null : newAsh(map.ash),
        countdownMs: deck.countdownMs === undefined ? null : Math.max(60000, deck.countdownMs + def.countdownMs),
        jones: carry?.jones ?? false,
        logs: carry?.logs ?? [],
        fires: carry?.fires ?? 0,
        spotted: carry?.spotted ?? 0,
        spottedStart: carry?.spotted ?? 0,
        score: carry?.score ?? 0,
        mapped: false,
        startMs: carry?.timeMs ?? 0,
        flameMs: 0,
        burns: 0,
        needed: map.items.length,
        collected: 0,
        player: { cell: map.start, dir: deck.startDir, hidden: false, busyMs: 0 },
        alien: newAlien(map.alien),
        tracker: { raised: false, pingMs: 0, blip: null },
        saveMs: 0,
        hides: {},
        near: false,
        timeMs: carry?.timeMs ?? 0,
    };
    return { ...s, alien: { ...s.alien, target: patrolTarget(world(s), s.alien.cell, rng) } };
}

/** What to take along when the deck is done. */
export const carryOf = (s: GameState): Carry => ({
    difficulty: s.difficulty, bag: { ...s.bag }, jones: s.jones, logs: [...s.logs], fires: s.fires, spotted: s.spotted, score: s.score, timeMs: s.timeMs,
});

export const isLit = (s: GameState, cell: number) => !s.dark[cell] || s.flares.some(f => f.lit.includes(cell));

export const world = (s: GameState): World => ({
    grid: s.grid, closed: s.closed, player: s.player.cell, hidden: s.player.hidden, dark: !isLit(s, s.player.cell),
    locked: s.locked, pace: DIFFICULTY[s.difficulty].pace, sight: DIFFICULTY[s.difficulty].sight,
});

const ashWorld = (s: GameState): AshWorld => ({
    grid: s.grid, closed: s.closed, player: s.player.cell, hidden: s.player.hidden, dark: !isLit(s, s.player.cell),
});

/** A steam leak is venting at `cell` at the time `timeMs`. */
export function steaming(s: GameState, cell: number, timeMs = s.timeMs): boolean
{
    const i = s.steam.indexOf(cell);
    return i >= 0 && (timeMs + i * STEAM.stagger) % STEAM.periodMs < STEAM.onMs;
}

/** What the terminal under the player does, for its key: the extra task if there is one still to do, else save. */
export function terminalTask(s: GameState): 'divert' | 'ashOff' | 'log' | 'save'
{
    const role = s.roles[s.player.cell];
    if (role?.opens !== undefined && s.locked.includes(role.opens)) return 'divert';
    if (role?.ashOff && s.ash?.active) return 'ashOff';
    if (role?.log && !s.logs.includes(role.log)) return 'log';
    return 'save';
}

/** Which cells can be seen, or null when the whole deck has power. */
export function litMask(s: GameState): boolean[] | null
{
    if (!s.dark.some(Boolean)) return null;
    const lit = s.dark.map(d => !d);
    for (const f of s.flares) for (const c of f.lit) lit[c] = true;
    return lit;
}

/** The cells a flare lights: those within `flareRadius` steps through open space. */
export function flareCells(g: Grid, closed: readonly number[], cell: number): number[]
{
    const dist = distances(g, cell, i => !blocks(g, closed, i));
    const lit: number[] = [];
    dist.forEach((d, i) => { if (d >= 0 && d <= TOOLS.flareRadius) lit.push(i); });
    return lit;
}

/** Where something thrown lands: the last open cell along the facing line, up to `throwRange`. */
export function landing(s: GameState): number
{
    let cell = s.player.cell;
    for (let k = 0; k < TOOLS.throwRange; k++)
    {
        const n = neighbour(s.grid, cell, s.player.dir);
        if (blocks(s.grid, s.closed, n)) break;
        cell = n;
    }
    return cell;
}

/** The cells in front of the player that the flamethrower reaches. */
export function flameCells(s: GameState): number[]
{
    const cells: number[] = [];
    let cell = s.player.cell;
    for (let k = 0; k < TOOLS.flameRange; k++)
    {
        const n = neighbour(s.grid, cell, s.player.dir);
        if (blocks(s.grid, s.closed, n)) break;
        cells.push(n);
        cell = n;
    }
    return cells;
}

/** Straight-line distance from the player to the creature, in cells (it may be inside the vents). */
export function alienDistance(s: GameState)
{
    const p = alienPosition(s.grid, s.alien);
    return Math.hypot(p.x - cellX(s.grid, s.player.cell) - 0.5, p.y - cellY(s.grid, s.player.cell) - 0.5);
}

/** The tracker beeps faster as the creature gets closer. */
export function pingInterval(cells: number)
{
    return 450 + 1350 * Math.min(1, cells / TRACKER.range);
}

/** What [USAR] does right now. */
export function useAction(s: GameState): 'hide' | 'unhide' | 'save' | 'open' | 'close' | null
{
    if (s.phase !== 'playing' || s.saveMs > 0) return null;
    const p = s.player;
    const here = cellAt(s.grid, p.cell);
    if (here === 'locker') return p.hidden ? 'unhide' : 'hide';
    if (here === 'terminal') return 'save';
    const ahead = neighbour(s.grid, p.cell, p.dir);
    if (cellAt(s.grid, ahead) !== 'door') return null;
    if (s.locked.includes(ahead)) return null;
    if (s.closed.includes(ahead)) return 'open';
    return s.alien.cell === ahead && !s.alien.vent ? null : 'close';
}

function makeNoise(s: GameState, cell: number, loudness: number, events: GameEvent[]): GameState
{
    const r = hear(s.alien, world(s), cell, loudness);
    if (r.heard) events.push('heard');
    return r.heard ? { ...s, alien: r.alien } : s;
}

/** The player's actions. Moves and turns are ignored while the previous one lasts or while hidden. */
export function reduce(s: GameState, input: Input): { state: GameState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    const p = s.player;

    if (input === 'tracker')
    {
        const raised = !s.tracker.raised;
        events.push(raised ? 'trackerUp' : 'trackerDown');
        return { state: { ...s, tracker: { ...s.tracker, raised, pingMs: raised ? 300 : 0 } }, events };
    }
    if (p.busyMs > 0) return { state: s, events };

    if (input === 'use')
    {
        const action = useAction(s);
        if (!action) return { state: s, events };
        if (action === 'hide' || action === 'unhide')
        {
            const hidden = action === 'hide';
            // getting in while it watches is no use
            const sawHide = s.alien.sawHide || (hidden && s.alien.mode === 'hunt' && s.alien.seenMs < ALIEN.sawHideMs);
            const hides = hidden ? { ...s.hides, [p.cell]: (s.hides[p.cell] ?? 0) + 1 } : s.hides;
            events.push(action);
            const next = { ...s, hides, player: { ...p, hidden, busyMs: USE_MS }, alien: { ...s.alien, sawHide } };
            return { state: makeNoise(next, p.cell, NOISE.locker, events), events };
        }
        if (action === 'save')
        {
            events.push('saveStart');
            // face the screen while it saves
            const next = { ...s, saveMs: SAVE_MS, player: { ...p, dir: mountWall(s.grid, s.closed, p.cell) ?? p.dir, busyMs: SAVE_MS } };
            return { state: makeNoise(next, p.cell, NOISE.terminal, events), events };
        }
        const door = neighbour(s.grid, p.cell, p.dir);
        const closed = action === 'open' ? s.closed.filter(c => c !== door) : [...s.closed, door];
        events.push(action === 'open' ? 'doorOpen' : 'doorClose');
        const next = { ...s, closed, player: { ...p, busyMs: USE_MS } };
        return { state: makeNoise(next, door, NOISE.door, events), events };
    }

    if (input === 'craftDecoy' || input === 'craftFlare' || input === 'craftFuel')
    {
        const recipe = recipeOf(CRAFT[input]);
        if (!canCraft(s.bag, recipe))
        {
            events.push('noParts');
            return { state: s, events };
        }
        events.push(input);
        const next = { ...s, bag: craft(s.bag, recipe), player: { ...p, busyMs: TOOLS.craftMs } };
        return { state: makeNoise(next, p.cell, NOISE.craft, events), events };
    }

    if (p.hidden) return { state: s, events };

    if (input === 'throwDecoy' || input === 'throwFlare')
    {
        const decoy = input === 'throwDecoy';
        if ((decoy ? s.bag.decoys : s.bag.flares) <= 0)
        {
            events.push(decoy ? 'noDecoy' : 'noFlare');
            return { state: s, events };
        }
        events.push(input);
        const cell = landing(s);
        const bag = decoy ? { ...s.bag, decoys: s.bag.decoys - 1 } : { ...s.bag, flares: s.bag.flares - 1 };
        const next: GameState = {
            ...s, bag, player: { ...p, busyMs: TOOLS.throwMs },
            decoys: decoy ? [...s.decoys, { cell, ms: TOOLS.decoyMs, pulseMs: TOOLS.decoyEveryMs }] : s.decoys,
            flares: decoy ? s.flares : [...s.flares, { cell, ms: TOOLS.flareMs, lit: flareCells(s.grid, s.closed, cell) }],
        };
        // the clatter of a decoy carries; a flare only makes the throw itself
        return { state: makeNoise(next, decoy ? cell : p.cell, decoy ? NOISE.decoy : NOISE.throw, events), events };
    }

    if (input === 'fire')
    {
        if (!s.bag.flamer)
        {
            events.push('noFlamer');
            return { state: s, events };
        }
        if (s.bag.fuel <= 0)
        {
            events.push('noFuel');
            return { state: s, events };
        }
        events.push('fire');
        const hit = !s.alien.vent && flameCells(s).includes(s.alien.cell);
        let next: GameState = {
            ...s, bag: { ...s.bag, fuel: s.bag.fuel - 1 }, flameMs: TOOLS.flameShowMs, burns: hit ? s.burns + 1 : s.burns, fires: s.fires + 1,
            player: { ...p, busyMs: TOOLS.fireMs },
        };
        if (hit)
        {
            events.push('scare');
            next = { ...next, alien: scare(s.alien, world(next), s.burns) };
        }
        // a miss is heard all over the deck
        return { state: makeNoise(next, p.cell, NOISE.fire, events), events };
    }

    if (input === 'left' || input === 'right')
    {
        events.push('turn');
        return { state: { ...s, player: { ...p, dir: turn(p.dir, input === 'left' ? -1 : 1), busyMs: TURN_MS } }, events };
    }

    const to = neighbour(s.grid, p.cell, input === 'forward' ? p.dir : turn(p.dir, 2));
    if (blocks(s.grid, s.closed, to) || steaming(s, to) || (s.ash && !s.ash.active && s.ash.cell === to))
    {
        events.push(s.locked.includes(to) ? 'locked' : steaming(s, to) ? 'steamBlock' : 'bump');
        return { state: { ...s, player: { ...p, busyMs: TURN_MS } }, events };
    }

    events.push('step');
    let next: GameState = { ...s, player: { ...p, cell: to, busyMs: input === 'forward' ? WALK_MS : BACK_MS } };
    if (s.alien.cell === to && !s.alien.vent)
    {
        events.push('dead');
        return { state: { ...next, phase: 'dead', death: 'alien' }, events };
    }
    if (s.ash?.active && s.ash.cell === to)
    {
        events.push('dead');
        return { state: { ...next, phase: 'dead', death: 'ash' }, events };
    }
    next = makeNoise(next, to, NOISE.step, events);

    if (next.items.includes(to))
    {
        next = { ...next, items: next.items.filter(i => i !== to), collected: next.collected + 1 };
        events.push('pickup');
        if (next.collected >= next.needed) events.push('allCells');
        next = makeNoise(next, to, NOISE.pickup, events);
    }
    const loot = next.loot.find(l => l.cell === to);
    if (loot) next = collect(next, loot, events);
    if (cellAt(s.grid, to) === 'exit')
    {
        if (next.collected >= next.needed)
        {
            events.push('won');
            next = { ...next, phase: 'won' };
        }
        else events.push('exitLocked');
    }
    return { state: next, events };
}

/** Picks `loot` up unless the bag is full for it. */
function collect(s: GameState, loot: Loot, events: GameEvent[]): GameState
{
    let bag = s.bag;
    if (loot.kind === 'cat')
    {
        events.push('lootCat');
        return makeNoise({ ...s, jones: true, loot: s.loot.filter(l => l !== loot) }, loot.cell, NOISE.pickup + 1, events);
    }
    if (loot.kind === 'flamer')
    {
        events.push('lootFlamer');
        bag = { ...bag, flamer: true, fuel: Math.max(bag.fuel, FUEL_FOUND) };
    }
    else
    {
        if (bag[loot.kind] >= BAG_MAX)
        {
            events.push('bagFull');
            return s;
        }
        events.push(LOOT_EVENT[loot.kind]);
        bag = { ...bag, [loot.kind]: bag[loot.kind] + 1 };
    }
    return makeNoise({ ...s, bag, loot: s.loot.filter(l => l !== loot) }, loot.cell, NOISE.pickup, events);
}

/** Brings the lit zones in line with the clock: some parts of a deck lose power now and then. */
export function syncBlackout(s: GameState, events: GameEvent[] = []): GameState
{
    const b = s.blackout;
    if (!b) return s;
    const on = s.timeMs % b.periodMs >= b.periodMs - b.offMs;
    if (on === b.on) return s;
    events.push(on ? 'blackout' : 'powerBack');
    return { ...s, blackout: { ...b, on }, dark: on ? b.mask.map((m, i) => m || b.base[i]) : b.base };
}

/** The player stood at a terminal long enough: it saves, and does what it is there for. */
function finishTerminal(s: GameState, events: GameEvent[]): GameState
{
    events.push('saved');
    const role = s.roles[s.player.cell];
    let next = s;
    if (!next.mapped)
    {
        next = { ...next, mapped: true };
        events.push('mapped');
    }
    if (role?.log && !next.logs.includes(role.log))
    {
        next = { ...next, logs: [...next.logs, role.log] };
        events.push('log');
    }
    if (role?.ashOff && next.ash?.active)
    {
        next = { ...next, ash: { ...next.ash, active: false } };
        events.push('ashOff');
    }
    if (role?.opens !== undefined && next.locked.includes(role.opens))
    {
        const door = role.opens;
        next = { ...next, locked: next.locked.filter(c => c !== door), closed: next.closed.filter(c => c !== door) };
        events.push('diverted');
    }
    return next;
}

/** Time passing: the creature moves, the tracker pings, a save completes. */
export function step(s: GameState, dtMs: number, rng: Rng): { state: GameState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    let next: GameState = {
        ...s,
        timeMs: s.timeMs + dtMs,
        player: { ...s.player, busyMs: Math.max(0, s.player.busyMs - dtMs) },
        flameMs: Math.max(0, s.flameMs - dtMs),
    };
    next = syncBlackout(next, events);
    if (s.steam.some(c => !steaming(s, c) && steaming(next, c))) events.push('steam');

    if (next.countdownMs !== null)
    {
        const left = Math.max(0, next.countdownMs - dtMs);
        if (left <= 0)
        {
            events.push('blast', 'dead');
            return { state: { ...next, countdownMs: 0, phase: 'dead', death: 'blast', saveMs: 0 }, events };
        }
        // MOTHER calls every minute, and the last half minute
        if (Math.ceil(left / 60000) < Math.ceil(next.countdownMs / 60000) || (left <= 30000 && next.countdownMs > 30000)) events.push('countdown');
        next = { ...next, countdownMs: left };
    }

    if (next.jones && Math.floor(next.timeMs / MEOW.everyMs) > Math.floor(s.timeMs / MEOW.everyMs))
    {
        events.push('meow');
        next = makeNoise(next, next.player.cell, MEOW.loudness, events);
    }

    if (next.decoys.length)
    {
        const alive: Decoy[] = [];
        for (const d of next.decoys)
        {
            const ms = d.ms - dtMs;
            if (ms <= 0) continue;
            let pulseMs = d.pulseMs - dtMs;
            if (pulseMs <= 0)
            {
                pulseMs += TOOLS.decoyEveryMs;
                events.push('decoyPing');
                next = makeNoise(next, d.cell, NOISE.decoy, events);
            }
            alive.push({ ...d, ms, pulseMs });
        }
        next = { ...next, decoys: alive };
    }

    if (next.flares.length)
    {
        const alive = next.flares.map(f => ({ ...f, ms: f.ms - dtMs })).filter(f => f.ms > 0);
        if (alive.length < next.flares.length) events.push('flareOut');
        next = { ...next, flares: alive };
    }

    if (next.saveMs > 0)
    {
        next = { ...next, saveMs: Math.max(0, next.saveMs - dtMs) };
        if (next.saveMs === 0) next = finishTerminal(next, events);
    }

    if (next.tracker.raised)
    {
        const blip = next.tracker.blip && { ...next.tracker.blip, ageMs: next.tracker.blip.ageMs + dtMs };
        let tracker = { ...next.tracker, blip, pingMs: next.tracker.pingMs - dtMs };
        if (tracker.pingMs <= 0)
        {
            const dist = alienDistance(next);
            const moving = next.alien.stillMs < TRACKER.motionMs && dist <= TRACKER.range;
            tracker = { ...tracker, pingMs: pingInterval(dist), blip: moving ? { ...alienPosition(next.grid, next.alien), ageMs: 0 } : null };
            events.push('ping');
            next = makeNoise({ ...next, tracker }, next.player.cell, NOISE.ping, events);
        }
        else next = { ...next, tracker };
    }

    const before = next.alien;
    const r = stepAlien(before, world(next), dtMs, rng);
    next = { ...next, alien: r.alien, closed: r.closed };
    events.push(...r.events.filter(e => e !== 'heard'));
    if (r.events.includes('spotted')) next = { ...next, spotted: next.spotted + 1 };
    if (r.events.includes('ventOut') && alienDistance(next) <= VENT_HEARD_CELLS) events.push('ventNear');

    if (next.ash)
    {
        const ar = stepAsh(next.ash, ashWorld(next), dtMs, rng);
        next = { ...next, ash: ar.ash };
        events.push(...ar.events);
    }

    const a = next.alien;
    const p = next.player;
    if (next.ash?.active && next.ash.cell === p.cell)
    {
        events.push('dead');
        return { state: { ...next, phase: 'dead', death: 'ash', saveMs: 0 }, events };
    }
    if (!a.vent && a.cell === p.cell)
    {
        // walked into the player's cell: in the open, or in a locker it saw them get into, or one it has learnt to check
        const entered = before.cell !== a.cell || before.vent !== null;
        const chance = lockerCheckChance(next.hides[p.cell] ?? 0);
        const found = p.hidden && !a.sawHide && entered && chance > 0 && rng() < chance;
        if (!p.hidden || a.sawHide || found)
        {
            if (found) events.push('found');
            events.push('dead');
            return { state: { ...next, phase: 'dead', death: 'alien', saveMs: 0 }, events };
        }
    }

    const near = alienDistance(next) <= NEAR_CELLS;
    if (near !== s.near) events.push(near ? 'near' : 'far');
    return { state: { ...next, near }, events };
}
