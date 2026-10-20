import { ALIEN, alienPosition, hear, newAlien, patrolTarget, placed, scare, stepAlien, type Alien, type World } from './alien';
import { newAsh, stepAsh, type Ash, type AshWorld } from './android';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { BAG_MAX, FUEL_FOUND, craft, canCraft, emptyBag, recipeOf, type Bag, type RecipeId } from './crafting';
import { blocks, cellAt, cellX, cellY, distances, doorGroup, mountWall, neighbour, parseMap, rectMask, type Dir, type Grid, type Loot, type Sign } from './grid';
import type { DeckDef } from './decks';
import type { Rng } from './rng';
import { SCALE } from './scale';
import { cellOf, SENSES } from './senses';
import { angleDiff, angleTo, collides, forward, lineClear, right } from '../wire/physics';
import { castRay } from '../wire/occlusion';
import { dirYaw } from '../wire/camera';

export const USE_MS = 300;
/** standing at a terminal this long saves; the player can't move meanwhile */
export const SAVE_MS = 3000;

/**
 * The player moves freely. The decks are scaled (`SCALE` cells per old cell on each side), so every distance below
 * is in the new cells and every speed keeps the old pace: the old walk was 380 ms per cell.
 */
export const MOVE = {
    /** cells per second at full tilt */
    speed: SCALE * 1000 / 380,
    /** sideways and backwards go slower */
    slow: 0.73,
    radius: 0.22,
    /** a footstep sounds every this many cells walked */
    stride: SCALE,
    /** the stick tilt that cancels a save or a repair */
    cancelTilt: 0.25,
    /** radians per second of the turn keys */
    turnRate: 2.4,
    /** longest slice of time the movement is integrated in */
    sliceMs: 50,
    /** how near the centre of a power cell or loot the player must get to pick it up */
    pickup: 0.6,
    /** how far in front of the player a door is found, and a locker or terminal is used */
    reach: 1.4,
    near: 1.1,
};

/** How close the creature and Ash must get to the player to kill them: the sum of the body radii, a little less. */
export const CONTACT = { alien: 0.5, ash: 0.45 };

/** How far each sound carries, in cells. */
export const NOISE = { step: 2 * SCALE, door: 5 * SCALE, locker: 1 * SCALE, ping: 2 * SCALE, pickup: 1 * SCALE, terminal: 1 * SCALE, throw: 2 * SCALE, craft: 1 * SCALE, fire: 7 * SCALE, decoy: 7 * SCALE };

export const TOOLS = {
    craftMs: 1500,
    throwMs: 400,
    fireMs: 700,
    /** cells a thrown decoy or flare flies along the facing line */
    throwRange: 5 * SCALE,
    decoyMs: 10000,
    decoyEveryMs: 1200,
    flareMs: 30000,
    /** cells (steps through open space) a flare lights */
    flareRadius: 4 * SCALE,
    /** cells the flame reaches */
    flameRange: 3 * SCALE,
    /** half the angle of the flame's cone, radians */
    flameCone: (20 * Math.PI) / 180,
    /** how long the flame is drawn */
    flameShowMs: 500,
};

/** Pipes that leak: a leaking cell can't be crossed for `onMs` of every `periodMs`. */
export const STEAM = { periodMs: 9000, onMs: 3500, stagger: 3100 };

/** Jones meows while he is carried, and the sound carries. */
export const MEOW = { everyMs: 22000, loudness: 3 * SCALE };

export const TRACKER = {
    /** cells */
    range: 12 * SCALE,
    /** the tracker only shows what moved this recently */
    motionMs: 1500,
};

/** Distance under which the creature is "near": interference, hiss. */
export const NEAR_CELLS = 3 * SCALE;
/** a vent opening this close is heard */
const VENT_HEARD_CELLS = 6 * SCALE;

/** Each earlier hide in the same locker makes the creature likelier to look inside. */
export function lockerCheckChance(timesHiddenThere: number)
{
    return Math.min(0.6, 0.2 * Math.max(0, timesHiddenThere - 1));
}

