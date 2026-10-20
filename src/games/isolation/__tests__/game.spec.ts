import { describe, expect, it } from 'vitest';
import { ALIEN, hear, planPatrol } from '../alien';
import { DECK_C, type DeckDef } from '../decks';
import { IDLE, MOVE, NOISE, SAVE_MS, centreOf, doorGroup, lockerCheckChance, newGame, pingInterval, playerCell, reduce, step, useAction, world, type Controls, type GameEvent, type GameState, type Input } from '../game';
import { cellAt, type Dir } from '../grid';
import { seeded } from '../rng';

const rng0 = () => 0;
const EAST = Math.PI / 2;
const deck = (map: string[], startDir: Dir = 1): DeckDef => ({ id: 't', title: 'T', map, startDir, signs: [], briefing: [] });

const FORWARD: Controls = { move: 1, strafe: 0, turn: 0 };

/** The player stands in the middle of `cell`, looking along `yaw`. */
const at = (s: GameState, cell: number, yaw = s.player.yaw): GameState => ({ ...s, player: { ...s.player, ...centreOf(s.grid, cell), yaw } });

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

/** Holds the controls for `ms`, in 50 ms steps, until `until` or the time is up. */
function run(s: GameState, ms: number, controls: Controls = IDLE, until: (s: GameState, e: GameEvent[]) => boolean = () => false, rng = rng0)
{
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 50)
    {
        const r = step(s, 50, rng, controls);
        s = r.state;
        events.push(...r.events);
        if (until(s, r.events)) break;
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
    it('starts in the middle of its cell, looking along the deck\'s heading', () =>
    {
        const s = newGame(SHUTTLE, rng0);
        expect(s.player).toMatchObject({ x: 1.5, y: 1.5, yaw: EAST, hidden: false });
        expect(playerCell(s)).toBe(10);
    });

    it('walks where it looks at the pace of the old walk, doubled with the cells', () =>
    {
        const s = run(newGame(SHUTTLE, rng0), 500, FORWARD).s;
        expect(s.player.x).toBeCloseTo(1.5 + MOVE.speed * 0.5, 1);
        expect(s.player.y).toBeCloseTo(1.5, 5);
    });

    it('walks slower backwards and sideways, and a light push walks slower still', () =>
    {
        const base = at(newGame(SHUTTLE, rng0), 12, EAST);
        const dx = (c: Controls) => Math.abs(run(base, 200, c).s.player.x - base.player.x);
        const fwd = dx(FORWARD);
        expect(dx({ move: -1, strafe: 0, turn: 0 })).toBeCloseTo(fwd * MOVE.slow, 1);
        expect(dx({ move: 0, strafe: 1, turn: 0 })).toBeLessThan(0.01);
        expect(dx({ move: 0.4, strafe: 0, turn: 0 })).toBeCloseTo(fwd * 0.4, 1);
    });

    it('turns with the controls', () =>
    {
        const s = run(newGame(SHUTTLE, rng0), 500, { move: 0, strafe: 0, turn: Math.PI / 20 }).s;
        // the turn is per call: ten calls of a tenth of a quarter turn
        expect(s.player.yaw).toBeCloseTo(Math.PI, 5);
        expect(s.player.x).toBe(1.5);
    });

    it('stops at walls without going into them, and says so', () =>
    {
        const north = at(newGame(SHUTTLE, rng0), 10, 0);
        const r = run(north, 1000, FORWARD);
        expect(r.s.player.y).toBeCloseTo(1 + MOVE.radius, 1);
        expect(r.events).toContain('bump');
        // once now and then, not every slice
        expect(r.events.filter(e => e === 'bump').length).toBeLessThan(3);
    });

    it('slides along a wall instead of stopping dead', () =>
    {
        const s = at(newGame(SHUTTLE, rng0), 10, Math.PI * 0.75);
        const r = run(s, 300, FORWARD);
        // looking south-east against the south wall: it keeps going east
        expect(r.s.player.x).toBeGreaterThan(2.5);
        expect(r.s.player.y).toBeLessThan(2);
    });

    it('makes a footstep every stride, none with a light push', () =>
    {
        // 400 ms at full tilt is a little over two cells: one stride
        const loud = run(newGame(SHUTTLE, rng0), 400, FORWARD).events.filter(e => e === 'step').length;
        const soft = run(newGame(SHUTTLE, rng0), 400, { move: 0.3, strafe: 0, turn: 0 }).events.filter(e => e === 'step').length;
        expect(loud).toBe(1);
        expect(soft).toBe(0);
    });

    it('hears a footstep from the creature, less when the push is light', () =>
    {
        // round a corner: it cannot see the player, only hear
        const s = newGame(deck(['#######', '#P....#', '#####.#', '#####A#', '#######']), rng0);
        expect(run(s, 600, FORWARD).events).toContain('heard');
        const slow = run(s, 600, { move: 0.3, strafe: 0, turn: 0 });
        expect(slow.events).not.toContain('heard');
    });

    it('needs every power cell before the shuttle leaves', () =>
    {
        const s = newGame(deck(['##########', '#P.E..*..#', '##########', '#A########', '##########']), rng0);
        let r = run(s, 3000, FORWARD, (_, e) => e.includes('pickup'));
        expect(r.events).toContain('exitLocked');
        expect(r.events).toEqual(expect.arrayContaining(['pickup', 'allCells']));
        expect(r.s).toMatchObject({ collected: 1, items: [], phase: 'playing' });

        // back into the shuttle
        r = run({ ...r.s, player: { ...r.s.player, yaw: -EAST } }, 3000, FORWARD, x => x.phase !== 'playing');
        expect(r.events).toContain('won');
        expect(r.s.phase).toBe('won');
        expect(cellAt(r.s.grid, playerCell(r.s))).toBe('exit');
        expect(step(r.s, 100, rng0, FORWARD).events).toEqual([]);
    });

    it('does not let the shuttle leave early', () =>
    {
        const s = newGame(deck(['##########', '#P.E..*..#', '##########', '#A########', '##########']), rng0);
        const r = run(s, 350, FORWARD);
        expect(cellAt(r.s.grid, playerCell(r.s))).toBe('exit');
        expect(r.s.phase).toBe('playing');
    });

    it('does not pick up what is a cell away', () =>
    {
        const s = at(newGame(deck(['#######', '#P.*..#', '#A#####', '#######']), rng0), 8);
        expect(run(s, 100).s.items).toEqual([10]);
        expect(run(at(s, 10), 100).s.collected).toBe(1);
    });

    it('offers the action of the place: lockers and doors', () =>
    {
        const s = newGame(deck(DOOR), rng0);
        expect(useAction(s)).toBeNull();
        const atDoor = run(s, 100, FORWARD).s;
        expect(useAction(atDoor)).toBe('open');
        expect(useAction({ ...atDoor, closed: [] })).toBe('close');
        expect(useAction({ ...atDoor, closed: [], alien: { ...atDoor.alien, cell: 12 } })).toBeNull();

        const inLocker = at(newGame(LOCKER, rng0), 8);
        expect(useAction(inLocker)).toBe('hide');
        expect(useAction(reduce(inLocker, 'use').state)).toBe('unhide');
    });

    it('uses a locker it looks at from the next cell, and steps into it', () =>
    {
        const s = newGame(LOCKER, rng0);
        // at 9, facing west at the locker in 8
        const west = at(s, 9, -EAST);
        expect(useAction(west)).toBe('hide');
        const r = reduce(west, 'use');
        expect(r.state.player).toMatchObject({ hidden: true, x: 1.5, y: 1.5 });
        // looks out, away from the wall it is fixed to
        expect(Math.cos(r.state.player.yaw)).toBeLessThan(1);
        expect(useAction(at(s, 10, EAST))).toBeNull();
    });

    it('cannot move while hidden, but gets out where it stood', () =>
    {
        let s = reduce(at(newGame(LOCKER, rng0), 8), 'use').state;
        s = run(s, 1000, FORWARD).s;
        expect(s.player).toMatchObject({ x: 1.5, hidden: true });
        s = run(s, 400).s;
        s = reduce(s, 'use').state;
        expect(s.player.hidden).toBe(false);
    });

    it('opens and closes both cells of a door that spans the corridor', () =>
    {
        const m = ['#########', '#P..D...#', '#...D...#', '#########', '#A#######', '#########'];
        const s = newGame(deck(m), rng0);
        const door = s.closed;
        expect(door).toHaveLength(2);
        expect(doorGroup(s.grid, door[0])).toEqual(door);
        const near = at(s, 12, EAST);
        const open = reduce(near, 'use').state;
        expect(open.closed).toEqual([]);
        const shut = reduce(step(open, 400, rng0).state, 'use');
        expect(shut.events).toContain('doorClose');
        expect(shut.state.closed).toEqual(door);
    });

    it('does not shut a door on its own body', () =>
    {
        const s = newGame(deck(['#######', '#P.d.A#', '#######']), rng0);
        const edge = (x: number) => ({ ...s, closed: [], player: { ...s.player, x, y: 1.5, yaw: EAST } });
        // right at the door: the doorway would close on them
        expect(useAction(edge(2.9))).toBeNull();
        expect(useAction(edge(2.4))).toBe('close');
    });
});

