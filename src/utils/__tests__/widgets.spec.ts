import { describe, expect, it } from 'vitest';
import type { BridgeCalendarEvent, BridgeMediaSession } from '@/types/bridge-fork';
import { eventDayKey, eventTimeLabel, groupEventsByDay } from '../agenda';
import { formatMediaTime, mediaPosition } from '../media';
import { isTaskLine, toggleTaskLine } from '../notes';
import { forecastUrl, isStale, parseForecast, weatherText } from '../weather';

const ev = (eventId: number, begin: number, extra: Partial<BridgeCalendarEvent> = {}): BridgeCalendarEvent =>
    ({ eventId, title: `e${eventId}`, location: null, begin, end: begin + 3600_000, allDay: false, color: '#fff', calendarName: 'c', ...extra });

describe('notes', () =>
{
    it('recognises tasks and toggles them', () =>
    {
        expect(isTaskLine('[ ] a')).toBe(true);
        expect(isTaskLine('[x]a')).toBe(true);
        expect(isTaskLine('hola')).toBe(false);
        expect(toggleTaskLine('x\n[ ] a\n[x] b', 1)).toBe('x\n[x] a\n[x] b');
        expect(toggleTaskLine('x\n[ ] a\n[x] b', 2)).toBe('x\n[ ] a\n[ ] b');
    });

    it('leaves non-task lines and bad indexes alone', () =>
    {
        expect(toggleTaskLine('hola', 0)).toBe('hola');
        expect(toggleTaskLine('[ ] a', 5)).toBe('[ ] a');
    });
});

describe('agenda', () =>
{
    it('reads all-day events in UTC and the rest in local time', () =>
    {
        expect(eventDayKey(ev(1, Date.UTC(2026, 9, 19), { allDay: true }))).toBe('2026-10-19');
        expect(eventDayKey(ev(2, new Date(2026, 9, 19, 23, 30).getTime()))).toBe('2026-10-19');
    });

    it('labels all-day events', () =>
    {
        expect(eventTimeLabel(ev(1, 0, { allDay: true }))).toBe('TODO EL DÍA');
        expect(eventTimeLabel(ev(2, new Date(2026, 9, 19, 9, 5).getTime()))).toBe('09:05');
    });

    it('groups by day with HOY and MAÑANA, in order', () =>
    {
        const now = new Date(2026, 9, 18, 12);
        const days = groupEventsByDay([
            ev(3, new Date(2026, 9, 20, 9).getTime()),
            ev(2, new Date(2026, 9, 19, 9).getTime()),
            ev(1, new Date(2026, 9, 18, 15).getTime()),
            ev(4, new Date(2026, 9, 18, 8).getTime()),
        ], now);
        expect(days.map(d => d.label)).toEqual(['HOY', 'MAÑANA', '20-OCT-26']);
        expect(days[0].events.map(e => e.eventId)).toEqual([4, 1]);
    });
});

describe('media', () =>
{
    const session = (extra: Partial<BridgeMediaSession>): BridgeMediaSession => ({
        packageName: 'p', title: 't', artist: null, album: null, state: 'playing', durationMs: 100_000, positionMs: 10_000,
        positionUpdatedAt: 1000, playbackSpeed: 1, hasArt: false, artVersion: 0, canSkipToNext: true, canSkipToPrevious: true, ...extra,
    });

    it('extrapolates while playing, clamped to the duration', () =>
    {
        expect(mediaPosition(session({}), 6000)).toBe(15_000);
        expect(mediaPosition(session({ playbackSpeed: 2 }), 6000)).toBe(20_000);
        expect(mediaPosition(session({}), 10_000_000)).toBe(100_000);
    });

    it('does not move when paused', () =>
    {
        expect(mediaPosition(session({ state: 'paused' }), 99_999)).toBe(10_000);
    });

    it('formats m:ss', () =>
    {
        expect(formatMediaTime(65_000)).toBe('1:05');
        expect(formatMediaTime(-5)).toBe('0:00');
    });
});

describe('weather', () =>
{
    it('knows when the cache is stale', () =>
    {
        expect(isStale(null, 1000)).toBe(true);
        expect(isStale(1000, 1000 + 29 * 60_000)).toBe(false);
        expect(isStale(1000, 1000 + 31 * 60_000)).toBe(true);
    });

    it('parses an Open-Meteo response and rejects others', () =>
    {
        const f = parseForecast({ current: { temperature_2m: 18.4, weather_code: 3 }, hourly: { temperature_2m: [18, 19, 20] } }, 5);
        expect(f).toEqual({ temperature: 18.4, code: 3, hourly: [18, 19, 20], fetchedAt: 5 });
        expect(parseForecast({ error: true }, 5)).toBeNull();
        expect(parseForecast(null, 5)).toBeNull();
    });

    it('maps codes to text and builds the url', () =>
    {
        expect(weatherText(0)).toBe('DESPEJADO');
        expect(weatherText(63)).toBe('LLUVIA');
        expect(weatherText(96)).toBe('TORMENTA');
        expect(forecastUrl(1.5, -2)).toContain('latitude=1.5&longitude=-2');
    });
});
