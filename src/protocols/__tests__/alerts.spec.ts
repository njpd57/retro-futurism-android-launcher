import { describe, expect, it } from 'vitest';
import { pendingAlerts, type AlertContext } from '../alerts';

const MIN = 60_000;
const on = { event: true, battery: true, alarm: true };
const base = (over: Partial<AlertContext> = {}): AlertContext => ({ now: new Date(2026, 9, 19, 12, 0), events: [], battery: null, nextAlarm: null, reminders: [], ...over });
const none = new Set<string>();

describe('event alerts', () =>
{
    const now = new Date(2026, 9, 19, 12, 0);
    const ev = (eventId: number, minutes: number, extra = {}) => ({ eventId, title: 'Turno', begin: now.getTime() + minutes * MIN, allDay: false, ...extra });

    it('warns within ten minutes of the start', () =>
    {
        const out = pendingAlerts(base({ events: [ev(1, 10), ev(2, 11), ev(3, -1), ev(4, 4)] }), on, none);
        expect(out.map(a => a.id)).toEqual([`event:4:${now.getTime() + 4 * MIN}`, `event:1:${now.getTime() + 10 * MIN}`]);
        expect(out[0].text).toBe('EVENTO EN 4 MIN: TURNO');
    });

    it('leaves out all-day events and untitled ones get a name', () =>
    {
        expect(pendingAlerts(base({ events: [ev(1, 5, { allDay: true })] }), on, none)).toEqual([]);
        expect(pendingAlerts(base({ events: [ev(1, 5, { title: null })] }), on, none)[0].text).toBe('EVENTO EN 5 MIN: SIN TÍTULO');
    });

    it('respects the switch', () =>
    {
        expect(pendingAlerts(base({ events: [ev(1, 5)] }), { ...on, event: false }, none)).toEqual([]);
    });
});

describe('battery alerts', () =>
{
    it('warns at 10 % or less when not charging', () =>
    {
        expect(pendingAlerts(base({ battery: { level: 10, isCharging: false } }), on, none)[0].text).toBe('BATERÍA CRÍTICA 10% — CONECTA LA NAVE A LA RED');
        expect(pendingAlerts(base({ battery: { level: 11, isCharging: false } }), on, none)).toEqual([]);
        expect(pendingAlerts(base({ battery: { level: 5, isCharging: true } }), on, none)).toEqual([]);
    });

    it('is one alert per day, so dismissing it holds until tomorrow', () =>
    {
        const low = { level: 8, isCharging: false };
        const today = pendingAlerts(base({ battery: low }), on, none);
        expect(pendingAlerts(base({ battery: { level: 7, isCharging: false } }), on, new Set([today[0].id]))).toEqual([]);
        expect(pendingAlerts(base({ battery: low, now: new Date(2026, 9, 20, 12) }), on, new Set([today[0].id]))).toHaveLength(1);
    });
});

describe('alarm alerts', () =>
{
    const night = new Date(2026, 9, 19, 23, 30);
    it('suggests rest at night when the alarm is within six hours', () =>
    {
        const alarm = new Date(2026, 9, 20, 5, 0).getTime();
        const out = pendingAlerts(base({ now: night, nextAlarm: alarm }), on, none);
        expect(out[0].text).toBe('ALARMA EN 5H30 — RECOMIENDO REPOSO');
    });

    it('stays quiet by day, when the alarm is far away or already past', () =>
    {
        expect(pendingAlerts(base({ nextAlarm: new Date(2026, 9, 19, 14).getTime() }), on, none)).toEqual([]);
        expect(pendingAlerts(base({ now: night, nextAlarm: new Date(2026, 9, 20, 7).getTime() }), on, none)).toEqual([]);
        expect(pendingAlerts(base({ now: night, nextAlarm: night.getTime() - MIN }), on, none)).toEqual([]);
    });

    it('says minutes when it is close', () =>
    {
        expect(pendingAlerts(base({ now: night, nextAlarm: night.getTime() + 40 * MIN }), on, none)[0].text).toBe('ALARMA EN 40 MIN — RECOMIENDO REPOSO');
    });
});

describe('reminder alerts', () =>
{
    const now = new Date(2026, 9, 19, 12, 0);
    it('fire once due and until they are marked done', () =>
    {
        const reminders = [
            { id: 'a', at: now.getTime() - MIN, text: 'comprar pan', done: false },
            { id: 'b', at: now.getTime() + MIN, text: 'luego', done: false },
            { id: 'c', at: now.getTime() - MIN, text: 'hecho', done: true },
        ];
        const out = pendingAlerts(base({ reminders }), on, none);
        expect(out.map(a => a.text)).toEqual(['RECORDATORIO: COMPRAR PAN']);
    });

    it('come first and ignore the per-kind switches', () =>
    {
        const out = pendingAlerts(base({ reminders: [{ id: 'a', at: 0, text: 'x', done: false }], battery: { level: 3, isCharging: false } }), { event: false, battery: true, alarm: false }, none);
        expect(out.map(a => a.kind)).toEqual(['reminder', 'battery']);
    });
});
