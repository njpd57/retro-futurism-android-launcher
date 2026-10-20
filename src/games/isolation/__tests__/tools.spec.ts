import { describe, expect, it } from 'vitest';
import { ALIEN, fleeMsFor, scare } from '../alien';
import { emptyBag, type Bag } from '../crafting';
import { DECK_C, type DeckDef } from '../decks';
import { TOOLS, flameCells, flareCells, isLit, landing, litMask, newGame, playerCell, reduce, step, world, type GameEvent, type GameState, type Input } from '../game';
import { distances, parseMap, type Dir } from '../grid';
import { EAST, FORWARD, at, run } from './helpers';

const rng0 = () => 0;
const deck = (map: string[], startDir: Dir = 1, dark?: DeckDef['dark']): DeckDef => ({ id: 't', title: 'T', map, startDir, signs: [], briefing: [], dark });
const bagWith = (over: Partial<Bag>): Bag => ({ ...emptyBag(), ...over });
const withBag = (s: GameState, over: Partial<Bag>): GameState => ({ ...s, bag: bagWith({ ...s.bag, ...over }) });

/** One input, then time for it to finish. */
function act(s: GameState, ...inputs: Input[])
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

function wait(s: GameState, ms: number, until: (s: GameState, e: GameEvent[]) => boolean = () => false)
{
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 100)
    {
        const r = step(s, 100, rng0);
        s = r.state;
        events.push(...r.events);
        if (until(s, r.events)) break;
    }
    return { s, events };
}

// the creature is walled in at the bottom
const LOOTY = deck(['#########', '#Pswc.f.#', '#########', '#A#######', '#########']);

describe('loot', () =>
{
    it('is picked up by walking over it', () =>
    {
        const { s, events } = run(newGame(LOOTY, rng0), 800, FORWARD);
        expect(events).toEqual(expect.arrayContaining(['lootScrap', 'lootWires', 'lootChems']));
        expect(s.bag).toMatchObject({ scrap: 1, wires: 1, chems: 1 });
        expect(s.loot).toHaveLength(1);
    });

    it('stays on the floor when the bag is full for it', () =>
    {
        const full = withBag(newGame(LOOTY, rng0), { scrap: 3 });
        const { s, events } = run(full, 400, FORWARD);
        expect(events).toContain('bagFull');
        expect(s.bag.scrap).toBe(3);
        expect(s.loot.map(l => l.kind)).toContain('scrap');
    });

    it('the flamethrower comes with fuel', () =>
    {
        const { s, events } = run(newGame(LOOTY, rng0), 1100, FORWARD);
        expect(events).toContain('lootFlamer');
        expect(s.bag).toMatchObject({ flamer: true, fuel: 2 });
        expect(s.loot).toEqual([]);
    });

    it('every pick-up in the first deck can be reached', () =>
    {
        const m = parseMap(DECK_C.map);
        const reach = distances(m.grid, m.start, i => m.grid.cells[i] !== 'wall');
        expect(m.loot.length).toBeGreaterThanOrEqual(6);
        for (const l of m.loot) expect(reach[l.cell], l.kind).toBeGreaterThanOrEqual(0);
        // the flamethrower is not here: it waits on the next deck
        expect(m.loot.filter(l => l.kind === 'flamer')).toHaveLength(0);
        // enough to make something of each kind
        for (const kind of ['scrap', 'wires', 'chems'] as const) expect(m.loot.filter(l => l.kind === kind).length).toBeGreaterThanOrEqual(2);
    });
});

describe('crafting in play', () =>
{
    it('takes time, makes a little noise and ignores a second order meanwhile', () =>
    {
        const s = withBag(newGame(LOOTY, rng0), { scrap: 2, wires: 2 });
        const r = reduce(s, 'craftDecoy');
        expect(r.events).toContain('craftDecoy');
        expect(r.state.bag).toMatchObject({ scrap: 1, wires: 1, decoys: 1 });
        expect(r.state.player.busyMs).toBe(TOOLS.craftMs);
        expect(reduce(r.state, 'craftDecoy').events).toEqual([]);
    });

    it('says when the parts are missing', () =>
    {
        const r = reduce(newGame(LOOTY, rng0), 'craftFlare');
        expect(r.events).toEqual(['noParts']);
        expect(r.state.player.busyMs).toBe(0);
    });

    it('works from inside a locker', () =>
    {
        let s = withBag(newGame(deck(['#####', '#LP.#', '#####', '#A###', '#####'], 3), rng0), { scrap: 1, wires: 1 });
        s = step(reduce(s, 'use').state, 400, rng0).state;
        expect(s.player.hidden).toBe(true);
        expect(reduce(s, 'craftDecoy').events).toContain('craftDecoy');
    });
});

// the creature is round the corner at the end of the corridor (cell 24)
const CORNER = deck(['#######', '#P....#', '#####.#', '#####A#', '#######']);