export type CraftInput = 'craftDecoy' | 'craftFlare' | 'craftFuel';

export type Input = 'use' | 'tracker' | 'throwDecoy' | 'throwFlare' | 'fire' | CraftInput;

const CRAFT: Record<CraftInput, RecipeId> = { craftDecoy: 'decoy', craftFlare: 'flare', craftFuel: 'fuel' };

export type GameEvent =
    | 'step' | 'turn' | 'bump' | 'doorOpen' | 'doorClose' | 'doorForced' | 'pickup' | 'allCells' | 'exitLocked'
    | 'lootScrap' | 'lootWires' | 'lootChems' | 'lootFlamer' | 'lootCat' | 'bagFull' | 'locked' | 'steamBlock' | 'steam'
    | 'ashSpotted' | 'ashLost' | 'ashOff' | 'diverted' | 'log' | 'mapped' | 'blackout' | 'powerBack' | 'countdown' | 'blast' | 'meow'
    | 'hide' | 'unhide' | 'saveStart' | 'saveCancel' | 'saved' | 'trackerUp' | 'trackerDown' | 'ping'
    | CraftInput | 'noParts' | 'throwDecoy' | 'throwFlare' | 'noDecoy' | 'noFlare' | 'noFlamer' | 'noFuel'
    | 'fire' | 'scare' | 'decoyPing' | 'flareOut'
    | 'heard' | 'spotted' | 'lostTrack' | 'ventIn' | 'ventOut' | 'ventNear' | 'near' | 'far' | 'found'
    | 'dead' | 'won';

const LOOT_EVENT = { scrap: 'lootScrap', wires: 'lootWires', chems: 'lootChems' } as const;

export interface Player
{
    /** position on the deck, in cells (a cell spans `n..n+1`), and where the player looks (radians, 0 north, clockwise) */
    x: number;
    y: number;
    yaw: number;
    hidden: boolean;
    /** until the player can act again (use, throw, fire...) */
    busyMs: number;
    /** until the player can move again: crafting, saving and leaving a locker keep them still */
    holdMs: number;
    /** distance walked since the last footstep */
    stride: number;
    /** total distance walked, and the speed in the last slice: the camera bobs with them */
    walked: number;
    speed: number;
    /** until the next bump or blocked-door cue */
    cueMs: number;
}

/** What the player is doing with the controls: the sticks go from -1 to 1, `turn` is radians to turn now. */
export interface Controls
{
    /** forward (+) or back (-) */
    move: number;
    /** right (+) or left (-) */
    strafe: number;
    turn: number;
}

export { doorGroup };

export const IDLE: Controls = { move: 0, strafe: 0, turn: 0 };

/** The cell the player stands in. */
export const playerCell = (s: { grid: Grid; player: Pick<Player, 'x' | 'y'> }) => cellOf(s.grid, s.player.x, s.player.y);

/** The middle of a cell. */
export const centreOf = (g: Grid, cell: number) => ({ x: cellX(g, cell) + 0.5, y: cellY(g, cell) + 0.5 });

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

export const newPlayer = (g: Grid, cell: number, yaw: number): Player =>
    ({ ...centreOf(g, cell), yaw, hidden: false, busyMs: 0, holdMs: 0, stride: 0, walked: 0, speed: 0, cueMs: 0 });

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
        player: newPlayer(map.grid, map.start, dirYaw(deck.startDir)),
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
    grid: s.grid, closed: s.closed, player: playerCell(s), pos: { x: s.player.x, y: s.player.y }, hidden: s.player.hidden,
    dark: !isLit(s, playerCell(s)), locked: s.locked, pace: DIFFICULTY[s.difficulty].pace, sight: DIFFICULTY[s.difficulty].sight * SCALE,
});

