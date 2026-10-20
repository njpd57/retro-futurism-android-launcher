import { describe, expect, it } from 'vitest';
import { ASH, newAsh, stepAsh, type AshWorld } from '../android';
import { advance, deckScore, endingOf, levelOf, modeOf, startCampaign, startInfinite } from '../campaign';
import { CAMPAIGN, DECKS, type DeckDef } from '../decks';
import { DIFFICULTY } from '../difficulty';
import { MEOW, STEAM, carryOf, newGame, reduce, step, steaming, terminalTask, type GameEvent, type GameState, type Input } from '../game';
import { parseMap, type Dir } from '../grid';
import { LOGS } from '../logs';
import { isProgress, record, EMPTY_PROGRESS, ACHIEVEMENTS, infiniteUnlocked } from '../progress';
import { isSavedGame, restore, snapshot } from '../save';
import { messageFor, objective, countdownLine } from '../story';
import { describeSave, directionTo, hintFor } from '../hints';
import { seeded } from '../rng';

const rng0 = () => 0;
const deck = (map: string[], extra: Partial<DeckDef> = {}, startDir: Dir = 1): DeckDef => ({ id: 't', title: 'T', map, startDir, signs: [], briefing: [], ...extra });

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

function wait(s: GameState, ms: number, until: (s: GameState) => boolean = () => false)
{
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 100)
    {
        const r = step(s, 100, rng0);
        s = r.state;
        events.push(...r.events);
        if (until(s)) break;
    }
    return { s, events };
}

// the creature is walled in at the bottom
const BOX = (row: string, extra = '') => ['#'.repeat(row.length), row, '#'.repeat(row.length), `#A${'#'.repeat(row.length - 2)}`, '#'.repeat(row.length), ...(extra ? [extra] : [])];

describe('Ash', () =>
{
    const hall = ['########', '#P....H#', '########', '#A######', '########'];
    const world = (over: Partial<AshWorld> = {}): AshWorld => ({ grid: parseMap(hall).grid, closed: [], player: 1 * 8 + 1, hidden: false, ...over });

    it('sees along a corridor and chases, slower than the player walks', () =>
    {
        const ash = newAsh(parseMap(hall).ash!);
        const r = stepAsh({ ...ash, stepMs: 0 }, world(), 10, rng0);
        expect(r.events).toContain('ashSpotted');
        expect(r.ash.mode).toBe('chase');
        expect(r.ash.cell).toBe(ash.cell - 1);
        expect(r.ash.stepMs).toBe(ASH.stepMs.chase);
        expect(ASH.stepMs.chase).toBeGreaterThan(380);
    });

    it("doesn't see a player who is hidden or out of range", () =>
    {
        const ash = { ...newAsh(parseMap(hall).ash!), stepMs: 1000 };
        expect(stepAsh(ash, world({ hidden: true }), 10, rng0).events).toEqual([]);
        expect(stepAsh(ash, world({ dark: true }), 10, rng0).ash.mode).toBe('wander');
    });

    it('stops at a closed door', () =>
    {
        const map = ['#########', '#P..D..H#', '#########', '#A#######', '#########'];
        const g = parseMap(map);
        let ash = { ...newAsh(g.ash!), stepMs: 0 };
        for (let i = 0; i < 6; i++) ash = stepAsh({ ...ash, stepMs: 0 }, { grid: g.grid, closed: g.closed, player: g.start, hidden: false }, 10, rng0).ash;
        expect(ash.cell).toBeGreaterThan(g.closed[0]);
    });

    it("does nothing when it's switched off", () =>
    {
        const ash = { ...newAsh(5), active: false };
        expect(stepAsh(ash, world(), 5000, rng0)).toEqual({ ash, events: [] });
    });

    it('kills on reaching the player, and stands in the way when it is off', () =>
    {
        const s = newGame(deck(['#######', '#P.H..#', '#######', '#A#####', '#######']), rng0);
        const dead = wait(s, 8000, x => x.phase !== 'playing').s;
        expect(dead.phase).toBe('dead');
        expect(dead.death).toBe('ash');
        const off = { ...s, ash: { ...s.ash!, active: false } };
        const r = act(off, 'forward', 'forward');
        expect(r.s.phase).toBe('playing');
        expect(r.s.player.cell).toBe(s.player.cell + 1);
        expect(r.events).toContain('bump');
    });

    it('is not shown by the tracker', () =>
    {
        const s = newGame(deck(['#########', '#P.....H#', '#########', '#A#######', '#########']), rng0);
        const up = reduce(s, 'tracker').state;
        const r = wait({ ...up, tracker: { ...up.tracker, pingMs: 0 } }, 200);
        expect(r.s.tracker.blip).toBeNull();
    });
});

