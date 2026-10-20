import { ALIEN, alienPosition, hear, newAlien, patrolTarget, stepAlien, type Alien, type World } from './alien';
import { blocks, cellAt, cellX, cellY, mountWall, neighbour, parseMap, turn, type Dir, type Grid, type Sign } from './grid';
import type { DeckDef } from './decks';
import type { Rng } from './rng';

export const WALK_MS = 380;
export const BACK_MS = 520;
export const TURN_MS = 200;
export const USE_MS = 300;
/** standing at a terminal this long saves; the player can't move meanwhile */
export const SAVE_MS = 3000;

/** How far each sound carries, in cells. */
export const NOISE = { step: 2, door: 5, locker: 1, ping: 2, pickup: 1, terminal: 1 };

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

export type Input = 'forward' | 'back' | 'left' | 'right' | 'use' | 'tracker';

export type GameEvent =
    | 'step' | 'turn' | 'bump' | 'doorOpen' | 'doorClose' | 'doorForced' | 'pickup' | 'allCells' | 'exitLocked'
    | 'hide' | 'unhide' | 'saveStart' | 'saved' | 'trackerUp' | 'trackerDown' | 'ping'
    | 'heard' | 'spotted' | 'lostTrack' | 'ventIn' | 'ventOut' | 'ventNear' | 'near' | 'far' | 'found'
    | 'dead' | 'won';

export interface Player
{
    cell: number;
    dir: Dir;
    hidden: boolean;
    /** until the current move or turn ends; new ones are ignored meanwhile */
    busyMs: number;
}

export interface GameState
{
    phase: 'playing' | 'dead' | 'won';
    deck: string;
    title: string;
    grid: Grid;
    signs: readonly Sign[];
    closed: readonly number[];
    items: readonly number[];
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

export function newGame(deck: DeckDef, rng: Rng): GameState
{
    const map = parseMap(deck.map);
    const s: GameState = {
        phase: 'playing',
        deck: deck.id,
        title: deck.title,
        grid: map.grid,
        signs: deck.signs,
        closed: map.closed,
        items: map.items,
        needed: map.items.length,
        collected: 0,
        player: { cell: map.start, dir: deck.startDir, hidden: false, busyMs: 0 },
        alien: newAlien(map.alien),
        tracker: { raised: false, pingMs: 0, blip: null },
        saveMs: 0,
        hides: {},
        near: false,
        timeMs: 0,
    };
    return { ...s, alien: { ...s.alien, target: patrolTarget(world(s), s.alien.cell, rng) } };
}

export const world = (s: GameState): World => ({ grid: s.grid, closed: s.closed, player: s.player.cell, hidden: s.player.hidden });

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

    if (p.hidden) return { state: s, events };

    if (input === 'left' || input === 'right')
    {
        events.push('turn');
        return { state: { ...s, player: { ...p, dir: turn(p.dir, input === 'left' ? -1 : 1), busyMs: TURN_MS } }, events };
    }

    const to = neighbour(s.grid, p.cell, input === 'forward' ? p.dir : turn(p.dir, 2));
    if (blocks(s.grid, s.closed, to))
    {
        events.push('bump');
        return { state: { ...s, player: { ...p, busyMs: TURN_MS } }, events };
    }

    events.push('step');
    let next: GameState = { ...s, player: { ...p, cell: to, busyMs: input === 'forward' ? WALK_MS : BACK_MS } };
    if (s.alien.cell === to && !s.alien.vent)
    {
        events.push('dead');
        return { state: { ...next, phase: 'dead' }, events };
    }
    next = makeNoise(next, to, NOISE.step, events);

    if (next.items.includes(to))
    {
        next = { ...next, items: next.items.filter(i => i !== to), collected: next.collected + 1 };
        events.push('pickup');
        if (next.collected >= next.needed) events.push('allCells');
        next = makeNoise(next, to, NOISE.pickup, events);
    }
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

/** Time passing: the creature moves, the tracker pings, a save completes. */
export function step(s: GameState, dtMs: number, rng: Rng): { state: GameState; events: GameEvent[] }
{
    if (s.phase !== 'playing') return { state: s, events: [] };
    const events: GameEvent[] = [];
    let next: GameState = {
        ...s,
        timeMs: s.timeMs + dtMs,
        player: { ...s.player, busyMs: Math.max(0, s.player.busyMs - dtMs) },
    };

    if (next.saveMs > 0)
    {
        next = { ...next, saveMs: Math.max(0, next.saveMs - dtMs) };
        if (next.saveMs === 0) events.push('saved');
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
    if (r.events.includes('ventOut') && alienDistance(next) <= VENT_HEARD_CELLS) events.push('ventNear');

    const a = next.alien;
    const p = next.player;
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
            return { state: { ...next, phase: 'dead', saveMs: 0 }, events };
        }
    }

    const near = alienDistance(next) <= NEAR_CELLS;
    if (near !== s.near) events.push(near ? 'near' : 'far');
    return { state: { ...next, near }, events };
}