const ashWorld = (s: GameState): AshWorld => ({
    grid: s.grid, closed: s.closed, player: playerCell(s), pos: { x: s.player.x, y: s.player.y }, hidden: s.player.hidden,
    dark: !isLit(s, playerCell(s)),
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
    const role = s.roles[playerCell(s)];
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

/** How far a ray from the player along their gaze goes before a wall, up to `range` cells. */
function reach(s: GameState, range: number): number
{
    const p = s.player;
    const [fx, fy] = forward(p.yaw);
    return castRay(s.grid, s.closed, p.x, p.y, fx * range, fy * range, 1) * range;
}

/** Where something thrown lands: the cell where the throw ends, up to `throwRange` along the gaze or the first wall. */
export function landing(s: GameState): number
{
    const p = s.player;
    const [fx, fy] = forward(p.yaw);
    const far = reach(s, TOOLS.throwRange);
    // stop short of the wall it hits
    const d = far >= TOOLS.throwRange ? far : Math.max(0, far - 0.3);
    const cell = cellOf(s.grid, p.x + fx * d, p.y + fy * d);
    return cell < 0 ? playerCell(s) : cell;
}

/** How far the flame reaches along the gaze: the range, or less when a wall stops it. */
export const flameReach = (s: GameState) => reach(s, TOOLS.flameRange);

/** The cells the flamethrower reaches: a cone along the gaze, with nothing solid between. */
export function flameCells(s: GameState): number[]
{
    const g = s.grid;
    const p = s.player;
    const range = TOOLS.flameRange;
    const cells: number[] = [];
    for (let y = Math.floor(p.y - range); y <= Math.floor(p.y + range); y++)
        for (let x = Math.floor(p.x - range); x <= Math.floor(p.x + range); x++)
        {
            const c = cellOf(g, x + 0.5, y + 0.5);
            if (c < 0 || c === playerCell(s) || blocks(g, s.closed, c)) continue;
            const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
            if (d > range) continue;
            // a cell has width: it is hit when any of it falls in the cone
            const slack = d > 0.5 ? Math.asin(0.5 / d) : Math.PI;
            if (Math.abs(angleDiff(angleTo(p.x, p.y, x + 0.5, y + 0.5), p.yaw)) > TOOLS.flameCone + slack) continue;
            if (lineClear(g, s.closed, p.x, p.y, x + 0.5, y + 0.5)) cells.push(c);
        }
    return cells;
}

/** Straight-line distance from the player to the creature, in cells (it may be inside the vents). */
export function alienDistance(s: GameState)
{
    const p = alienPosition(s.grid, s.alien);
    return Math.hypot(p.x - s.player.x, p.y - s.player.y);
}

/** The tracker beeps faster as the creature gets closer. */
export function pingInterval(cells: number)
{
    return 450 + 1350 * Math.min(1, cells / TRACKER.range);
}

/** True when a circle of radius `r` at (`x`, `y`) overlaps any of the `cells`. */
function overlapsCells(g: Grid, cells: readonly number[], x: number, y: number, r: number): boolean
{
    return cells.some(c =>
    {
        const cx = cellX(g, c);
        const cy = cellY(g, c);
        const nx = Math.min(Math.max(x, cx), cx + 1);
        const ny = Math.min(Math.max(y, cy), cy + 1);
        return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
    });
}

/** The door cell in front of the player, within reach: a wall in the way hides whatever lies beyond. */
function doorAhead(s: GameState): number | null
{
    const p = s.player;
    const here = playerCell(s);
    const [fx, fy] = forward(p.yaw);
    for (const t of [0.5, 0.9, MOVE.reach])
    {
        const c = cellOf(s.grid, p.x + fx * t, p.y + fy * t);
        if (c < 0 || c === here) continue;
        if (cellAt(s.grid, c) === 'door') return c;
        if (blocks(s.grid, s.closed, c)) return null;
    }
    return null;
}

/** The locker or terminal the player can use: the one they stand in, or the one they look at, close by. */
function stationNear(s: GameState): number | null
{
    const g = s.grid;
    const p = s.player;
    const here = playerCell(s);
    const usable = (c: number) => c >= 0 && (cellAt(g, c) === 'locker' || cellAt(g, c) === 'terminal');
    if (usable(here)) return here;
    for (const d of [0, 1, 2, 3] as const)
    {
        const n = neighbour(g, here, d);
        if (!usable(n)) continue;
        const c = centreOf(g, n);
        if (Math.hypot(c.x - p.x, c.y - p.y) <= MOVE.near && Math.abs(angleDiff(angleTo(p.x, p.y, c.x, c.y), p.yaw)) <= 1.1) return n;
    }
    return null;
}

/** What [USAR] does right now. */
export function useAction(s: GameState): 'hide' | 'unhide' | 'save' | 'open' | 'close' | null
{
    if (s.phase !== 'playing' || s.saveMs > 0) return null;
    const p = s.player;
    if (p.hidden) return 'unhide';
    const station = stationNear(s);
    const kind = (c: number) => cellAt(s.grid, c) === 'locker' ? 'hide' : 'save';
    if (station !== null && station === playerCell(s)) return kind(station);
    const door = doorAhead(s);
    if (door !== null)
    {
        const group = doorGroup(s.grid, door);
        if (group.some(c => s.locked.includes(c))) return null;
        if (s.closed.includes(door)) return 'open';
        // not on top of the creature, nor with the player's own body in the doorway
        if (!s.alien.vent && group.includes(s.alien.cell)) return null;
        return overlapsCells(s.grid, group, p.x, p.y, MOVE.radius + 0.2) ? null : 'close';
    }
    return station === null ? null : kind(station);
}

function makeNoise(s: GameState, cell: number, loudness: number, events: GameEvent[]): GameState
{
    const r = hear(s.alien, world(s), cell, loudness);
    if (r.heard) events.push('heard');
    return r.heard ? { ...s, alien: r.alien } : s;
}

const opposite = (d: Dir) => ((d + 2) % 4) as Dir;

/** The player's actions, which take a moment each. Walking and turning are `step`'s, through the controls. */
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
            const cell = hidden ? stationNear(s)! : playerCell(s);
            const wall = mountWall(s.grid, s.closed, cell);
            // getting in while it watches is no use
            const sawHide = s.alien.sawHide || (hidden && s.alien.mode === 'hunt' && s.alien.seenMs < ALIEN.sawHideMs);
            const hides = hidden ? { ...s.hides, [cell]: (s.hides[cell] ?? 0) + 1 } : s.hides;
            events.push(action);
            // inside, the player stands in the middle of the locker, looking out
            const spot = hidden ? { ...centreOf(s.grid, cell), yaw: wall === null ? p.yaw : dirYaw(opposite(wall)) } : {};
            const next = { ...s, hides, player: { ...p, ...spot, hidden, busyMs: USE_MS, holdMs: USE_MS }, alien: { ...s.alien, sawHide } };
            return { state: makeNoise(next, cell, NOISE.locker, events), events };
        }
        if (action === 'save')
        {
            const cell = stationNear(s)!;
            const wall = mountWall(s.grid, s.closed, cell);
            events.push('saveStart');
            // face the screen while it saves
            const next = { ...s, saveMs: SAVE_MS, player: { ...p, ...centreOf(s.grid, cell), yaw: wall === null ? p.yaw : dirYaw(wall), busyMs: SAVE_MS, holdMs: SAVE_MS } };
            return { state: makeNoise(next, cell, NOISE.terminal, events), events };
        }
        const door = doorAhead(s)!;
        const group = doorGroup(s.grid, door);
        const closed = action === 'open' ? s.closed.filter(c => !group.includes(c)) : [...s.closed, ...group.filter(c => !s.closed.includes(c))];
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
        const next = { ...s, bag: craft(s.bag, recipe), player: { ...p, busyMs: TOOLS.craftMs, holdMs: TOOLS.craftMs } };
        return { state: makeNoise(next, playerCell(s), NOISE.craft, events), events };
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
        return { state: makeNoise(next, decoy ? cell : playerCell(s), decoy ? NOISE.decoy : NOISE.throw, events), events };
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
        return { state: makeNoise(next, playerCell(s), NOISE.fire, events), events };
    }

    return { state: s, events };
}