describe('steam', () =>
{
    const s0 = newGame(deck(BOX('#P.~.E#'.slice(0, 7)).map((r, i) => i === 1 ? '#P.~..E#'.slice(0, 7) : r)), rng0);

    it('leaks on a cycle, and each leak at its own time', () =>
    {
        const s = newGame(deck(['#########', '#P.~.~.E#', '#########', '#A#######', '#########']), rng0);
        const [a, b] = s.steam;
        expect(steaming(s, a, 0)).toBe(true);
        expect(steaming(s, a, STEAM.onMs + 10)).toBe(false);
        // the second one starts later in the cycle
        const t = STEAM.periodMs - STEAM.stagger + 1;
        expect(steaming(s, a, t)).toBe(false);
        expect(steaming(s, b, t)).toBe(true);
        expect(steaming(s, 99, 0)).toBe(false);
    });

    it('cuts the corridor while it vents', () =>
    {
        const s = { ...s0, timeMs: 0 };
        expect(s.steam).toHaveLength(1);
        const blocked = act({ ...s, player: { ...s.player, cell: s.steam[0] - 1 } }, 'forward');
        expect(blocked.events).toContain('steamBlock');
        expect(blocked.s.player.cell).toBe(s.steam[0] - 1);
        const later = act({ ...s, timeMs: STEAM.onMs + 500, player: { ...s.player, cell: s.steam[0] - 1 } }, 'forward');
        expect(later.s.player.cell).toBe(s.steam[0]);
    });

    it('is announced when it starts', () =>
    {
        const s = newGame(deck(['#########', '#P.~...E#', '#########', '#A#######', '#########']), rng0);
        const r = wait({ ...s, timeMs: STEAM.periodMs - 600 }, 1000);
        expect(r.events).toContain('steam');
    });
});

describe('blackout', () =>
{
    const d = deck(['#########', '#P.....E#', '#########', '#A#######', '#########'], { blackout: { rects: [[3, 1, 6, 1]], periodMs: 10000, offMs: 4000 } });

    it('takes the power out of a zone for a part of every period', () =>
    {
        const s = newGame(d, rng0);
        expect(s.dark.some(Boolean)).toBe(false);
        const out = wait(s, 6500);
        expect(out.events).toContain('blackout');
        expect(out.s.dark[1 * 9 + 4]).toBe(true);
        const back = wait(out.s, 4500);
        expect(back.events).toContain('powerBack');
        expect(back.s.dark.some(Boolean)).toBe(false);
    });

    it('comes back right after a restore', () =>
    {
        const m = DECKS.maint;
        const mask = newGame(m, rng0).blackout!.mask;
        const out = wait(newGame(m, rng0), m.blackout!.periodMs - 1000).s;
        expect(out.blackout!.on).toBe(true);
        const back = restore(JSON.parse(JSON.stringify(snapshot(out))), rng0);
        expect(back.blackout!.on).toBe(true);
        expect(back.dark.some(Boolean)).toBe(true);
        expect(back.dark.map((x, i) => x === mask[i]).every(Boolean)).toBe(true);
    });
});

