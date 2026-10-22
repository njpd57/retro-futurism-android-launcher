import { describe, expect, it } from 'vitest';
import { cleanSites, DEFAULT_SITES, FRESH_STATE, isAlive, MAX_SITES, nextState, siteLabel, sitesSummary } from '../sentinel';

describe('sentinel', () =>
{
    it('reads sign of life from the HTTP status', () =>
    {
        expect(isAlive(200)).toBe(true);
        expect(isAlive(404)).toBe(true);
        expect(isAlive(0)).toBe(true);
        expect(isAlive(502)).toBe(false);
        expect(isAlive(null)).toBe(false);
    });

    it('needs two failures in a row to go down, and recovers at once', () =>
    {
        let s = nextState(FRESH_STATE, true, 100);
        expect(s).toEqual({ status: 'up', fails: 0, since: 100 });
        s = nextState(s, false, 200);
        expect(s.status).toBe('up');
        s = nextState(s, false, 300);
        expect(s).toEqual({ status: 'down', fails: 2, since: 300 });
        s = nextState(s, false, 400);
        expect(s.since).toBe(300);
        s = nextState(s, true, 500);
        expect(s).toEqual({ status: 'up', fails: 0, since: 500 });
    });

    it('a lone failure is forgotten after a success', () =>
    {
        let s = nextState(nextState(FRESH_STATE, true, 1), false, 2);
        s = nextState(s, true, 3);
        expect(nextState(s, false, 4).status).toBe('up');
    });

    it('cleans a saved list', () =>
    {
        expect(cleanSites('x')).toEqual([]);
        expect(cleanSites(['quickware.cl', 'quickware.cl', 'no valido', 3])).toEqual(['https://quickware.cl/']);
        expect(cleanSites(Array.from({ length: 20 }, (_, i) => `s${i}.cl`))).toHaveLength(MAX_SITES);
        expect(cleanSites(DEFAULT_SITES)).toEqual(DEFAULT_SITES);
    });

    it('labels and counts', () =>
    {
        expect(siteLabel('https://www.academia.quickware.cl/')).toBe('ACADEMIA.QUICKWARE.CL');
        expect(siteLabel('https://quickware.cl/health')).toBe('QUICKWARE.CL/HEALTH');
        expect(sitesSummary([FRESH_STATE, { status: 'up', fails: 0, since: 1 }, { status: 'down', fails: 2, since: 1 }])).toEqual({ up: 1, down: 1, total: 3 });
    });
});