/** Walks the player's circle by (`dx`, `dy`), sliding along walls; steam and a switched-off Ash are solid too. */
function walk(s: GameState, dx: number, dy: number): { x: number; y: number }
{
    const { x, y } = s.player;
    const g = s.grid;
    const r = MOVE.radius;
    const solid = s.steam.filter(c => steaming(s, c));
    if (s.ash && !s.ash.active) solid.push(s.ash.cell);
    // already inside one (a leak started under the player): leaving is allowed
    const inside = overlapsCells(g, solid, x, y, r);
    const free = (px: number, py: number) => !collides(g, s.closed, px, py, r) && (inside || !overlapsCells(g, solid, px, py, r));
    const nx = dx !== 0 && free(x + dx, y) ? x + dx : x;
    const ny = dy !== 0 && free(nx, y + dy) ? y + dy : y;
    return { x: nx, y: ny };
}

/** One slice of the player's movement: turning, walking, footsteps, and what they find where they end up. */
function movePlayer(s: GameState, dtMs: number, c: Controls, events: GameEvent[]): GameState
{
    let next = s;
    const tilt = Math.min(1, Math.hypot(c.move, c.strafe));
    if (s.saveMs > 0 && (tilt > MOVE.cancelTilt || c.turn !== 0))
    {
        // moving away spoils the save
        events.push('saveCancel');
        next = { ...s, saveMs: 0, player: { ...s.player, busyMs: 0, holdMs: 0 } };
    }
    const q = next.player;
    if (q.hidden || q.holdMs > 0 || next.saveMs > 0) return q.speed ? { ...next, player: { ...q, speed: 0 } } : next;

    const yaw = Math.atan2(Math.sin(q.yaw + c.turn), Math.cos(q.yaw + c.turn));
    const dt = dtMs / 1000;
    const raw = Math.hypot(c.move, c.strafe);
    const k = raw > 1 ? 1 / raw : 1;
    const ahead = (c.move >= 0 ? c.move : c.move * MOVE.slow) * k;
    const aside = c.strafe * MOVE.slow * k;
    const [fx, fy] = forward(yaw);
    const [rx, ry] = right(yaw);
    const vx = (fx * ahead + rx * aside) * MOVE.speed;
    const vy = (fy * ahead + ry * aside) * MOVE.speed;
    const before = playerCell(next);
    const to = walk({ ...next, player: { ...q, yaw } }, vx * dt, vy * dt);
    const dist = Math.hypot(to.x - q.x, to.y - q.y);
    const want = Math.hypot(vx, vy) * dt;

    let player: Player = { ...q, ...to, yaw, speed: dt > 0 ? dist / dt : 0, walked: q.walked + dist, stride: q.stride + dist, cueMs: q.cueMs };
    next = { ...next, player };

    // blocked: say what stopped them, now and then
    if (want > 0 && dist < want * 0.25 && player.cueMs <= 0)
    {
        const len = Math.hypot(vx, vy);
        const ahead2 = cellOf(next.grid, player.x + (vx / len) * (MOVE.radius + 0.35), player.y + (vy / len) * (MOVE.radius + 0.35));
        events.push(next.locked.includes(ahead2) ? 'locked' : ahead2 >= 0 && steaming(next, ahead2) ? 'steamBlock' : 'bump');
        player = { ...player, cueMs: 700 };
        next = { ...next, player };
    }

    if (player.stride >= MOVE.stride)
    {
        player = { ...player, stride: player.stride - MOVE.stride };
        next = { ...next, player };
        events.push('step');
        next = makeNoise(next, playerCell(next), NOISE.step * tilt, events);
    }

    // what lies underfoot
    const pos = next.player;
    const near = (cell: number) =>
    {
        const m = centreOf(next.grid, cell);
        return Math.hypot(m.x - pos.x, m.y - pos.y) <= MOVE.pickup;
    };
    for (const item of next.items.filter(near))
    {
        next = { ...next, items: next.items.filter(i => i !== item), collected: next.collected + 1 };
        events.push('pickup');
        if (next.collected >= next.needed) events.push('allCells');
        next = makeNoise(next, item, NOISE.pickup, events);
    }
    for (const loot of next.loot.filter(l => near(l.cell)))
    {
        // a full bag says so now and then, not at every slice the player stands there
        const full = loot.kind !== 'flamer' && loot.kind !== 'cat' && next.bag[loot.kind] >= BAG_MAX;
        if (full && next.player.cueMs > 0) continue;
        next = collect(next, loot, events);
        if (full) next = { ...next, player: { ...next.player, cueMs: 700 } };
    }

    const cell = playerCell(next);
    if (cellAt(next.grid, cell) === 'exit')
    {
        if (next.collected >= next.needed)
        {
            events.push('won');
            next = { ...next, phase: 'won' };
        }
        else if (cell !== before && cellAt(next.grid, before) !== 'exit') events.push('exitLocked');
    }
    return next;
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
    const role = s.roles[playerCell(s)];
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
        const group = doorGroup(next.grid, role.opens);
        next = { ...next, locked: next.locked.filter(c => !group.includes(c)), closed: next.closed.filter(c => !group.includes(c)) };
        events.push('diverted');
    }
    return next;
}