describe('a door without power', () =>
{
    const d = deck(['###########', '#P.T.X..E.#', '###########', '#A#########', '###########'], { terminals: [{ x: 3, y: 1, opens: [5, 1] }] });

    it("can't be opened, and the bump says why", () =>
    {
        const s = newGame(d, rng0);
        expect(s.locked).toEqual([1 * 11 + 5]);
        expect(s.closed).toContain(1 * 11 + 5);
        const r = act({ ...s, player: { ...s.player, cell: 1 * 11 + 4 } }, 'use', 'forward');
        expect(r.events).toContain('locked');
        expect(r.s.closed).toContain(1 * 11 + 5);
    });

    it('opens when its terminal diverts the power', () =>
    {
        const s0 = newGame(d, rng0);
        const s = { ...s0, player: { ...s0.player, cell: 1 * 11 + 3 } };
        expect(terminalTask(s)).toBe('divert');
        const used = reduce(s, 'use');
        const done = wait(used.state, 3500);
        expect(done.events).toContain('diverted');
        expect(done.s.locked).toEqual([]);
        expect(done.s.closed).not.toContain(1 * 11 + 5);
        expect(terminalTask(done.s)).toBe('save');
        const through = act({ ...done.s, player: { ...done.s.player, busyMs: 0, cell: 1 * 11 + 4, dir: 1 } }, 'forward', 'forward');
        expect(through.s.player.cell).toBe(1 * 11 + 6);
    });

    it("the creature can't force it either", () =>
    {
        const s = newGame(deck(['#########', '#A..XP.E#', '#########'], {}), rng0);
        const r = wait({ ...s, alien: { ...s.alien, mode: 'hunt', target: s.player.cell, stepMs: 0 } }, 20000);
        expect(r.s.closed).toContain(1 * 9 + 4);
        expect(r.s.alien.cell).toBeLessThan(1 * 9 + 4);
    });
});

describe('terminals', () =>
{
    const d = deck(['#########', '#PT....E#', '#########', '#A#######', '#########'], { terminals: [{ x: 1 + 1, y: 1, log: 'c1', ashOff: true }] });

    it('read a log the first time, send the map, and save', () =>
    {
        const s0 = newGame(d, rng0);
        const s = { ...s0, player: { ...s0.player, cell: 1 * 9 + 2 } };
        expect(terminalTask(s)).toBe('log');
        const r = wait(reduce(s, 'use').state, 3500);
        expect(r.events).toEqual(expect.arrayContaining(['saved', 'mapped', 'log']));
        expect(r.s.logs).toEqual(['c1']);
        expect(r.s.mapped).toBe(true);
        expect(messageFor(['saved', 'mapped', 'log'], r.s)).toContain(LOGS[0].title);
        // the second time it only saves
        expect(terminalTask(r.s)).toBe('save');
        const again = wait({ ...r.s, player: { ...r.s.player, busyMs: 0 } }, 0);
        expect(again.s.logs).toEqual(['c1']);
    });

    it('switch Ash off', () =>
    {
        const withAsh = deck(['#########', '#PT...H.#', '#########', '#A#######', '#########'], { terminals: [{ x: 2, y: 1, ashOff: true }] });
        const s0 = newGame(withAsh, rng0);
        const s = { ...s0, player: { ...s0.player, cell: 1 * 9 + 2 } };
        expect(terminalTask(s)).toBe('ashOff');
        const r = wait(reduce(s, 'use').state, 3500);
        expect(r.events).toContain('ashOff');
        expect(r.s.ash!.active).toBe(false);
    });
});

describe('the countdown', () =>
{
    const d = deck(['#######', '#P...E#', '#######', '#A#####', '#######'], { countdownMs: 300000 });

    it('starts with the deck, shaped by the difficulty', () =>
    {
        expect(newGame(d, rng0).countdownMs).toBe(300000);
        expect(newGame(d, rng0, { ...carryOf(newGame(d, rng0)), difficulty: 'easy' }).countdownMs).toBe(300000 + DIFFICULTY.easy.countdownMs);
        expect(newGame(d, rng0, { ...carryOf(newGame(d, rng0)), difficulty: 'hard' }).countdownMs).toBe(300000 + DIFFICULTY.hard.countdownMs);
        expect(newGame(deck(['#####', '#PAE#', '#####']), rng0).countdownMs).toBeNull();
    });

    it('is announced every minute and in the last half minute', () =>
    {
        const s = newGame(d, rng0);
        const calls: number[] = [];
        let cur = s;
        for (let t = 0; t < 300000; t += 500)
        {
            const r = step({ ...cur, alien: { ...cur.alien, cell: 3 * 7 + 1 } }, 500, rng0);
            cur = r.state;
            if (r.events.includes('countdown')) calls.push(Math.round((300000 - t - 500) / 1000));
            if (cur.phase !== 'playing') break;
        }
        expect(calls).toEqual([240, 180, 120, 60, 30]);
    });

    it('ends the run in the blast', () =>
    {
        const s = newGame(d, rng0);
        const r = step({ ...s, countdownMs: 200 }, 300, rng0);
        expect(r.events).toEqual(expect.arrayContaining(['blast', 'dead']));
        expect(r.state).toMatchObject({ phase: 'dead', death: 'blast', countdownMs: 0 });
    });

    it('is worded for the HUD and for MOTHER', () =>
    {
        expect(countdownLine(240000)).toBe('AUTODESTRUCCIÓN EN 4 MINUTOS.');
        expect(countdownLine(60000)).toBe('AUTODESTRUCCIÓN EN 1 MINUTO.');
        expect(countdownLine(30000)).toBe('AUTODESTRUCCIÓN: 30 SEGUNDOS.');
        expect(objective(newGame(d, rng0))).toContain('EXPLOSIÓN');
    });
});