describe('creature', () =>
{
    it('hears a door through the corridor and sees the player once it is open', () =>
    {
        const s = run(newGame(deck(DOOR), rng0), 100, FORWARD).s;
        const r = reduce(s, 'use');
        expect(r.events).toEqual(['doorOpen', 'heard']);
        expect(r.state.alien.mode).toBe('investigate');

        const seen = wait(r.state, 500, (_, e) => e.includes('spotted'));
        expect(seen.events).toContain('spotted');
        expect(seen.s.alien.mode).toBe('hunt');
    });

    it('does not hear footsteps behind a closed door', () =>
    {
        const { events, s } = run(newGame(deck(DOOR), rng0), 200, FORWARD);
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
        const r = run(s, 1000, FORWARD, x => x.phase !== 'playing');
        expect(r.events).toContain('dead');
        expect(r.s.phase).toBe('dead');
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
        let s = at(newGame(LOCKER, rng0), 8);
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
        let s = at(newGame(LOCKER, rng0), 8);
        // it looks west along the corridor
        s = { ...s, alien: { ...s.alien, cell: 12, heading: -EAST } };
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
        // the blip is where the creature is, in map units (cell centre)
        expect(r.state.tracker.blip).toEqual({ x: 1.5, y: 3.5, ageMs: 0 });

        expect(reduce(r.state, 'tracker').events).toEqual(['trackerDown']);
    });
});