describe('decoy', () =>
{
    it('lands at the end of the line, or at your feet facing a wall', () =>
    {
        const s = newGame(CORNER, rng0);
        expect(landing(s)).toBe(12);
        expect(landing({ ...s, player: { ...s.player, yaw: 0 } })).toBe(playerCell(s));

        // a closed door stops it
        const doored = newGame(deck(['#########', '#P.D...A#', '#########']), rng0);
        expect(doored.closed).toEqual([12]);
        expect(landing(doored)).toBe(11);
    });

    it('draws the creature to where it fell', () =>
    {
        const s = withBag(newGame(CORNER, rng0), { decoys: 1 });
        const r = reduce(s, 'throwDecoy');
        expect(r.events).toEqual(expect.arrayContaining(['throwDecoy', 'heard']));
        expect(r.state.bag.decoys).toBe(0);
        expect(r.state.decoys).toEqual([{ cell: 12, ms: TOOLS.decoyMs, pulseMs: TOOLS.decoyEveryMs }]);
        expect(r.state.alien).toMatchObject({ mode: 'investigate', target: 12 });
    });

    it('keeps calling until it runs out', () =>
    {
        // the creature is walled in, so nothing interferes
        const s = { ...newGame(LOOTY, rng0), decoys: [{ cell: 12, ms: 2000, pulseMs: 500 }] };
        const first = wait(s, 700);
        expect(first.events).toContain('decoyPing');
        expect(first.s.decoys[0].pulseMs).toBeGreaterThan(900);
        expect(wait(first.s, 1500).s.decoys).toEqual([]);
    });

    it('does not distract a creature that is hunting', () =>
    {
        const s = withBag(newGame(CORNER, rng0), { decoys: 1 });
        const hunting = { ...s, alien: { ...s.alien, mode: 'hunt' as const, target: playerCell(s) } };
        const r = reduce(hunting, 'throwDecoy');
        expect(r.events).not.toContain('heard');
        expect(r.state.alien.mode).toBe('hunt');
    });

    it('needs one to throw', () =>
    {
        expect(reduce(newGame(CORNER, rng0), 'throwDecoy').events).toEqual(['noDecoy']);
        expect(reduce(newGame(CORNER, rng0), 'throwFlare').events).toEqual(['noFlare']);
    });
});

// a long unlit corridor with the creature six cells away, in plain sight
const HALL = ['###############', '#P.....A......#', '###############'];
const DARK_HALL = deck(HALL, 1, [[0, 0, 14, 2]]);

describe('darkness and flares', () =>
{
    it('the creature sees along a lit corridor', () =>
    {
        expect(step(newGame(deck(HALL), rng0), 100, rng0).events).toContain('spotted');
    });

    it('but not from afar when the player stands in the dark', () =>
    {
        const s = newGame(DARK_HALL, rng0);
        expect(world(s).dark).toBe(true);
        expect(wait(s, 600).events).not.toContain('spotted');
    });

    it('a flare lights the player, and so shows them', () =>
    {
        let s = withBag(newGame(DARK_HALL, rng0), { flares: 1 });
        // face the wall behind: the flare drops at the player's feet
        s = at(s, playerCell(s), -EAST);
        const r = reduce(s, 'throwFlare');
        expect(r.events).toContain('throwFlare');
        expect(r.state.flares).toHaveLength(1);
        expect(isLit(r.state, playerCell(r.state))).toBe(true);
        expect(step(r.state, 100, rng0).events).toContain('spotted');
    });

    it('lights the cells within reach and burns out', () =>
    {
        // the creature is walled in, so nothing interferes
        const s = newGame(deck(['####################', '#P.................#', '####################', '#A##################', '####################'], 1, [[0, 0, 19, 4]]), rng0);
        expect(litMask(newGame(deck(HALL), rng0))).toBeNull();
        expect(litMask(s)!.some(Boolean)).toBe(false);

        const lit = flareCells(s.grid, s.closed, 38);
        expect(lit).toEqual([30, 31, 32, 33, 34, 35, 36, 37, 38]);
        const flared = { ...s, flares: [{ cell: 38, ms: TOOLS.flareMs, lit }] };
        expect(isLit(flared, 34)).toBe(true);
        expect(isLit(flared, 24)).toBe(false);
        expect(litMask(flared)![34]).toBe(true);
        expect(litMask(flared)![24]).toBe(false);

        const out = wait(flared, TOOLS.flareMs + 200);
        expect(out.s.flares).toEqual([]);
        expect(out.events).toContain('flareOut');
    });

    it('a closed door stops the light', () =>
    {
        const m = parseMap(['#######', '#P.D..#', '#A#####', '#######']);
        // (1,2) below the player is open floor; the door at (3,1) closes the corridor
        expect(flareCells(m.grid, m.closed, m.start)).toEqual([8, 9, 15]);
    });
});

// the creature three cells ahead in a corridor
const CORRIDOR = ['##########', '#P..A....#', '##########'];
const armed = (map = CORRIDOR) => withBag(newGame(deck(map), rng0), { flamer: true, fuel: 2 });
// the creature in the same corridor, hunting
const hunted = (s: GameState): GameState => ({ ...s, alien: { ...s.alien, mode: 'hunt', target: playerCell(s), stepMs: 400 } });

