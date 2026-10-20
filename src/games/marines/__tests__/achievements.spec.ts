import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedBy, type RunContext } from '../achievements';
import { MISSIONS } from '../campaign';
import { buildReport, type Report } from '../report';
import { newGame } from '../game';
import { ARENAS } from '../map';

const base: Report = buildReport(newGame(ARENAS.operaciones));
const run = (over: Partial<Report>): Report => ({ ...base, ...over, built: { ...base.built, ...over.built }, killsBy: { ...base.killsBy, ...over.killsBy } });
const ctx = (over: Partial<RunContext> = {}): RunContext => ({ won: false, mission: null, difficulty: 'veterano', missionsWon: new Set(), ...over });

describe('achievements', () =>
{
    it('have unique ids and names', () =>
    {
        expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
        expect(new Set(ACHIEVEMENTS.map(a => a.name)).size).toBe(ACHIEVEMENTS.length);
    });

    it('are earned by what a run did', () =>
    {
        expect(earnedBy(run({}), ctx())).toEqual([]);
        expect(earnedBy(run({ kills: 1 }), ctx())).toEqual(['primera']);
        expect(earnedBy(run({ kills: 120, wave: 6 }), ctx())).toEqual(expect.arrayContaining(['primera', 'centenar', 'oleada5']));
        expect(earnedBy(run({ built: { turrets: 4, welds: 3 } }), ctx())).toEqual(expect.arrayContaining(['soldador', 'artillero']));
        expect(earnedBy(run({ killsBy: { drone: 0, runner: 0, hugger: 10, spitter: 5, queen: 0 } }), ctx())).toEqual(expect.arrayContaining(['exterminio', 'fumigador']));
    });

    it('want enough shots for precision to mean something', () =>
    {
        expect(earnedBy(run({ shots: 20, accuracy: 0.9 }), ctx())).not.toContain('punteria');
        expect(earnedBy(run({ shots: 200, accuracy: 0.65 }), ctx())).toContain('punteria');
    });

    it('count waves only in the endless mode, and missions only when won', () =>
    {
        expect(earnedBy(run({ wave: 11 }), ctx({ mission: 'aguanten' }))).not.toContain('oleada10');
        expect(earnedBy(run({ wave: 11 }), ctx())).toEqual(expect.arrayContaining(['oleada5', 'oleada10']));
        expect(earnedBy(run({}), ctx({ mission: 'aguanten' }))).not.toContain('mision');
        const won = earnedBy(run({ squadAlive: 2 }), ctx({ won: true, mission: 'aguanten', difficulty: 'pesadilla' }));
        expect(won).toEqual(expect.arrayContaining(['mision', 'intacta', 'pesadilla']));
        expect(won).not.toContain('campana');
    });

    it('end with the last mission of the campaign', () =>
    {
        const all = new Set(MISSIONS.map(m => m.id));
        expect(earnedBy(run({}), ctx({ won: true, mission: 'sellen', missionsWon: all }))).toContain('campana');
    });
});