/**
 * Time passing: the player moves with `controls`, the creature moves, the tracker pings, a save completes. Long
 * spans are cut into slices of at most `MOVE.sliceMs`, so nothing passes through a wall.
 */
export function step(s: GameState, dtMs: number, rng: Rng, controls: Controls = IDLE): { state: GameState; events: GameEvent[] }
{
    const events: GameEvent[] = [];
    const slices = Math.max(1, Math.ceil(dtMs / MOVE.sliceMs));
    let next = s;
    for (let i = 0; i < slices && next.phase === 'playing'; i++)
    {
        const r = stepSlice(next, dtMs / slices, rng, { ...controls, turn: controls.turn / slices });
        next = r.state;
        events.push(...r.events);
    }
    return { state: next, events };
}

function stepSlice(s: GameState, dtMs: number, rng: Rng, controls: Controls): { state: GameState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    let next: GameState = {
        ...s,
        timeMs: s.timeMs + dtMs,
        player: { ...s.player, busyMs: Math.max(0, s.player.busyMs - dtMs), holdMs: Math.max(0, s.player.holdMs - dtMs), cueMs: Math.max(0, s.player.cueMs - dtMs) },
        flameMs: Math.max(0, s.flameMs - dtMs),
    };
    next = movePlayer(next, dtMs, controls, events);
    if (next.phase !== 'playing') return { state: next, events };
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
        next = makeNoise(next, playerCell(next), MEOW.loudness, events);
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
            next = makeNoise({ ...next, tracker }, playerCell(next), NOISE.ping, events);
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
    const pc = playerCell(next);
    const ash = next.ash && placed(next.grid, next.ash);
    if (ash?.active && (ash.cell === pc || (!p.hidden && Math.hypot(ash.x - p.x, ash.y - p.y) <= CONTACT.ash)))
    {
        events.push('dead');
        return { state: { ...next, phase: 'dead', death: 'ash', saveMs: 0 }, events };
    }
    const apos = alienPosition(next.grid, a);
    // in the open it kills by touch; a hidden player is only found when it enters their locker
    const touching = !a.vent && !p.hidden && Math.hypot(apos.x - p.x, apos.y - p.y) <= CONTACT.alien;
    if (!a.vent && (a.cell === pc || touching))
    {
        // walked into the player's cell: in the open, or in a locker it saw them get into, or one it has learnt to check
        const entered = before.cell !== a.cell || before.vent !== null;
        const chance = lockerCheckChance(next.hides[pc] ?? 0);
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
