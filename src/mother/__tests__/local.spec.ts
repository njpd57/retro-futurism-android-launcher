import { describe, expect, it } from 'vitest';
import { contextBlock, localReply, shiftReport, statusReport, todayEvents, type ShipSnapshot } from '../local';
import type { BridgeCalendarEvent } from '@/types/bridge-fork';

const ev = (title: string, begin: Date): BridgeCalendarEvent => ({ eventId: 1, title, location: null, begin: begin.getTime(), end: begin.getTime() + 3600_000, allDay: false, color: '#000000' } as BridgeCalendarEvent);

const now = new Date(2026, 9, 19, 9, 30);
const base: ShipSnapshot = {
    now,
    battery: { level: 80, isCharging: true },
    connection: 'wifi',
    storage: { totalBytes: 100 * 1024 ** 3, freeBytes: 25 * 1024 ** 3 },
    events: [ev('Dentista', new Date(2026, 9, 19, 16, 0)), ev('Mañana', new Date(2026, 9, 20, 8, 0)), ev('Café', new Date(2026, 9, 19, 10, 0))],
    calendarAvailable: true,
    weather: { city: 'Madrid', temperature: 18.4, code: 0 },
    alarm: new Date(2026, 9, 20, 7, 0).getTime(),
};

describe('reports', () =>
{
    it('lists only today in time order', () =>
    {
        expect(todayEvents(base.events, now).map(e => e.title)).toEqual(['Café', 'Dentista']);
    });

    it('status shows battery, link and storage', () =>
    {
        const text = statusReport(base).join('\n');
        expect(text).toContain('80%');
        expect(text).toContain('CARGANDO');
        expect(text).toContain('WIFI');
        expect(text).toContain('25.0 GB LIBRES');
    });

    it('status degrades without data', () =>
    {
        const text = statusReport({ ...base, battery: null, connection: null, storage: null }).join('\n');
        expect(text).toContain('ENERGÍA: SIN DATOS');
        expect(text).toContain('ENLACE: SIN DATOS');
        expect(text).toContain('ALMACÉN: NO DISPONIBLE');
    });

    it('shift report has agenda, weather and alarm', () =>
    {
        const text = shiftReport(base).join('\n');
        expect(text).toContain('CAFÉ');
        expect(text).toContain('18°C DESPEJADO');
        expect(text).toContain('ALARMA:');
        expect(text).not.toContain('MAÑANA');
    });

    it('tells apart no access from an empty day', () =>
    {
        expect(shiftReport({ ...base, calendarAvailable: false }).join('\n')).toContain('SIN ACCESO AL CALENDARIO');
        expect(shiftReport({ ...base, events: [] }).join('\n')).toContain('SIN EVENTOS HOY');
    });
});

describe('localReply', () =>
{
    it('recognizes the local orders ignoring case, accents and punctuation', () =>
    {
        expect(localReply('estado', base)).toEqual(statusReport(base));
        expect(localReply(' Informe. ', base)).toEqual(shiftReport(base));
        expect(localReply('orden especial 937', base)?.[0]).toBe('ORDEN ESPECIAL 937 CONFIRMADA.');
        expect(localReply('¡Orden Especial 937!', base)).not.toBeNull();
    });

    it('leaves everything else to the model', () =>
    {
        expect(localReply('cuál es el estado del tiempo', base)).toBeNull();
        expect(localReply('hola', base)).toBeNull();
    });
});

describe('contextBlock', () =>
{
    it('contains the data the model needs', () =>
    {
        const text = contextBlock(base);
        expect(text).toContain('09:30');
        expect(text).toContain('BATERÍA: 80% (CARGANDO)');
        expect(text).toContain('10:00 Café');
        expect(text).toContain('Madrid'.toUpperCase());
    });
});
