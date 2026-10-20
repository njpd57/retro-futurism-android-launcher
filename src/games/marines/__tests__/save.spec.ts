import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { spawnEnemy } from '../enemies';
import { NO_CONTROLS, act, newGame, step, type MarinesState } from '../game';
import { ARENAS, ARENA_CONDUITS, ARENA_OPERATIONS } from '../map';
import { EMPTY_RECORD, buildReport, isRecords, mergeRecord } from '../report';
import { isSavedGame, restore, snapshot } from '../save';

const rng = seeded(3);

function played(): MarinesState
{
    let s = newGame(ARENA_CONDUITS);
    for (let t = 0; t < 9000; t += 33) s = step(s, 33, { ...NO_CONTROLS, fire: t > 5000 }, rng).state;
    s = { ...s, enemies: [...s.enemies, spawnEnemy(s.nextId, 'spitter', s.grid, 3 * 26 + 8)], nextId: s.nextId + 1 };
    return act(s, 'turret').state;
}

describe('the suspended game', () =>
{
    it('survives JSON and comes back as it was', () =>
    {
        const s = played();
        const saved = JSON.parse(JSON.stringify(snapshot(s)));
        expect(isSavedGame(saved)).toBe(true);
        const back = restore(saved);
        expect(back.arena).toBe(s.arena);
        expect(back.player).toEqual(s.player);
        expect(back.enemies).toEqual(s.enemies);
        expect(back.turrets).toEqual(s.turrets);
        expect(back.wave).toEqual(s.wave);
        expect(back.score).toBe(s.score);
        expect(back.pickups.map(p => p.taken)).toEqual(s.pickups.map(p => p.taken));
        expect(step(back, 100, NO_CONTROLS, rng).state.timeMs).toBeGreaterThan(s.timeMs);
    });

    it('keeps welded doors shut', () =>
    {
        let s = newGame(ARENA_CONDUITS);
        s = { ...s, player: { ...s.player, x: 6.5, y: 3.5, yaw: -Math.PI / 2 } };
        const sealed = act(s, 'weld').state;
        expect(sealed.welds).toHaveLength(1);
        const back = restore(JSON.parse(JSON.stringify(snapshot(sealed))));
        expect(back.closed).toContain(sealed.welds[0].cell);
        expect(back.field.key).not.toBe('');
    });

    it('rejects what is old, damaged or foreign', () =>
    {
        const good = JSON.parse(JSON.stringify(snapshot(played())));
        expect(isSavedGame(good)).toBe(true);
        expect(isSavedGame(null)).toBe(false);
        expect(isSavedGame({ ...good, v: 1 })).toBe(false);
        expect(isSavedGame({ ...good, arena: 'nope' })).toBe(false);
        expect(isSavedGame({ ...good, mission: 'nope' })).toBe(false);
        expect(isSavedGame({ ...good, rules: { hp: 1 } })).toBe(false);
        expect(isSavedGame({ ...good, player: { ...good.player, x: 999 } })).toBe(false);
        expect(isSavedGame({ ...good, player: { ...good.player, health: 0 } })).toBe(false);
        expect(isSavedGame({ ...good, enemies: [{ ...good.enemies[0], kind: 'ghost' }] })).toBe(false);
        expect(isSavedGame({ ...good, wave: { ...good.wave, phase: 'x' } })).toBe(false);
        expect(Object.keys(ARENAS)).toContain(good.arena);
    });
});

describe('the report and the records', () =>
{
    it('reports a run', () =>
    {
        const s = { ...newGame(ARENA_OPERATIONS), kills: 7, score: 900, shots: 10, hits: 5, timeMs: 61000, killsBy: { drone: 5, runner: 1, hugger: 1, spitter: 0, queen: 0 } };
        const r = buildReport(s);
        expect(r).toMatchObject({ arena: 'operaciones', wave: 1, score: 900, kills: 7, accuracy: 0.5, timeMs: 61000 });
        expect(r.killsBy.drone).toBe(5);
    });

    it('keeps the best of each and says what a run beat, but not on the first run', () =>
    {
        const base = buildReport(newGame(ARENA_OPERATIONS));
        const first = mergeRecord(EMPTY_RECORD, { ...base, wave: 3, score: 500, kills: 10, timeMs: 90000 });
        expect(first.record).toEqual({ wave: 3, score: 500, kills: 10, timeMs: 90000, runs: 1 });
        expect(first.beaten).toEqual([]);
        const second = mergeRecord(first.record, { ...base, wave: 2, score: 800, kills: 4, timeMs: 30000 });
        expect(second.record).toEqual({ wave: 3, score: 800, kills: 10, timeMs: 90000, runs: 2 });
        expect(second.beaten).toEqual(['score']);
    });

    it('validates stored records', () =>
    {
        expect(isRecords({ operaciones: EMPTY_RECORD })).toBe(true);
        expect(isRecords({ operaciones: { wave: 'x' } })).toBe(false);
        expect(isRecords([])).toBe(false);
    });
});

describe('the totals', () =>
{
    it('add up every run', async () =>
    {
        const { EMPTY_STATS, addStats } = await import('../report');
        const base = buildReport(newGame(ARENA_OPERATIONS));
        const a = addStats(EMPTY_STATS, { ...base, kills: 10, timeMs: 5000, shots: 100, accuracy: 0.5, built: { turrets: 2, welds: 1 } }, false);
        const b = addStats(a, { ...base, kills: 5, timeMs: 1000, shots: 50, accuracy: 0.4, built: { turrets: 0, welds: 3 } }, true);
        expect(b).toEqual({ runs: 2, kills: 15, timeMs: 6000, shots: 150, hits: 70, turrets: 2, welds: 4, missions: 1 });
    });
});
