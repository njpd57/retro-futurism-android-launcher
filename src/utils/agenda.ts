import type { BridgeCalendarEvent } from '@/types/bridge-fork';
import { formatClock, formatDateTui } from './tui';

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD`. All-day events are midnight UTC, so they're read in UTC; the rest in local time. */
export function eventDayKey(e: BridgeCalendarEvent)
{
    const d = new Date(e.begin);
    return e.allDay
        ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function eventTimeLabel(e: BridgeCalendarEvent)
{
    return e.allDay ? 'TODO EL DÍA' : formatClock(new Date(e.begin));
}

export interface AgendaDay
{
    key: string;
    label: string;
    events: BridgeCalendarEvent[];
}

/** Events grouped by day (HOY / MAÑANA / date), days and events in time order. */
export function groupEventsByDay(events: readonly BridgeCalendarEvent[], now: Date): AgendaDay[]
{
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const days = new Map<string, AgendaDay>();
    for (const e of [...events].sort((a, b) => a.begin - b.begin))
    {
        const key = eventDayKey(e);
        if (!days.has(key))
        {
            const [y, m, d] = key.split('-').map(Number);
            const label = key === localKey(today) ? 'HOY' : key === localKey(tomorrow) ? 'MAÑANA' : formatDateTui(new Date(y, m - 1, d));
            days.set(key, { key, label, events: [] });
        }
        days.get(key)!.events.push(e);
    }
    return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}