// two rooms joined by a long corridor below, and by a duct between the vents (12 and 14)
const DUCTS = deck([
    '#########',
    '#A.V#V.P#',
    '##.###.##',
    '##.....##',
    '#########',
]);

describe('vents', () =>
{
    it('takes the ducts when they are a real shortcut', () =>
    {
        // the long way round is more than the ducts plus the walk to the grille
        const s = newGame(deck(['#############', '#A.V#####V.P#', '##.#######.##', '##.........##', '#############']), rng0);
        const seq = [0.9, 0.99, 0.1];
        expect(planPatrol(world(s), 14, () => seq.shift() ?? 0)).toEqual({ target: 16, ventPlan: 22 });
    });

    it('crawls from vent to vent, tracked through the walls, and is heard coming out nearby', () =>
    {
        let s = newGame(DUCTS, rng0);
        s = { ...s, alien: { ...s.alien, cell: 12, target: 12, ventPlan: 14, stepMs: 0 } };
        const r = step(s, 50, rng0);
        expect(r.events).toContain('ventIn');
        expect(r.state.alien.vent).toMatchObject({ from: 12, to: 14 });

        s = reduce(r.state, 'tracker').state;
        const tracked = wait(s, 700).s;
        expect(tracked.tracker.blip?.x).toBeGreaterThan(3.5);
        expect(tracked.tracker.blip?.x).toBeLessThan(5.5);

        const out = wait(tracked, ALIEN.minVentMs + 500, (_, e) => e.includes('ventOut'));
        expect(out.events).toEqual(expect.arrayContaining(['ventOut', 'ventNear']));
        expect(out.s.alien).toMatchObject({ cell: 14, vent: null });
    });

    it('hears through the ducts and comes out of the grille nearest the noise', () =>
    {
        let s = newGame(DUCTS, rng0);
        s = { ...s, alien: { ...s.alien, cell: 14, mode: 'patrol', vent: { from: 14, to: 12, ms: 9000, totalMs: 9000 } } };
        const r = hear(s.alien, world(at(s, 15)), 15, NOISE.step);
        expect(r.heard).toBe(true);
        expect(r.alien.vent).toMatchObject({ to: 14 });
        expect(r.alien.vent!.ms).toBeLessThanOrEqual(1500);
        expect(r.alien.mode).toBe('investigate');
    });

    it('cannot catch anyone from inside a duct', () =>
    {
        let s = newGame(DUCTS, rng0);
        s = { ...at(s, 12), alien: { ...s.alien, cell: 12, vent: { from: 12, to: 14, ms: 5000, totalMs: 5000 } } };
        expect(step(s, 100, rng0).state.phase).toBe('playing');
    });
});

