import { describe, expect, it } from 'vitest';
import { ALIEN, ALIEN_BODY, alienPosition, centreOfCell, newAlien, placed, stepAlien, type Alien, type AlienEvent, type World } from '../alien';
import { ASH, newAsh, stepAsh, type Ash, type AshEvent } from '../android';
import { parseMap } from '../grid';
import { seeded } from '../rng';
import { SENSES, cellOf } from '../senses';
import { CAMPAIGN, deckFor } from '../decks';
import { newGame, world as gameWorld, step } from '../game';

/** Simulations of the creature and Ash with fixed random numbers: they walk, see, lose track and meet doors. */

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

function setup(map: string[])
{
    const m = parseMap(map);
    const player = centreOfCell(m.grid, m.start);
    const world = (over: Partial<World> = {}): World => ({ grid: m.grid, closed: m.closed, player: m.start, pos: player, hidden: false, ...over });
    return { m, player, world };
}

/** Runs the creature for up to `ms` in 50 ms steps, until `until` says so. */
function simulate(alien: Alien, world: (closed: readonly number[]) => World, ms: number, rng: () => number, until: (a: Alien, e: AlienEvent[]) => boolean = () => false, closed0: readonly number[] = [])
{
    let closed: readonly number[] = closed0;
    const events: AlienEvent[] = [];
    let a = alien;
    let t = 0;
    for (; t < ms; t += 50)
    {
        const r = stepAlien(a, world(closed), 50, rng);
        a = r.alien;
        closed = r.closed;
        events.push(...r.events);
        if (until(a, r.events)) break;
    }
    return { a, events, closed, t };
}

