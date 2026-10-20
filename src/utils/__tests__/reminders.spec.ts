import { describe, expect, it } from 'vitest';
import { formatWhen, isDue, normalizeReminders, parseReminder, pendingReminders } from '../reminders';

const now = new Date(2026, 9, 19, 12, 0, 30); // Monday 12:00:30
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();

describe('parseReminder', () =>
{
    it('reads a time today', () =>
    {
        expect(parseReminder('18:30 comprar pan', now)).toEqual({ at: at(19, 18, 30), text: 'comprar pan' });
        expect(parseReminder('9:05 Llamar a Ash', now)).toEqual({ at: at(20, 9, 5), text: 'Llamar a Ash' });
    });

    it('moves a time that has passed to tomorrow', () =>
    {
        expect(parseReminder('12:00 ya pasó', now)?.at).toBe(at(20, 12));
        expect(parseReminder('11:59 ya pasó', now)?.at).toBe(at(20, 11, 59));
    });

    it('reads 18h and 18h30 and the spoken forms', () =>
    {
        expect(parseReminder('18h pan', now)?.at).toBe(at(19, 18));
        expect(parseReminder('18h30 pan', now)?.at).toBe(at(19, 18, 30));
        expect(parseReminder('a las 18:30 pan', now)).toEqual({ at: at(19, 18, 30), text: 'pan' });
    });

    it('reads relative times', () =>
    {
        const base = Math.floor(now.getTime() / 60_000) * 60_000;
        expect(parseReminder('en 20 min Sacar el pan', now)).toEqual({ at: base + 20 * 60_000, text: 'Sacar el pan' });
        expect(parseReminder('en 2 h llamar', now)?.at).toBe(base + 120 * 60_000);
        expect(parseReminder('en 1 hora y 30 min llamar', now)?.at).toBe(base + 90 * 60_000);
        expect(parseReminder('EN 5 MINUTOS TÉ', now)).toEqual({ at: base + 5 * 60_000, text: 'TÉ' });
    });

    it('reads tomorrow, with or without the tilde', () =>
    {
        expect(parseReminder('mañana 9:00 reunión', now)).toEqual({ at: at(20, 9), text: 'reunión' });
        expect(parseReminder('manana 9:00 reunion', now)).toEqual({ at: at(20, 9), text: 'reunion' });
        // tomorrow at a time that is earlier than now today is still tomorrow
        expect(parseReminder('mañana 7:00 correr', now)?.at).toBe(at(20, 7));
    });

    it('rejects what it cannot place', () =>
    {
        for (const bad of ['', '   ', '18:30', '25:00 x', '12:60 x', 'comprar pan', 'en 0 min x', 'en 20 min', 'mañana pan', 'en 99999 h x'])
            expect(parseReminder(bad, now), bad).toBeNull();
    });

    it('trims the text', () =>
    {
        expect(parseReminder('18:30    mucho    espacio   ', now)?.text).toBe('mucho espacio');
        expect(parseReminder(`18:30 ${'x'.repeat(200)}`, now)?.text).toHaveLength(80);
    });
});

describe('formatWhen', () =>
{
    it('says the time, tomorrow or the date', () =>
    {
        expect(formatWhen(at(19, 18, 30), now)).toBe('18:30');
        expect(formatWhen(at(20, 9), now)).toBe('MAÑ 09:00');
        expect(formatWhen(at(23, 9, 5), now)).toBe('23/10 09:05');
    });
});

describe('reminder lists', () =>
{
    const r = (id: string, when: number, done = false) => ({ id, at: when, text: id, done });

    it('knows what is due and orders what is pending', () =>
    {
        expect(isDue(r('a', 100), 100)).toBe(true);
        expect(isDue(r('a', 101), 100)).toBe(false);
        expect(isDue(r('a', 1, true), 100)).toBe(false);
        expect(pendingReminders([r('b', 20), r('a', 10), r('c', 5, true)]).map(x => x.id)).toEqual(['a', 'b']);
    });

    it('drops broken entries and old dismissed ones when reading', () =>
    {
        const day = 86_400_000;
        const out = normalizeReminders([r('old', 0, true), r('keep', 5 * day, true), r('pending', 0), { id: 1 }, null], 5 * day + 1000);
        expect(out.map(x => x.id)).toEqual(['keep', 'pending']);
        expect(normalizeReminders('x', 0)).toEqual([]);
    });
});
