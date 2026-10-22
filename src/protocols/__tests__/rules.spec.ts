import { describe, expect, it } from 'vitest';
import { changes, describeCondition, evaluate, formatDays, inTimeRange, normalizeRules, overlay, TEMPLATES, type Rule, type RuleContext } from '../rules';

// 2026-10-19 is a Monday
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({ now: at(19, 12), charging: false, battery: 80, wifi: true, ...over });
const rule = (over: Partial<Rule>): Rule => ({ id: 'r', name: 'R', enabled: true, when: [], then: [], ...over });

describe('inTimeRange', () =>
{
    it('covers a range inside the day', () =>
    {
        expect(inTimeRange(at(19, 9), 9 * 60, 18 * 60, [])).toBe(true);
        expect(inTimeRange(at(19, 17, 59), 9 * 60, 18 * 60, [])).toBe(true);
        expect(inTimeRange(at(19, 18), 9 * 60, 18 * 60, [])).toBe(false);
        expect(inTimeRange(at(19, 8, 59), 9 * 60, 18 * 60, [])).toBe(false);
    });

    it('wraps past midnight', () =>
    {
        expect(inTimeRange(at(19, 23), 22 * 60, 7 * 60, [])).toBe(true);
        expect(inTimeRange(at(20, 3), 22 * 60, 7 * 60, [])).toBe(true);
        expect(inTimeRange(at(20, 7), 22 * 60, 7 * 60, [])).toBe(false);
        expect(inTimeRange(at(19, 12), 22 * 60, 7 * 60, [])).toBe(false);
    });

    it('counts the morning part of a night range for the day that started it', () =>
    {
        // Mon-Fri nights: Saturday 03:00 still belongs to Friday night, Monday 03:00 to Sunday night (not included)
        const weekdays = [1, 2, 3, 4, 5];
        expect(inTimeRange(at(24, 3), 22 * 60, 7 * 60, weekdays)).toBe(true); // Saturday morning
        expect(inTimeRange(at(19, 3), 22 * 60, 7 * 60, weekdays)).toBe(false); // Monday morning
        expect(inTimeRange(at(24, 23), 22 * 60, 7 * 60, weekdays)).toBe(false); // Saturday evening
    });

    it('limits to the chosen days', () =>
    {
        expect(inTimeRange(at(19, 12), 9 * 60, 18 * 60, [1, 2, 3, 4, 5])).toBe(true);
        expect(inTimeRange(at(24, 12), 9 * 60, 18 * 60, [1, 2, 3, 4, 5])).toBe(false);
    });

    it('treats from === to as the whole day', () =>
    {
        expect(inTimeRange(at(19, 3), 0, 0, [])).toBe(true);
    });
});

describe('evaluate', () =>
{
    it('needs every condition', () =>
    {
        const r = rule({ when: [{ type: 'charging', on: true }, { type: 'battery', below: 50 }] });
        expect(evaluate([r], ctx({ charging: true, battery: 30 }))).toEqual(['r']);
        expect(evaluate([r], ctx({ charging: true, battery: 60 }))).toEqual([]);
        expect(evaluate([r], ctx({ charging: false, battery: 30 }))).toEqual([]);
    });

    it('never runs a rule with no conditions or a disabled one', () =>
    {
        expect(evaluate([rule({})], ctx())).toEqual([]);
        expect(evaluate([rule({ enabled: false, when: [{ type: 'wifi', on: true }] })], ctx())).toEqual([]);
    });

    it('does not guess what the device could not report', () =>
    {
        const unknown = ctx({ charging: null, battery: null, wifi: null });
        for (const c of [{ type: 'charging', on: false }, { type: 'battery', below: 100 }, { type: 'wifi', on: false }] as const)
            expect(evaluate([rule({ when: [c] })], unknown)).toEqual([]);
    });

    it('follows the Wi-Fi in both directions', () =>
    {
        const off = rule({ when: [{ type: 'wifi', on: false }] });
        expect(evaluate([off], ctx({ wifi: false }))).toEqual(['r']);
        expect(evaluate([off], ctx({ wifi: true }))).toEqual([]);
    });
});

