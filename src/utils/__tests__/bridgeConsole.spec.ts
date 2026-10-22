import { describe, expect, it } from 'vitest';
import {
    advance, AMBIENT_LINES, crewBpm, CREW_BPM_MAX, CREW_BPM_MIN, headingText, monitorSweep, rotorScreens, storageText, SWEEP_GAP, annunciators, buildTape, emptyStrip, fitLamps, newlyLit, targetUnder, tickerQueue,
    type ConsoleState, type Lamp, type TickerContext,
} from '../bridgeConsole';

const NOW = new Date(2026, 9, 21, 15, 0).getTime();
const MIN = 60_000;

const state = (extra: Partial<ConsoleState> = {}): ConsoleState => ({
    now: NOW, online: true, battery: { level: 74, isCharging: false }, signals: [], alarmAt: null, protocols: [], ...extra,
});

const ctx = (extra: Partial<TickerContext> = {}): TickerContext => ({
    ...state(), appLabel: p => p.split('.').pop()!.toUpperCase(), nextEvent: null, reminder: null, weather: null, ...extra,
});

const lamp = (lamps: Lamp[], id: string) => lamps.find(l => l.id === id)!;

describe('annunciators', () =>
{
    it('keeps every lamp dark when all is well', () =>
    {
        expect(annunciators(state()).every(l => !l.on && !l.blink)).toBe(true);
    });

    it('lights COM only when the link is known to be down', () =>
    {
        expect(lamp(annunciators(state({ online: false })), 'COM').on).toBe(true);
        expect(lamp(annunciators(state({ online: null })), 'COM').on).toBe(false);
    });

    it('lights PWR when low or charging and blinks it when critical', () =>
    {
        expect(lamp(annunciators(state({ battery: { level: 15, isCharging: false } })), 'PWR')).toMatchObject({ on: true, blink: false });
        expect(lamp(annunciators(state({ battery: { level: 80, isCharging: true } })), 'PWR')).toMatchObject({ on: true, blink: false });
        expect(lamp(annunciators(state({ battery: { level: 5, isCharging: false } })), 'PWR')).toMatchObject({ on: true, blink: true });
        expect(lamp(annunciators(state({ battery: { level: 5, isCharging: true } })), 'PWR').blink).toBe(false);
    });

    it('lights MSG for live signals and blinks it for calls', () =>
    {
        const msg = (category: string | null, isOngoing = false) => lamp(annunciators(state({ signals: [{ packageName: 'a', category, isOngoing }] })), 'MSG');
        expect(msg('progress', true).on).toBe(false);
        expect(msg('msg')).toMatchObject({ on: true, blink: false });
        expect(msg('call')).toMatchObject({ on: true, blink: true });
    });

    it('lights ALM within 8 h and blinks it within 10 min', () =>
    {
        expect(lamp(annunciators(state({ alarmAt: NOW + 9 * 60 * MIN })), 'ALM').on).toBe(false);
        expect(lamp(annunciators(state({ alarmAt: NOW + 60 * MIN })), 'ALM')).toMatchObject({ on: true, blink: false });
        expect(lamp(annunciators(state({ alarmAt: NOW + 5 * MIN })), 'ALM')).toMatchObject({ on: true, blink: true });
        expect(lamp(annunciators(state({ alarmAt: NOW - MIN })), 'ALM').on).toBe(false);
    });

    it('lights PRT while a protocol is active', () =>
    {
        expect(lamp(annunciators(state({ protocols: ['NOCHE'] })), 'PRT').on).toBe(true);
    });
});

describe('newlyLit', () =>
{
    it('reports only lamps that went from off to on', () =>
    {
        const before = annunciators(state({ protocols: ['NOCHE'] }));
        const after = annunciators(state({ protocols: ['NOCHE'], online: false }));
        expect(newlyLit(before, after)).toEqual(['COM']);
        expect(newlyLit(after, before)).toEqual([]);
    });
});

describe('fitLamps', () =>
{
    const lamps = annunciators(state({ online: false, protocols: ['X'] }));

    it('shows all when there is room', () =>
    {
        expect(fitLamps(lamps, 19).map(l => l.id)).toEqual(['COM', 'PWR', 'MSG', 'ALM', 'PRT']);
    });

    it('drops dark lamps first and keeps the panel order', () =>
    {
        expect(fitLamps(lamps, 11).map(l => l.id)).toEqual(['COM', 'PWR', 'PRT']);
        expect(fitLamps(lamps, 7).map(l => l.id)).toEqual(['COM', 'PRT']);
        expect(fitLamps(lamps, 2)).toEqual([]);
    });
});

describe('tickerQueue', () =>
{
    it('names the app of a signal, never its content, and sums up the rest', () =>
    {
        const signals = ['com.whatsapp', 'com.gmail', 'com.telegram', 'com.slack', 'com.whatsapp']
            .map(packageName => ({ packageName, category: 'msg', isOngoing: false }));
        const texts = tickerQueue(ctx({ signals }), 0).map(m => m.text);
        expect(texts.slice(0, 4)).toEqual(['SEÑAL DE WHATSAPP', 'SEÑAL DE GMAIL', 'SEÑAL DE TELEGRAM', '1 SEÑAL MÁS']);
    });

    it('always carries the battery and ends with one ambient line', () =>
    {
        const q = tickerQueue(ctx(), 2);
        expect(q.map(m => m.text)).toEqual(['RESERVA 74 %', AMBIENT_LINES[2]]);
        expect(tickerQueue(ctx(), AMBIENT_LINES.length).at(-1)?.text).toBe(AMBIENT_LINES[0]);
    });

    it('puts blinking lamps first and the tapped lamp before everything', () =>
    {
        const c = ctx({
            alarmAt: NOW + 5 * MIN,
            weather: '14° NUBLADO',
            nextEvent: { id: 7, title: 'Dentista', begin: NOW + 60 * MIN, allDay: false },
        });
        expect(tickerQueue(c, 0)[0].text).toBe('ALARMA 15:05');
        expect(tickerQueue(c, 0, 'PWR')[0].text).toBe('RESERVA 74 %');
        expect(tickerQueue(c, 0).find(m => m.id === 'ev:7')).toMatchObject({ text: 'EVENTO 16:00 DENTISTA', target: { kind: 'event', id: 7 } });
    });

    it('leaves out events more than a day away', () =>
    {
        const c = ctx({ nextEvent: { id: 1, title: 'X', begin: NOW + 2 * 86_400_000, allDay: false } });
        expect(tickerQueue(c, 0).some(m => m.id === 'ev:1')).toBe(false);
    });
});

