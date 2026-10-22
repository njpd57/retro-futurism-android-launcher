import { describe, expect, it } from 'vitest';
import { attentionByKind, grownSize, liveKinds, NOTICE_MS, pickGrown } from '../attention';
import type { Lamp } from '../bridgeConsole';

const lamps = (over: Partial<Record<'MSG' | 'ALM', Partial<Lamp>>> = {}): Lamp[] => [
    { id: 'MSG', on: false, blink: false, ...over.MSG },
    { id: 'ALM', on: false, blink: false, ...over.ALM },
];

describe('attentionByKind', () =>
{
    it('is idle when nothing is lit', () =>
    {
        expect(attentionByKind(lamps(), { level: 80, isCharging: false })).toEqual({ radar: 'idle', alarm: 'idle', power: 'idle' });
    });

    it('follows the lamps and the battery', () =>
    {
        const a = attentionByKind(lamps({ MSG: { on: true }, ALM: { on: true, blink: true } }), { level: 15, isCharging: false });
        expect(a).toEqual({ radar: 'notice', alarm: 'urgent', power: 'notice' });
        expect(attentionByKind(lamps(), { level: 5, isCharging: false }).power).toBe('urgent');
    });

    it('a charging or unknown battery needs nothing', () =>
    {
        expect(attentionByKind(lamps(), { level: 5, isCharging: true }).power).toBe('idle');
        expect(attentionByKind(lamps(), null).power).toBe('idle');
    });
});

describe('grownSize', () =>
{
    it('takes the smallest larger size', () =>
    {
        expect(grownSize('s', ['s', 'w', 'l'])).toBe('w');
        expect(grownSize('w', ['w', 's', 'l'])).toBe('l');
        expect(grownSize('s', ['t', 'w'])).toBe('t');
    });

    it('stays when nothing larger exists', () =>
    {
        expect(grownSize('l', ['l', 'w'])).toBe('l');
        expect(grownSize('w', ['w', 's'])).toBe('w');
    });
});

describe('liveKinds', () =>
{
    it('lets a notice expire but not an urgent one', () =>
    {
        const att = { radar: 'notice', alarm: 'urgent', power: 'idle' } as const;
        const raised = { radar: 0, alarm: 0 };
        expect(liveKinds(att, raised, NOTICE_MS - 1)).toEqual({ radar: 'notice', alarm: 'urgent' });
        expect(liveKinds(att, raised, NOTICE_MS + 1)).toEqual({ alarm: 'urgent' });
    });
});

describe('pickGrown', () =>
{
    const item = (id: string, kind: string, size: 's' | 'w', sizes: readonly ('s' | 'w' | 'l')[] = ['s', 'w', 'l']) => ({ id, kind, size, sizes });

    it('grows only live windows that have room to grow, urgent first, up to the limit', () =>
    {
        const items = [item('a', 'radar', 's'), item('b', 'power', 's'), item('c', 'alarm', 's'), item('d', 'clock', 's')];
        const live = { radar: 'notice', power: 'notice', alarm: 'urgent' } as const;
        expect([...pickGrown(items, live)]).toEqual(['c', 'a']);
        expect([...pickGrown(items, live, 3)]).toEqual(['c', 'a', 'b']);
    });

    it('skips windows already at their largest size', () =>
    {
        expect(pickGrown([item('a', 'power', 'w', ['w'])], { power: 'urgent' }).size).toBe(0);
    });
});
