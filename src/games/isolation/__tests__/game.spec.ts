import { describe, expect, it } from 'vitest';
import { ALIEN } from '../alien';
import { DECK_C, type DeckDef } from '../decks';
import { BACK_MS, WALK_MS, newGame, pingInterval, reduce, step, useAction, type GameEvent, type GameState, type Input } from '../game';
import { cellAt, type Dir } from '../grid';
import { seeded } from '../rng';

const rng0 = () => 0;
const deck = (map: string[], startDir: Dir = 1): DeckDef => ({ id: 't', title: 'T', map, startDir, signs: [], briefing: [] });

/** Player actions with time in between for each to finish. */
function act(s: GameState, ...inputs: Input[]): { s: GameState; events: GameEvent[] }
{
    const events: GameEvent[] = [];
    for (const input of inputs)
    {
        const r = reduce(s, input);
        events.push(...r.events);
        const t = step(r.state, 1000, rng0);
        events.push(...t.events);
        s = t.state;
    }
    return { s, events };
}

/** Lets time pass in 100 ms ticks until `until` or the limit. */
function wait(s: GameState, ms: number, until: (s: GameState, e: GameEvent[]) => boolean = () => false, rng = rng0)
{
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 100)
    {
        const r = step(s, 100, rng);
        s = r.state;
        events.push(...r.events);
        if (until(s, r.events)) break;
    }
    return { s, events };
}

// the creature is walled in at the bottom: it can't interfere
const SHUTTLE = deck([
    '#########',
    '#P...E*.#',
    '#########',
    '#A#######',
    '#########',
]);

// a corridor with a door between the player (10) and the creature (16)
const DOOR = ['#########', '#P.D...A#', '#########'];

// a locker (8) at the end of a corridor that the creature reaches round a corner
const LOCKER = deck([
    '#######',
    '#LP...#',
    '#####.#',
    '#####A#',
    '#######',
]);

describe('player', () =>
{
    it('moves, turns, bumps into walls and waits for each move to finish', () =>
    {
        let s = newGame(SHUTTLE, rng0);
        let r = reduce(s, 'forward');
        expect(r.events).toEqual(['step']);
        expect(r.state.player).toMatchObject({ cell: 11, busyMs: WALK_MS });
        expect(reduce(r.state, 'forward').events).toEqual([]);

        s = step(r.state, WALK_MS, rng0).state;
        r = reduce(s, 'left');
        expect(r.events).toEqual(['turn']);
        expect(r.state.player.dir).toBe(0);

        const bumped = act(step(r.state, 1000, rng0).state, 'forward');
        expect(bumped.events).toContain('bump');
        expect(bumped.s.player.cell).toBe(11);
    });

    it('steps back without turning', () =>
    {
        const { s } = act(newGame(SHUTTLE, rng0), 'forward');
        const r = reduce(s, 'back');
        expect(r.state.player).toMatchObject({ cell: 10, dir: 1, busyMs: BACK_MS });
    });

    it('needs every power cell before the shuttle leaves', () =>
    {
        let { s, events } = act(newGame(SHUTTLE, rng0), 'forward', 'forward', 'forward', 'forward');
        expect(cellAt(s.grid, s.player.cell)).toBe('exit');
        expect(events).toContain('exitLocked');
        expect(s.phase).toBe('playing');

        ({ s, events } = act(s, 'forward'));
        expect(events).toEqual(expect.arrayContaining(['pickup', 'allCells']));
        expect(s).toMatchObject({ collected: 1, items: [] });

        ({ s, events } = act(s, 'back'));
        expect(events).toContain('won');
        expect(s.phase).toBe('won');
        expect(reduce(s, 'forward').events).toEqual([]);
    });

    it('offers the action of the place: lockers and doors', () =>
    {
        const s = newGame(deck(DOOR), rng0);
        expect(useAction(s)).toBeNull();
        const atDoor = act(s, 'forward').s;
        expect(useAction(atDoor)).toBe('open');
        expect(useAction({ ...atDoor, closed: [] })).toBe('close');
        expect(useAction({ ...atDoor, closed: [], alien: { ...atDoor.alien, cell: 12 } })).toBeNull();

        const inLocker = { ...newGame(LOCKER, rng0), player: { cell: 8, dir: 1 as Dir, hidden: false, busyMs: 0 } };
        expect(useAction(inLocker)).toBe('hide');
        expect(useAction(reduce(inLocker, 'use').state)).toBe('unhide');
    });
});