describe('tape', () =>
{
    const tape = buildTape([
        { id: 'a', text: 'ABC', target: { kind: 'notifications' } },
        { id: 'b', text: 'XY', target: { kind: 'alarms' } },
    ]);

    it('joins the messages with a separator and keeps their spans', () =>
    {
        expect(tape.text).toBe('ABC · XY');
        expect(tape.spans.map(s => [s.from, s.to])).toEqual([[0, 3], [6, 8]]);
    });

    it('prints one character per step, entering on the right, and reports the end of the pass', () =>
    {
        let strip = emptyStrip(4);
        let cursor = 0;
        const frames: string[] = [];
        let done = false;
        for (let i = 0; i < 11 && !done; i++)
        {
            const r = advance(strip, 4, tape, cursor);
            strip = r.strip; cursor = r.cursor; done = r.done;
            frames.push(strip.text);
        }
        expect(frames.slice(0, 4)).toEqual(['   A', '  AB', ' ABC', 'ABC ']);
        expect(frames.at(-1)).toBe('Y · ');
        expect(done).toBe(true);
        expect(cursor).toBe(0);
    });

    it('opens the message under the tap, else the nearest one', () =>
    {
        let strip = emptyStrip(6);
        let cursor = 0;
        for (let i = 0; i < 8; i++) ({ strip, cursor } = advance(strip, 6, tape, cursor));
        // strip is now 'C · XY'
        expect(strip.text).toBe('C · XY');
        expect(targetUnder(strip, 0)).toEqual({ kind: 'notifications' });
        expect(targetUnder(strip, 5)).toEqual({ kind: 'alarms' });
        expect(targetUnder(strip, 2)).toEqual({ kind: 'notifications' });
        expect(targetUnder(emptyStrip(6), 3)).toBeNull();
    });
});

describe('rotor', () =>
{
    it('skips the readings that have nothing to say', () =>
    {
        expect(rotorScreens({ heading: true, weather: true, storage: true })).toEqual(['heading', 'pulse', 'weather', 'storage']);
        expect(rotorScreens({ heading: false, weather: false, storage: false })).toEqual(['pulse']);
        expect(rotorScreens({ heading: false, weather: true, storage: false })).toEqual(['pulse', 'weather']);
    });

    it('says how full the storage is', () =>
    {
        expect(storageText(128e9, 32e9)).toBe('BODEGA 75 %');
        expect(storageText(0, 0)).toBeNull();
    });

    it('writes the heading with three digits and its point', () =>
    {
        expect(headingText(90)).toBe('RUMBO 090 E');
        expect(headingText(5)).toBe('RUMBO 005 N');
        expect(headingText(359.6)).toBe('RUMBO 000 N');
        expect(headingText(-90)).toBe('RUMBO 270 O');
        expect(headingText(225)).toBe('RUMBO 225 SO');
    });

    it('keeps the simulated pulse in range and raises it under stress', () =>
    {
        for (let t = 0; t < 3_600_000; t += 37_000)
        {
            const calm = crewBpm(t, false);
            const tense = crewBpm(t, true);
            expect(calm).toBeGreaterThanOrEqual(CREW_BPM_MIN);
            expect(tense).toBeLessThanOrEqual(CREW_BPM_MAX);
            expect(tense).toBeGreaterThan(calm);
        }
    });
});

describe('monitorSweep', () =>
{
    const STEP = 100;
    const W = 8;

    it('draws the cursor at the sweep position and blanks the columns just ahead of it', () =>
    {
        for (let tick = 0; tick < 3 * W; tick++)
        {
            const s = monitorSweep(tick * STEP, 72, W, STEP);
            const pos = tick % W;
            expect(s).toHaveLength(W);
            expect(s[pos]).toBe('▓');
            for (let k = 1; k <= SWEEP_GAP; k++) expect(s[(pos + k) % W]).toBe(' ');
        }
    });

    it('leaves what the cursor wrote where it was while it moves on', () =>
    {
        const a = monitorSweep(3 * STEP, 72, W, STEP);
        const b = monitorSweep(4 * STEP, 72, W, STEP);
        // the column written two steps ago keeps its glyph, one column further from the cursor's start
        expect(b[2]).toBe(a[2]);
        expect(b[1]).toBe(a[1]);
    });

    it('shows a spike when a beat falls under the cursor', () =>
    {
        // 600 bpm: a beat every 100 ms = every step
        const s = monitorSweep(5 * STEP, 600, W, STEP);
        expect(s.replace(/[ ▓]/g, '').split('').every(c => c === '█')).toBe(true);
    });

    it('is empty without room', () =>
    {
        expect(monitorSweep(0, 72, 0, STEP)).toBe('');
    });
});