describe('terminals', () =>
{
    const TERMINAL = deck(['#######', '#PT...#', '#######', '#A#####', '#######']);

    it('saves after standing at the terminal for a while', () =>
    {
        let s = newGame(TERMINAL, rng0);
        // the terminal is in the next cell, in front of the player
        expect(useAction(s)).toBe('save');
        const r = reduce(s, 'use');
        expect(r.events).toEqual(['saveStart']);
        expect(r.state.saveMs).toBe(SAVE_MS);
        // in its cell, turned to the screen on the north wall
        expect(r.state.player).toMatchObject({ x: 2.5, y: 1.5, yaw: 0 });
        expect(useAction(r.state)).toBeNull();
        expect(step(r.state, 500, rng0, FORWARD).state.player.x).toBe(2.5);

        s = r.state;
        const done = wait(s, SAVE_MS + 200, (_, e) => e.includes('saved'));
        expect(done.events).toContain('saved');
        expect(done.s.saveMs).toBe(0);
    });

    it('is spoilt by walking away or turning', () =>
    {
        const started = reduce(newGame(TERMINAL, rng0), 'use').state;
        const walked = step(started, 100, rng0, FORWARD);
        expect(walked.events).toContain('saveCancel');
        expect(walked.state.saveMs).toBe(0);
        expect(walked.state.player.holdMs).toBe(0);

        const turned = step(started, 100, rng0, { move: 0, strafe: 0, turn: 0.4 });
        expect(turned.events).toContain('saveCancel');
        // a light touch below the threshold does not
        expect(step(started, 100, rng0, { move: 0.1, strafe: 0, turn: 0 }).events).not.toContain('saveCancel');
    });
});

describe('lockers', () =>
{
    it('are checked more often the more they are used', () =>
    {
        expect(lockerCheckChance(1)).toBe(0);
        expect(lockerCheckChance(2)).toBeCloseTo(0.2);
        expect(lockerCheckChance(9)).toBe(0.6);
    });

    it('a locker used too often gets opened', () =>
    {
        let s: GameState = { ...at(newGame(LOCKER, rng0), 8), hides: { 8: 2 } };
        s = reduce(s, 'use').state;
        expect(s.hides[8]).toBe(3);
        s = { ...s, alien: { ...s.alien, mode: 'investigate', target: 8, stepMs: 0 } };

        const caught = wait(s, 8000, x => x.phase !== 'playing');
        expect(caught.events).toEqual(expect.arrayContaining(['found', 'dead']));

        const lucky = wait(s, 8000, x => x.phase !== 'playing' || x.alien.cell === 8, () => 0.99);
        expect(lucky.s.alien.cell).toBe(8);
        expect(lucky.s.phase).toBe('playing');
    });
});