describe('creature', () =>
{
    it('hears a door through the corridor and sees the player once it is open', () =>
    {
        const s = act(newGame(deck(DOOR), rng0), 'forward').s;
        const r = reduce(s, 'use');
        expect(r.events).toEqual(['doorOpen', 'heard']);
        expect(r.state.alien.mode).toBe('investigate');

        const seen = wait(r.state, 500, (_, e) => e.includes('spotted'));
        expect(seen.events).toContain('spotted');
        expect(seen.s.alien.mode).toBe('hunt');
    });

    it('does not hear footsteps behind a closed door', () =>
    {
        const { events, s } = act(newGame(deck(DOOR), rng0), 'forward');
        expect(events).not.toContain('heard');
        expect(s.alien.mode).toBe('patrol');
    });

    it('hunts down a player it sees', () =>
    {
        const s = newGame(deck(['#########', '#P.d...A#', '#########']), rng0);
        const r = wait(s, 10000, x => x.phase !== 'playing');
        expect(r.events).toContain('spotted');
        expect(r.events).toContain('near');
        expect(r.s.phase).toBe('dead');
        expect(r.events[r.events.length - 1]).toBe('dead');
    });

    it('kills a player who walks into it', () =>
    {
        const s = newGame(deck(['######', '#PA..#', '######']), rng0);
        const r = reduce(s, 'forward');
        expect(r.events).toContain('dead');
        expect(r.state.phase).toBe('dead');
    });

    it('forces a closed door in its way', () =>
    {
        let s = newGame(deck(DOOR), rng0);
        s = { ...s, alien: { ...s.alien, mode: 'investigate', target: 11, stepMs: 0 } };
        const r = wait(s, ALIEN.forceMs + 5000, x => !x.closed.length);
        expect(r.events).toContain('doorForced');
        expect(r.s.closed).toEqual([]);
    });

    it('passes by a hidden player', () =>
    {
        let s = { ...newGame(LOCKER, rng0), player: { cell: 8, dir: 1 as Dir, hidden: false, busyMs: 0 } };
        s = reduce(s, 'use').state;
        expect(s.player.hidden).toBe(true);
        expect(s.alien.sawHide).toBe(false);

        s = { ...s, alien: { ...s.alien, mode: 'investigate', target: 8, stepMs: 0 } };
        const r = wait(s, 8000, x => x.alien.cell === 8);
        expect(r.s.alien.cell).toBe(8);
        expect(r.s.phase).toBe('playing');
        expect(wait(r.s, 3000).s.phase).toBe('playing');
    });

    it('opens the locker it saw the player get into', () =>
    {
        let s = { ...newGame(LOCKER, rng0), player: { cell: 8, dir: 1 as Dir, hidden: false, busyMs: 0 } };
        s = { ...s, alien: { ...s.alien, cell: 12 } };
        s = step(s, 10, rng0).state;
        expect(s.alien.mode).toBe('hunt');

        s = reduce(s, 'use').state;
        expect(s.player.hidden).toBe(true);
        expect(s.alien.sawHide).toBe(true);
        expect(wait(s, 8000, x => x.phase !== 'playing').s.phase).toBe('dead');
    });

    it('wanders the deck without leaving the walkable cells', () =>
    {
        const rng = seeded(1979);
        let s = newGame(DECK_C, rng);
        const visited = new Set<number>();
        for (let i = 0; i < 1500 && s.phase === 'playing'; i++)
        {
            s = step(s, 100, rng).state;
            expect(cellAt(s.grid, s.alien.cell)).not.toBe('wall');
            visited.add(s.alien.cell);
        }
        expect(visited.size).toBeGreaterThan(8);
    });
});

describe('tracker', () =>
{
    it('pings faster when the creature is close', () =>
    {
        expect(pingInterval(1)).toBeLessThan(pingInterval(10));
    });

    it('only shows movement', () =>
    {
        let s = reduce(newGame(SHUTTLE, rng0), 'tracker').state;
        expect(s.tracker.raised).toBe(true);
        let r = step(s, 400, rng0);
        expect(r.events).toContain('ping');
        expect(r.state.tracker.blip).toBeNull();

        s = { ...r.state, alien: { ...r.state.alien, stillMs: 0 }, tracker: { ...r.state.tracker, pingMs: 0 } };
        r = step(s, 50, rng0);
        expect(r.state.tracker.blip).toMatchObject({ cell: s.alien.cell, ageMs: 0 });

        expect(reduce(r.state, 'tracker').events).toEqual(['trackerDown']);
    });
});