describe('the creature on foot', () =>
{
    const ROOM = ['###############', '#P............#', '#.............#', '#.............#', '#.............#', '#............A#', '###############'];

    it('walks at the speed of its mode, in a straight line to where it goes', () =>
    {
        const { m, world } = setup(ROOM);
        const start = { ...placed(m.grid, newAlien(m.alien)), mode: 'investigate' as const, target: m.start - 0 };
        const far = { ...start, target: 1 * 15 + 12 };
        const r = simulate(far, () => world({ player: m.grid.w * 6 }), 1000, () => 0);
        const p = alienPosition(m.grid, r.a);
        // 1 s at the investigating pace
        const per = 1000 / ALIEN.stepMs.investigate;
        expect(Math.hypot(p.x - start.x, p.y - start.y)).toBeCloseTo(per, 0);
        expect(r.a.stillMs).toBe(0);
    });

    it('faces where it goes', () =>
    {
        const { m, world } = setup(['#########', '#P......#', '#########', '#A#######', '#########']);
        const a = { ...newAlien(m.alien), mode: 'investigate' as const, target: m.start };
        // walled in: nowhere to go, it does not move
        const r = simulate(a, () => world(), 500, () => 0);
        expect(alienPosition(m.grid, r.a)).toEqual(centreOfCell(m.grid, m.alien));
    });

    it('patrols to its target, then picks another', () =>
    {
        const { m, world } = setup(ROOM);
        const rng = seeded(7);
        const a0 = { ...newAlien(m.alien), mode: 'patrol' as const, target: 1 * 15 + 3 };
        const w = () => world({ player: 6 * 15 - 1 + 0, pos: { x: 13.5, y: 5.5 }, hidden: true });
        const r = simulate(a0, w, 20000, rng, (a) => a.target !== 1 * 15 + 3);
        expect(r.a.target).not.toBe(1 * 15 + 3);
        // it got there first, at its patrolling pace: 14 cells or so
        expect(r.t).toBeGreaterThan(5000);
        expect(r.t).toBeLessThan(15000);
    });

    it('sees only inside its cone, and hunts down a player it sees', () =>
    {
        const { m, world } = setup(['#############', '#P..........#', '#############', '#A###########', '#############']);
        const behind = { ...placed(m.grid, newAlien(1 * 13 + 6)), heading: EAST };
        // the player is west of it, behind its back
        // (one step: after it moves it turns to the way it goes)
        expect(simulate(behind, () => world(), 50, () => 0).events).not.toContain('spotted');
        const facing = { ...behind, heading: WEST };
        const r = simulate(facing, () => world(), 6000, () => 0, (a) => Math.hypot(a.x! - 1.5, a.y! - 1.5) < 0.6);
        expect(r.events).toContain('spotted');
        expect(r.a.mode).toBe('hunt');
        // it walked straight to the player, in under the time the hunting pace needs
        expect(r.t).toBeLessThan((1000 / (1000 / ALIEN.stepMs.hunt)) * 5.5 / 1 + 500);
    });

    it('hunts the player across an open room, not along the grid', () =>
    {
        const { m, world } = setup(ROOM);
        const a = { ...placed(m.grid, newAlien(m.alien)), heading: WEST };
        const r = simulate(a, () => world(), 10000, () => 0, (x) => Math.hypot(x.x! - 1.5, x.y! - 1.5) < 0.6);
        expect(r.events).toContain('spotted');
        expect(Math.hypot(r.a.x! - 1.5, r.a.y! - 1.5)).toBeLessThan(0.6);
        // the straight line is 12.5 cells over and 4 down; going by the grid it would be 16.5
        const straight = Math.hypot(12, 4);
        expect(r.t / 1000).toBeLessThan((straight / (1000 / ALIEN.stepMs.hunt)) + 1);
    });

    it('goes to where it last saw the player round a corner, and loses track there', () =>
    {
        const map = ['#########', '#A....###', '####.####', '#P...####', '#########'];
        const { m, world } = setup(map);
        const bend = 1 * 9 + 4;
        const a = { ...placed(m.grid, newAlien(m.alien)), heading: EAST, mode: 'hunt' as const, target: bend };
        // the player stands round the corner, out of sight from the bend
        const r = simulate(a, () => world(), 8000, () => 0, (_, e) => e.includes('lostTrack'));
        expect(r.events).toContain('lostTrack');
        expect(cellOf(m.grid, r.a.x!, r.a.y!)).toBe(bend);
        expect(r.a.mode).toBe('search');
    });

    it('gives up at the last place it saw them when they are gone', () =>
    {
        const { m, world } = setup(['###########', '#A......P.#', '###########']);
        // the player hides before it arrives: it checks the spot and starts searching
        const a = { ...placed(m.grid, newAlien(m.alien)), heading: EAST, mode: 'hunt' as const, target: m.start, sawHide: false };
        const r = simulate(a, () => world({ hidden: true }), 12000, () => 0, (_, e) => e.includes('lostTrack'));
        expect(r.events).toContain('lostTrack');
        expect(r.a.mode).toBe('search');
    });

    it('stops at a closed door, forces it after a while and goes through', () =>
    {
        const { m, world } = setup(['###########', '#P...D...A#', '###########']);
        const a = { ...newAlien(m.alien), mode: 'investigate' as const, target: m.start, heading: WEST };
        const r = simulate(a, (closed) => world({ closed, hidden: true }), 20000, () => 0, (_, e) => e.includes('doorForced'), m.closed);
        expect(r.events).toContain('doorForced');
        expect(r.closed).toEqual([]);
        // it waited at the door, not inside it
        const p = alienPosition(m.grid, r.a);
        expect(p.x).toBeGreaterThan(6);
        expect(r.t).toBeGreaterThanOrEqual(ALIEN.forceMs);
        const through = simulate(r.a, (closed) => world({ closed, hidden: true }), 6000, () => 0, (x) => x.x! < 3, r.closed);
        expect(through.a.x!).toBeLessThan(3);
    });

    it('forces both cells of a door that spans the corridor', () =>
    {
        const { m, world } = setup(['#########', '#P..D...#', '#...D.A.#', '#########']);
        const a = { ...newAlien(m.alien), mode: 'investigate' as const, target: m.start, heading: WEST };
        const r = simulate(a, (closed) => world({ closed, hidden: true }), 20000, () => 0, (_, e) => e.includes('doorForced'), m.closed);
        expect(r.closed).toEqual([]);
    });

    it('cannot go through a door without power, and does not stand there forever', () =>
    {
        const { m, world } = setup(['###########', '#P...X...A#', '###########']);
        const a = { ...newAlien(m.alien), mode: 'hunt' as const, target: m.start, heading: WEST };
        const r = simulate(a, (closed) => world({ closed, locked: m.locked, hidden: true }), 20000, seeded(3), () => false, m.closed);
        expect(r.a.x!).toBeGreaterThan(6);
        expect(r.events).not.toContain('doorForced');
    });

    it('stays out of walls on the way round every corner', () =>
    {
        const { m, world } = setup(['#########', '#A....#.#', '#####.#.#', '#P....#.#', '#########']);
        const a = { ...newAlien(m.alien), mode: 'investigate' as const, target: m.start, heading: EAST };
        let cur: Alien = a;
        for (let t = 0; t < 12000; t += 50)
        {
            cur = stepAlien(cur, world(), 50, () => 0).alien;
            const c = cellOf(m.grid, cur.x!, cur.y!);
            expect(m.grid.cells[c], `${cur.x},${cur.y}`).not.toBe('wall');
            // the body does not overlap a wall either
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(m.grid.cells[cellOf(m.grid, cur.x! + dx * (ALIEN_BODY - 0.01), cur.y! + dy * (ALIEN_BODY - 0.01))]).not.toBe('wall');
            if (Math.hypot(cur.x! - 1.5, cur.y! - 3.5) < 0.4) break;
        }
        expect(Math.hypot(cur.x! - 1.5, cur.y! - 3.5)).toBeLessThan(0.5);
    });

    it('is caught crawling in the ducts: the position follows the grilles', () =>
    {
        const m = parseMap(['#########', '#A.V#V.P#', '#########']);
        const a = { ...newAlien(m.alien), cell: 12, vent: { from: 12, to: 14, ms: 500, totalMs: 1000 } };
        const p = alienPosition(m.grid, a);
        expect(p.x).toBeCloseTo((3.5 + 5.5) / 2, 5);
    });
});

