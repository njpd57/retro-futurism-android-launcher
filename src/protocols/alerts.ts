import { formatClock } from '@/utils/tui';
import { isNight } from '@/utils/nightShift';
import { dayKey } from '@/utils/day';
import { isDue, type Reminder } from '@/utils/reminders';

export type AlertKind = 'event' | 'battery' | 'alarm' | 'reminder' | 'site';

export interface ShipAlert
{
    /** stable: the same cause gives the same id, so a dismissed alert stays dismissed */
    id: string;
    kind: AlertKind;
    text: string;
}

export interface AlertContext
{
    now: Date;
    events: { eventId: number; title: string | null; begin: number; allDay: boolean }[];
    battery: { level: number; isCharging: boolean } | null;
    /** ms epoch of the next alarm */
    nextAlarm: number | null;
    reminders: readonly Reminder[];
    /** sites that stopped answering; `host` is already a label, `since` a ms epoch */
    sitesDown: readonly { host: string; since: number }[];
}

/** Which kinds are switched on. Reminders are always on: the user asked for them. */
export interface AlertPrefs { event: boolean; battery: boolean; alarm: boolean; site: boolean }

export const EVENT_SOON_MIN = 10;
export const BATTERY_CRITICAL = 10;
export const ALARM_SOON_H = 6;

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;

/** `ALARMA EN 5H20`, `ALARMA EN 40 MIN` */
function untilText(ms: number): string
{
    const minutes = Math.max(1, Math.round(ms / MIN_MS));
    if (minutes < 60) return `${minutes} MIN`;
    return `${Math.floor(minutes / 60)}H${String(minutes % 60).padStart(2, '0')}`;
}

/** The alerts that apply now, most urgent first: reminders, events, battery, alarm, sites. Dismissed ones are left out. */
export function pendingAlerts(ctx: AlertContext, prefs: AlertPrefs, dismissed: ReadonlySet<string>): ShipAlert[]
{
    const now = ctx.now.getTime();
    const out: ShipAlert[] = [];

    for (const r of ctx.reminders)
        if (isDue(r, now)) out.push({ id: `reminder:${r.id}`, kind: 'reminder', text: `RECORDATORIO: ${r.text.toUpperCase()}` });

    if (prefs.event)
    {
        const soon = ctx.events
            .filter(e => !e.allDay && e.begin > now && e.begin - now <= EVENT_SOON_MIN * MIN_MS)
            .sort((a, b) => a.begin - b.begin);
        for (const e of soon)
            out.push({ id: `event:${e.eventId}:${e.begin}`, kind: 'event', text: `EVENTO EN ${untilText(e.begin - now)}: ${(e.title ?? 'SIN TÍTULO').toUpperCase()}` });
    }

    if (prefs.battery && ctx.battery && !ctx.battery.isCharging && ctx.battery.level <= BATTERY_CRITICAL)
        out.push({ id: `battery:${dayKey(ctx.now)}`, kind: 'battery', text: `BATERÍA CRÍTICA ${ctx.battery.level}% — CONECTA LA NAVE A LA RED` });

    if (prefs.alarm && ctx.nextAlarm !== null && isNight(ctx.now))
    {
        const left = ctx.nextAlarm - now;
        if (left > 0 && left <= ALARM_SOON_H * HOUR_MS)
            out.push({ id: `alarm:${ctx.nextAlarm}`, kind: 'alarm', text: `ALARMA EN ${untilText(left)} — RECOMIENDO REPOSO` });
    }

    if (prefs.site)
        for (const s of ctx.sitesDown)
            out.push({ id: `site:${s.host}:${s.since}`, kind: 'site', text: `SITIO CAÍDO: ${s.host} — DESDE ${formatClock(new Date(s.since))}` });

    // a reminder is dismissed by marking it done, so it is never filtered here
    return out.filter(a => a.kind === 'reminder' || !dismissed.has(a.id));
}
