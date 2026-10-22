import { describe, expect, it } from 'vitest';
import { SCREENS } from '../world';
import { fit, roomLevel, roomReadings, type ShipInput } from '../readings';

const base: ShipInput = {
    now: new Date(2026, 9, 21, 12, 0).getTime(), heading: 90, weather: { temperature: 18.4, code: 0 }, protocol: null,
    signals: 0, battery: { level: 74, charging: false }, link: 'WIFI', storage: { used: 50, total: 100 }, screenMs: 5400000,
    alarmAt: null, nextEvent: null, media: null, crew: 3, shuttles: 5, alerts: 0, log: [],
};

describe('roomReadings', () =>
{
    it('gives every monitor lines that fit the wall', () =>
    {
        const r = roomReadings({ ...base, media: { title: 'Una canción larguísima de verdad', artist: 'Alguien', playing: true } });
        for (const s of SCREENS)
        {
            expect(r[s.id], s.id).toBeDefined();
            expect(r[s.id].lines.length).toBeGreaterThan(0);
            r[s.id].lines.forEach(l => expect(l.length).toBeLessThanOrEqual(14));
        }
    });

    it('also copes with no data at all', () =>
    {
        const r = roomReadings({ ...base, heading: null, weather: null, battery: null, link: null, storage: null, screenMs: null });
        expect(r['puente.rumbo'].lines[0]).toBe('RUMBO ---');
        expect(r['motor.reserva'].lines).toEqual(['RESERVA', 'SIN DATOS']);
        expect(r['motor.enlace'].lines[0]).toBe('SIN ENLACE');
    });

    it('reads the heading and the battery', () =>
    {
        const r = roomReadings(base);
        expect(r['puente.rumbo'].lines).toEqual(['RUMBO 090', 'E']);
        expect(r['motor.reserva'].lines[0]).toBe('RESERVA 74 %');
        expect(r['motor.reserva'].level).toBe('idle');
    });

    it('raises levels: low battery, signals, alarm close by', () =>
    {
        expect(roomReadings({ ...base, battery: { level: 10, charging: false } })['motor.reserva'].level).toBe('urgent');
        expect(roomReadings({ ...base, battery: { level: 10, charging: true } })['motor.reserva'].level).toBe('idle');
        expect(roomReadings({ ...base, battery: { level: 25, charging: false } })['motor.reserva'].level).toBe('notice');
        const s = roomReadings({ ...base, signals: 2 });
        expect(s['comms.senales']).toMatchObject({ lines: ['2 SEÑALES', 'EN ESPERA'], level: 'notice' });
        expect(roomReadings({ ...base, alarmAt: base.now + 10 * 60000 })['hipersueno.alarma'].level).toBe('urgent');
        expect(roomReadings({ ...base, alarmAt: base.now + 8 * 3600000 })['hipersueno.alarma'].level).toBe('idle');
    });

    it('reports the loudest level of a room', () =>
    {
        const r = roomReadings({ ...base, battery: { level: 5, charging: false }, signals: 1 });
        expect(roomLevel(r, 'motor')).toBe('urgent');
        expect(roomLevel(r, 'comms')).toBe('notice');
        expect(roomLevel(r, 'puente')).toBe('idle');
    });
});

describe('fit', () =>
{
    it('uppercases and cuts with an ellipsis', () =>
    {
        expect(fit('hola')).toBe('HOLA');
        expect(fit('abcdefghijklmnopq')).toBe('ABCDEFGHIJKLM…');
    });
});