describe('Jones', () =>
{
    const d = deck(['#########', '#Pj...E.#', '#########', '#A#######', '#########']);

    it('is picked up, and meows now and then', () =>
    {
        const { s, events } = act(newGame(d, rng0), 'forward', 'forward');
        expect(events).toContain('lootCat');
        expect(s.jones).toBe(true);
        expect(s.loot).toEqual([]);
        const r = wait({ ...s, timeMs: MEOW.everyMs - 300 }, 1000);
        expect(r.events).toContain('meow');
        expect(wait({ ...newGame(d, rng0), timeMs: MEOW.everyMs - 300 }, 1000).events).not.toContain('meow');
    });

    it('decides the ending', () =>
    {
        const s = newGame(d, rng0);
        expect(endingOf(s)).toBe('solo');
        expect(endingOf({ ...s, jones: true })).toBe('jones');
    });
});

describe('difficulty', () =>
{
    const d = deck(['#########', '#P.....E#', '#########', '#A#######', '#########']);
    const carry = (difficulty: 'easy' | 'normal' | 'hard') => ({ ...carryOf(newGame(d, rng0)), difficulty });

    it('slows or speeds the creature', () =>
    {
        const pace = (difficulty: 'easy' | 'normal' | 'hard') =>
        {
            const s = newGame(d, rng0, carry(difficulty));
            const heard = { ...s, alien: { ...s.alien, mode: 'hunt' as const, target: 1 * 9 + 6, cell: 1 * 9 + 1, stepMs: 0 } };
            return step(heard, 10, rng0).state.alien.stepMs;
        };
        expect(pace('easy')).toBeGreaterThan(pace('normal'));
        expect(pace('normal')).toBeGreaterThan(pace('hard'));
    });

    it('gives the easy mode a decoy and a flare at every deck, up to the limit', () =>
    {
        expect(newGame(d, rng0, carry('easy')).bag).toMatchObject({ decoys: 1, flares: 1 });
        expect(newGame(d, rng0, carry('normal')).bag).toMatchObject({ decoys: 0, flares: 0 });
        const full = { ...carry('easy'), bag: { ...carry('easy').bag, decoys: 3 } };
        expect(newGame(d, rng0, full).bag.decoys).toBe(3);
    });

    it('is kept in a save', () =>
    {
        const s = newGame(DECKS.c, rng0, carry('hard'));
        const back = restore(JSON.parse(JSON.stringify(snapshot(s))), rng0);
        expect(back.difficulty).toBe('hard');
    });
});

