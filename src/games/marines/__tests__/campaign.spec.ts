import { describe, expect, it } from 'vitest';
import { seeded } from '../../isolation/rng';
import { DIFFICULTY, DIFFICULTY_ORDER, MISSIONS, isCampaign, missionById, missionDone, missionProgress, unlocked } from '../campaign';
import { NO_CONTROLS, newGame, step, type MarinesState } from '../game';
import { ARENAS } from '../map';
import { status } from '../radio';
import { restore, snapshot } from '../save';

const rng = seeded(21);
const start = (id: string, difficulty: 'recluta' | 'veterano' | 'pesadilla' = 'veterano'): MarinesState =>
    newGame(ARENAS[missionById(id)!.arena], { mission: id, difficulty });

describe('the missions', () =>
{
    it('each name an arena that exists and goals to meet', () =>
    {
        for (const m of MISSIONS)
        {
            expect(ARENAS[m.arena], m.id).toBeDefined();
            expect(Object.keys(m.goals).length, m.id).toBeGreaterThan(0);
            expect(m.briefing.length).toBeGreaterThan(0);
            expect(m.debrief.length).toBeGreaterThan(0);
        }
        expect(new Set(MISSIONS.map(m => m.id)).size).toBe(MISSIONS.length);
    });

    it('open one after another', () =>
    {
        expect(unlocked(new Set()).map(m => m.id)).toEqual([MISSIONS[0].id]);
        expect(unlocked(new Set([MISSIONS[0].id])).map(m => m.id)).toEqual([MISSIONS[0].id, MISSIONS[1].id]);
        expect(unlocked(new Set(MISSIONS.map(m => m.id)))).toHaveLength(MISSIONS.length);
        // a later one won without the earlier does not open anything new
        expect(unlocked(new Set([MISSIONS[1].id]))).toHaveLength(1);
    });

    it('are done only when every goal is met, and never outside a mission', () =>
    {
        const s = start('sellen');
        expect(missionDone(s)).toBe(false);
        const waves = { ...s, wave: { ...s.wave, n: 6 } };
        expect(missionDone(waves)).toBe(false);
        expect(missionDone({ ...waves, built: { turrets: 0, welds: 2 } })).toBe(true);
        expect(missionDone({ ...newGame(ARENAS.operaciones), wave: { ...s.wave, n: 99 } })).toBe(false);
    });

    it('report their progress, which the status line shows', () =>
    {
        const s = { ...start('limpieza'), kills: 12, built: { turrets: 1, welds: 0 } };
        expect(missionProgress(s)).toBe('BAJAS 12/60 · TORRETAS 1/2');
        expect(status(s)).toContain('BAJAS 12/60');
        expect(missionProgress(newGame(ARENAS.operaciones))).toBeNull();
        expect(status(newGame(ARENAS.operaciones))).toContain('PRÓXIMA OLEADA');
    });

    it('win the game when the last goal is met', () =>
    {
        const s = { ...start('limpieza'), kills: 59, built: { turrets: 2, welds: 0 }, wave: { ...start('limpieza').wave, restMs: 1e9 } };
        const e = { id: 77, kind: 'drone' as const, x: 8, y: 6, hp: 0, dirX: 0, dirY: 1, windMs: -1, coolMs: 0, moving: false, stuckMs: 0, hitMs: 0, burnMs: 0, clung: false };
        const r = step({ ...s, enemies: [e], nextId: 78 }, 50, NO_CONTROLS, rng);
        expect(r.events).toContain('won');
        expect(r.state.phase).toBe('won');
        // and then it stands still
        expect(step(r.state, 100, NO_CONTROLS, rng).state).toBe(r.state);
    });
});

describe('difficulty', () =>
{
    it('scales the waves and what comes out of the grilles', () =>
    {
        const size = (d: 'recluta' | 'pesadilla') =>
        {
            let s = start('aguanten', d);
            s = { ...s, wave: { ...s.wave, restMs: 1 } };
            const r = step(s, 50, NO_CONTROLS, rng).state;
            return r.wave.toSpawn;
        };
        expect(size('recluta')).toBeLessThan(size('pesadilla'));
        expect(DIFFICULTY.veterano.rules).toEqual({ hp: 1, count: 1, hurt: 1 });
        expect(DIFFICULTY_ORDER).toHaveLength(3);
    });

    it('is carried in a suspended game', () =>
    {
        const s = start('sellen', 'pesadilla');
        const back = restore(JSON.parse(JSON.stringify(snapshot(s))));
        expect(back.mission).toBe('sellen');
        expect(back.rules).toEqual(DIFFICULTY.pesadilla.rules);
    });
});

describe('what is remembered', () =>
{
    it('validates the won missions read from storage', () =>
    {
        expect(isCampaign({ aguanten: { difficulty: 'veterano', timeMs: 5 } })).toBe(true);
        expect(isCampaign({ aguanten: { difficulty: 'dios', timeMs: 5 } })).toBe(false);
        expect(isCampaign(null)).toBe(false);
    });
});

describe('the queen', () =>
{
    const nest = () => start('reina');

    it('comes out in the wave the mission names, once', () =>
    {
        let s = nest();
        s = { ...s, wave: { ...s.wave, n: 3, restMs: 1 } };
        const r = step(s, 50, NO_CONTROLS, rng);
        expect(r.events).toContain('queen');
        expect(r.state.queenOut).toBe(true);
        expect(r.state.enemies.filter(e => e.kind === 'queen')).toHaveLength(1);
        expect(missionProgress(r.state)).toBe('REINA 0/1');
        // not again in the next wave
        const again = step({ ...r.state, wave: { ...r.state.wave, n: 4, phase: 'rest', restMs: 1 }, enemies: [] }, 50, NO_CONTROLS, rng);
        expect(again.state.enemies.filter(e => e.kind === 'queen')).toHaveLength(0);
    });

    it('does not come before her wave, or in a game with no mission', () =>
    {
        const early = step({ ...nest(), wave: { ...nest().wave, n: 2, restMs: 1 } }, 50, NO_CONTROLS, rng);
        expect(early.events).not.toContain('queen');
        expect(missionProgress(nest())).toBe('REINA EN OLEADA 3');
        const free = newGame(ARENAS.nido);
        expect(step({ ...free, wave: { ...free.wave, n: 5, restMs: 1 } }, 50, NO_CONTROLS, rng).events).not.toContain('queen');
    });

    it('wins the mission when she falls', () =>
    {
        let s = nest();
        s = { ...s, wave: { ...s.wave, n: 3, restMs: 1 } };
        s = step(s, 50, NO_CONTROLS, rng).state;
        s = { ...s, enemies: s.enemies.map(e => ({ ...e, hp: 0 })) };
        const r = step(s, 50, NO_CONTROLS, rng);
        expect(r.state.killsBy.queen).toBe(1);
        expect(r.events).toContain('won');
        expect(r.state.phase).toBe('won');
    });
});