describe('flamethrower', () =>
{
    it('reaches a few cells ahead and stops at walls', () =>
    {
        const s = armed();
        expect(flameCells(s)).toEqual([12, 13, 14, 15, 16, 17]);
        const doored = newGame(deck(['##########', '#P.D.A...#', '##########']), rng0);
        expect(flameCells(doored)).toEqual([12]);
        expect(flameCells({ ...s, player: { ...s.player, yaw: 0 } })).toEqual([]);
    });

    it('sends the creature running, and it ignores the player meanwhile', () =>
    {
        let s = armed();
        const r = reduce(hunted(s), 'fire');
        expect(r.events).toEqual(expect.arrayContaining(['fire', 'scare']));
        expect(r.state).toMatchObject({ burns: 1, bag: { fuel: 1 }, flameMs: TOOLS.flameShowMs });
        expect(r.state.alien).toMatchObject({ mode: 'flee', fleeMs: fleeMsFor(0) });
        expect(r.state.player.busyMs).toBe(TOOLS.fireMs);

        s = r.state;
        const far = wait(s, 2500);
        expect(far.s.alien.cell).toBeGreaterThan(s.alien.cell);
        expect(far.s.alien.mode).toBe('flee');
        expect(far.events).not.toContain('spotted');
        expect(far.s.phase).toBe('playing');
    });

    it('comes back to look for the player once its fear is over', () =>
    {
        const s = reduce(hunted(armed()), 'fire').state;
        const r = wait(s, fleeMsFor(0) + 200, st => st.alien.mode !== 'flee');
        expect(r.s.alien.mode).toBe('search');
    });

    it('learns: each burn makes it run for less', () =>
    {
        expect(fleeMsFor(0)).toBe(ALIEN.fleeMs);
        expect(fleeMsFor(1)).toBeLessThan(fleeMsFor(0));
        expect(fleeMsFor(2)).toBeLessThan(fleeMsFor(1));
        expect(fleeMsFor(50)).toBe(ALIEN.minFleeMs);

        const burnt = { ...hunted(armed()), burns: 2 };
        expect(reduce(burnt, 'fire').state.alien.fleeMs).toBe(fleeMsFor(2));
    });

    it('a miss costs fuel and is heard', () =>
    {
        // the creature is round the corner, out of the flame
        const s = withBag(newGame(CORNER, rng0), { flamer: true, fuel: 2 });
        const r = reduce(s, 'fire');
        expect(r.events).toEqual(expect.arrayContaining(['fire', 'heard']));
        expect(r.events).not.toContain('scare');
        expect(r.state.bag.fuel).toBe(1);
        expect(r.state.burns).toBe(0);
        expect(r.state.alien.mode).toBe('investigate');
    });

    it('needs the flamethrower and fuel', () =>
    {
        expect(reduce(newGame(deck(CORRIDOR), rng0), 'fire').events).toEqual(['noFlamer']);
        expect(reduce(withBag(newGame(deck(CORRIDOR), rng0), { flamer: true, fuel: 0 }), 'fire').events).toEqual(['noFuel']);
    });

    it('cannot hit a creature in the ducts', () =>
    {
        const s = armed();
        const crawling = { ...s, alien: { ...s.alien, cell: 12, vent: { from: 12, to: 13, ms: 3000, totalMs: 3000 } } };
        expect(reduce(crawling, 'fire').events).not.toContain('scare');
    });

    it('a cornered creature waits instead of passing through the player', () =>
    {
        // the creature is in a dead end behind the player
        const s = withBag(newGame(deck(['#######', '#AP...#', '#######', '#######'], 3), rng0), { flamer: true, fuel: 1 });
        const r = reduce({ ...s, alien: { ...s.alien, cell: 8, mode: 'hunt' } }, 'fire');
        expect(r.events).toContain('scare');
        const later = wait(r.state, 6000);
        expect(later.s.phase).toBe('playing');
        expect(later.s.alien.cell).toBe(8);
    });
});

describe('fleeing through the ducts', () =>
{
    // vents at 12 and 14, the player on the far side
    const DUCTS = deck(['#########', '#A.V#V.P#', '##.###.##', '##.....##', '#########'], 3);

    it('runs for the nearest vent the player is not at, and leaves by the farthest', () =>
    {
        const s = newGame(DUCTS, rng0);
        const a = scare({ ...s.alien, cell: 11 }, world(s), 0);
        expect(a).toMatchObject({ mode: 'flee', target: 12, ventPlan: 14 });
    });

    it('goes into the duct, and comes out no longer afraid', () =>
    {
        const s = newGame(DUCTS, rng0);
        const scared = { ...s, alien: scare({ ...s.alien, cell: 12, stepMs: 0 }, world(s), 0) };
        const r = wait(scared, 800, (_, e) => e.includes('ventIn'));
        expect(r.events).toContain('ventIn');
        const out = wait(r.s, 10000, (_, e) => e.includes('ventOut'));
        expect(out.events).toContain('ventOut');
        // afraid no longer: it goes back to its business, or to the player if it sees them
        expect(out.s.alien.mode).not.toBe('flee');
    });
});