describe('the run', () =>
{
    const rng = seeded(5);

    it('starts at the first deck and goes on to the next, taking the bag, Jones and the counters', () =>
    {
        const s = startCampaign('hard', rng);
        expect(s).toMatchObject({ deck: 'c', difficulty: 'hard', jones: false });
        expect(levelOf('c')).toBe(1);
        expect(modeOf('c')).toBe('campaign');
        const won: GameState = { ...s, phase: 'won', bag: { ...s.bag, scrap: 2, flamer: true, fuel: 1 }, jones: true, logs: ['c1'], fires: 2, spotted: 3, timeMs: 90000 };
        const next = advance(won, rng)!;
        expect(next).toMatchObject({ deck: 'b', difficulty: 'hard', jones: true, logs: ['c1'], fires: 2, spotted: 3, timeMs: 90000, startMs: 90000, spottedStart: 3, phase: 'playing' });
        expect(next.bag).toMatchObject({ scrap: 2, flamer: true, fuel: 1 });
        // the creature, the doors and the loot start again
        expect(next.collected).toBe(0);
        expect(next.items.length).toBe(3);
    });

    it('goes through all five decks and then ends', () =>
    {
        let s: GameState | null = startCampaign('normal', rng);
        const seen: string[] = [];
        while (s)
        {
            seen.push(s.deck);
            s = advance({ ...s, phase: 'won' }, rng);
        }
        expect(seen).toEqual(CAMPAIGN.map(d => d.id));
    });

    it('scores depth, speed and staying unseen in the endless mode, and goes one level deeper', () =>
    {
        const s = startInfinite(1234, 'normal', rng);
        expect(s.deck).toBe('inf:1234:1');
        expect(modeOf(s.deck)).toBe('infinite');
        const quick = { ...s, phase: 'won' as const, timeMs: 100000 };
        expect(deckScore(quick)).toBe(100 + 200 + 100);
        expect(deckScore({ ...quick, spotted: 1 })).toBe(100 + 200);
        const next = advance(quick, rng)!;
        expect(next.deck).toBe('inf:1234:2');
        expect(next.score).toBe(400);
        expect(levelOf(next.deck)).toBe(2);
    });

    it('survives a save with its counters', () =>
    {
        const s = { ...startInfinite(99, 'easy', rng), jones: true, logs: ['c1', 'c2'], fires: 4, spotted: 2, score: 700, mapped: true };
        const stored: unknown = JSON.parse(JSON.stringify(snapshot(s)));
        expect(isSavedGame(stored)).toBe(true);
        const back = restore(stored as ReturnType<typeof snapshot>, rng);
        expect(back).toMatchObject({ deck: 'inf:99:1', difficulty: 'easy', jones: true, logs: ['c1', 'c2'], fires: 4, spotted: 2, score: 700, mapped: true });
    });

    it('rejects saves of the wrong shape or version', () =>
    {
        const good = JSON.parse(JSON.stringify(snapshot(startCampaign('normal', rng))));
        expect(isSavedGame(good)).toBe(true);
        expect(isSavedGame({ ...good, v: 2 })).toBe(false);
        expect(isSavedGame({ ...good, deck: 'nope' })).toBe(false);
        expect(isSavedGame({ ...good, difficulty: 'insane' })).toBe(false);
        expect(isSavedGame({ ...good, ash: { cell: 1 } })).toBe(false);
        expect(isSavedGame({ ...good, logs: [1] })).toBe(false);
        expect(isSavedGame({ ...good, countdownMs: 'x' })).toBe(false);
    });
});

describe('the archive', () =>
{
    const rng = seeded(8);
    const run = (extra: Partial<GameState> = {}): GameState => ({ ...startCampaign('normal', rng), ...extra });

    it('starts empty and valid', () =>
    {
        expect(isProgress(EMPTY_PROGRESS)).toBe(true);
        expect(isProgress({ ...EMPTY_PROGRESS, endings: ['nope'] })).toBe(false);
        expect(isProgress(JSON.parse(JSON.stringify(EMPTY_PROGRESS)))).toBe(true);
        expect(isProgress(null)).toBe(false);
    });

    it('remembers logs and earns ORDEN 937 and ARCHIVISTA', () =>
    {
        let p = EMPTY_PROGRESS;
        let earned: string[] = [];
        ({ progress: p, earned } = record(p, { type: 'log', id: 'orden937' }));
        expect(earned).toEqual(['order937']);
        for (const l of LOGS) ({ progress: p, earned } = record(p, { type: 'log', id: l.id }));
        expect(p.logs).toHaveLength(LOGS.length);
        expect(p.achievements).toEqual(expect.arrayContaining(['order937', 'archivist']));
        // nothing earned twice
        expect(record(p, { type: 'log', id: 'c1' }).earned).toEqual([]);
        expect(EMPTY_PROGRESS.logs).toEqual([]);
    });

    it('earns the ending achievements', () =>
    {
        const jones = record(EMPTY_PROGRESS, { type: 'ending', state: run({ jones: true, fires: 0, difficulty: 'hard' }), ending: 'jones' });
        expect(jones.earned.sort()).toEqual(['jones', 'nofire', 'survivor', 'veteran']);
        expect(jones.progress.stats.campaigns).toBe(1);
        expect(infiniteUnlocked(jones.progress)).toBe(true);
        const solo = record(EMPTY_PROGRESS, { type: 'ending', state: run({ fires: 3 }), ending: 'solo' });
        expect(solo.earned.sort()).toEqual(['survivor']);
        expect(solo.progress.stats.fires).toBe(3);
        const blast = record(EMPTY_PROGRESS, { type: 'ending', state: run(), ending: 'blast' });
        expect(blast.earned).toEqual([]);
        expect(blast.progress.endings).toEqual(['blast']);
        expect(infiniteUnlocked(blast.progress)).toBe(false);
        expect(infiniteUnlocked(EMPTY_PROGRESS)).toBe(false);
    });

    it('earns SIN SER VISTO for a deck nobody saw you in, and the sector marks', () =>
    {
        expect(record(EMPTY_PROGRESS, { type: 'deck', state: run({ phase: 'won', timeMs: 5000 }) }).earned).toEqual(['unseen']);
        expect(record(EMPTY_PROGRESS, { type: 'deck', state: run({ spotted: 2 }) }).earned).toEqual([]);
        const deep = startInfinite(77, 'normal', rng);
        const at = (level: number) => ({ ...deep, deck: `inf:77:${level}`, score: 1500, spotted: 1 });
        const r5 = record(EMPTY_PROGRESS, { type: 'deck', state: at(5) });
        expect(r5.earned).toEqual(['sector5']);
        expect(r5.progress.best).toMatchObject({ level: 5, seed: 77 });
        const r10 = record(r5.progress, { type: 'deck', state: at(10) });
        expect(r10.earned).toEqual(['sector10']);
        expect(r10.progress.best!.level).toBe(10);
        // a worse run doesn't replace the best
        expect(record(r10.progress, { type: 'deck', state: at(3) }).progress.best!.level).toBe(10);
    });

    it('counts deaths and shutting Ash down', () =>
    {
        expect(record(EMPTY_PROGRESS, { type: 'death' }).progress.stats.deaths).toBe(1);
        expect(record(EMPTY_PROGRESS, { type: 'ashOff' }).earned).toEqual(['shutdown']);
    });

    it('has a hint for every achievement', () =>
    {
        expect(ACHIEVEMENTS).toHaveLength(10);
        for (const a of ACHIEVEMENTS) { expect(a.title).toBe(a.title.toUpperCase()); expect(a.hint.length).toBeGreaterThan(5); }
    });
});