describe('overlay', () =>
{
    const a = rule({ id: 'a', then: [{ type: 'phosphor', phosphor: 'red' }, { type: 'hideFolder', folder: 'JUEGOS' }, { type: 'bigClock' }] });
    const b = rule({ id: 'b', then: [{ type: 'phosphor', phosphor: 'green' }, { type: 'hideFolder', folder: 'JUEGOS' }, { type: 'hideFolder', folder: 'SOCIAL' }, { type: 'panel', index: 2 }, { type: 'nightShift' }] });

    it('is empty with nothing active', () =>
    {
        expect(overlay([a, b], [])).toEqual({ phosphor: null, nightShift: false, hiddenFolders: [], bigClock: false, panel: null });
    });

    it('joins the effects; for phosphor and panel the last active rule wins', () =>
    {
        const o = overlay([a, b], ['a', 'b']);
        expect(o.phosphor).toBe('green');
        expect(o.hiddenFolders).toEqual(['JUEGOS', 'SOCIAL']);
        expect(o.bigClock).toBe(true);
        expect(o.nightShift).toBe(true);
        expect(o.panel).toBe(2);
    });

    it('ignores the rules that are not active', () =>
    {
        expect(overlay([a, b], ['a']).phosphor).toBe('red');
        expect(overlay([a, b], ['a']).panel).toBeNull();
    });
});

describe('changes', () =>
{
    it('says what started and what ended', () =>
    {
        expect(changes(['a', 'b'], ['b', 'c'])).toEqual({ started: ['c'], ended: ['a'] });
        expect(changes([], [])).toEqual({ started: [], ended: [] });
    });
});

describe('normalizeRules', () =>
{
    it('keeps good rules and drops what is broken', () =>
    {
        const out = normalizeRules([
            { id: 'a', name: ' atracado ', enabled: false, when: [{ type: 'charging', on: true }, { type: 'nope' }, null], then: [{ type: 'phosphor', phosphor: 'pink' }, { type: 'bigClock' }] },
            { id: 'a', name: 'dup' },
            { name: 'no id' },
            'text',
        ]);
        expect(out).toEqual([{ id: 'a', name: 'ATRACADO', enabled: false, when: [{ type: 'charging', on: true }], then: [{ type: 'bigClock' }] }]);
    });

    it('reads anything else as no rules', () =>
    {
        expect(normalizeRules(null)).toEqual([]);
        expect(normalizeRules('x')).toEqual([]);
        expect(normalizeRules({})).toEqual([]);
    });

    it('clamps the numbers', () =>
    {
        const [r] = normalizeRules([{ id: 'a', when: [{ type: 'time', from: -5, to: 99999, days: [1] }, { type: 'battery', below: 0 }, { type: 'time', from: 60, to: 120, days: [1, 9, 'x'] }], then: [{ type: 'panel', index: 9 }] }]);
        expect(r.when).toEqual([{ type: 'time', from: 60, to: 120, days: [1] }]);
        expect(r.then).toEqual([]);
    });

    it('the templates survive a round trip', () =>
    {
        const rules = TEMPLATES.map((t, i) => ({ ...t, id: `t${i}` }));
        expect(normalizeRules(JSON.parse(JSON.stringify(rules)))).toEqual(rules);
    });
});

describe('descriptions', () =>
{
    it('writes days and conditions', () =>
    {
        expect(formatDays([])).toBe('TODOS LOS DÍAS');
        expect(formatDays([1, 2, 3, 4, 5])).toBe('L-V');
        expect(formatDays([6, 0])).toBe('S-D');
        expect(formatDays([1, 3])).toBe('LX');
        expect(describeCondition({ type: 'time', from: 22 * 60, to: 7 * 60 + 30, days: [] })).toBe('HORA 22:00-07:30 · TODOS LOS DÍAS');
    });
});