describe('Ash on foot', () =>
{
    const HALL = ['###############', '#P............#', '###############', '#A#############', '###############'];

    function runAsh(ash: Ash, hidden: boolean, ms: number, until: (a: Ash, e: AshEvent[]) => boolean = () => false)
    {
        const m = parseMap(HALL);
        const w = { grid: m.grid, closed: m.closed, player: m.start, pos: centreOfCell(m.grid, m.start), hidden };
        const events: AshEvent[] = [];
        let a = ash;
        let t = 0;
        for (; t < ms; t += 50)
        {
            const r = stepAsh(a, w, 50, seeded(5));
            a = r.ash;
            events.push(...r.events);
            if (until(a, r.events)) break;
        }
        return { a, events, t };
    }

    it('chases a player he sees, slower than the player walks', () =>
    {
        const ash: Ash = { ...newAsh(1 * 15 + 12), heading: WEST };
        const r = runAsh(ash, false, 20000, (a) => Math.hypot(a.x! - 1.5, a.y! - 1.5) < 0.5);
        expect(r.events).toContain('ashSpotted');
        // 11 cells at the chasing pace
        expect(r.t / 1000).toBeGreaterThan(11 / (1000 / 380 * 2));
        expect(r.t / 1000).toBeCloseTo(11 / (1000 / ASH.stepMs.chase), 0);
    });

    it("does not see what is behind him", () =>
    {
        const ash: Ash = { ...newAsh(1 * 15 + 12), heading: EAST };
        expect(runAsh(ash, false, 50).events).not.toContain('ashSpotted');
    });

    it('does not see a hidden player', () =>
    {
        const ash: Ash = { ...newAsh(1 * 15 + 6), heading: WEST };
        expect(runAsh(ash, true, 300).events).toEqual([]);
    });

    it('is at rest when switched off, and stays put', () =>
    {
        const ash: Ash = { ...newAsh(1 * 15 + 6), active: false };
        expect(runAsh(ash, false, 500).a).toEqual(ash);
        expect(SENSES.ashFov).toBeLessThan(SENSES.alienFov);
    });
});

describe('the creature in the real decks', () =>
{
    it.each(CAMPAIGN.map(d => d.id))('patrols %s without stopping or going into walls', id =>
    {
        const rng = seeded(1979);
        let s = newGame(deckFor(id)!, rng);
        // the player waits in a locker-less spot far from it, out of sight: hidden, so only patrols are tested
        s = { ...s, player: { ...s.player, hidden: true }, ash: null };
        const visited = new Set<number>();
        let still = 0;
        let last = { x: -1, y: -1 };
        for (let t = 0; t < 240000 && s.phase === 'playing'; t += 100)
        {
            s = step(s, 100, rng).state;
            const a = s.alien;
            if (!a.vent) visited.add(a.cell);
            expect(s.grid.cells[a.cell], `${id} at ${t}`).not.toBe('wall');
            const p = alienPosition(s.grid, a);
            still = Math.hypot(p.x - last.x, p.y - last.y) < 0.01 && !a.vent ? still + 100 : 0;
            last = p;
            // it may wait to force a door or at a vent, never for long otherwise
            expect(still, `${id} stuck at ${p.x},${p.y} (${a.mode}) after ${t} ms`).toBeLessThan(ALIEN.forceMs + 4000);
        }
        expect(visited.size).toBeGreaterThan(30);
        void gameWorld;
    });
});