describe('hints', () =>
{
    const d = deck(['#########', '#P....E.#', '#########', '#A#######', '#########']);

    it('points to the nearest cell, then to the exit', () =>
    {
        const withCell = newGame(deck(['#########', '#P..*.E.#', '#########', '#A#######', '#########']), rng0);
        expect(hintFor(withCell)[0]).toBe('CÉLULA MÁS CERCANA: AL ESTE, 3 PASOS.');
        const done = { ...withCell, items: [], collected: 1, needed: 1 };
        expect(hintFor(done)[0]).toBe('LANZADERA: AL ESTE, 5 PASOS.');
        expect(hintFor({ ...done, phase: 'dead' })).toEqual(['SIN PARTIDA EN CURSO.']);
    });

    it('reports the problems of the deck', () =>
    {
        const lines = hintFor(newGame(DECKS.maint, rng0)).join(' ');
        expect(lines).toContain('PUERTA SIN ENERGÍA');
        expect(lines).toContain('PANEL DE DESVÍO');
        const lab = hintFor(newGame(DECKS.lab, rng0)).join(' ');
        expect(lab).toContain('ASH ACTIVO');
        expect(lab).toContain('TERMINAL DE CONTROL');
        expect(hintFor(newGame(DECKS.hangar, rng0)).join(' ')).toContain('AUTODESTRUCCIÓN EN 05:00');
        expect(hintFor(newGame(DECKS.b, rng0)).join(' ')).toContain('LANZALLAMAS');
        expect(hintFor(newGame(DECKS.hangar, rng0)).join(' ')).toContain('JONES');
    });

    it('finds the way, or says there is none', () =>
    {
        const g = parseMap(d.map).grid;
        expect(directionTo(g, 1 * 9 + 1, 1 * 9 + 6)).toBe('AL ESTE, 5 PASOS');
        expect(directionTo(g, 1 * 9 + 1, 3 * 9 + 1)).toBeNull();
    });

    it('describes a save', () =>
    {
        const saved = snapshot(newGame(DECKS.b, rng0));
        expect(describeSave(saved)[0]).toBe('CAMPAÑA 2/5 · CUBIERTA B · CONDUCTOS');
        expect(describeSave(snapshot(startInfinite(5, 'normal', rng0)))[0]).toBe('MODO INFINITO · SECTOR 1');
    });
});
