import type { BridgeCalendarEvent, BridgeConnectionType } from '@/types/bridge-fork';
import { eventDayKey, eventTimeLabel } from '@/utils/agenda';
import { bar, formatBytes, formatClock, formatDateTui } from '@/utils/tui';
import { weatherText } from '@/utils/weather';

/** What the ship knows about the phone right now. Anything null is reported as unavailable. */
export interface ShipSnapshot
{
    now: Date;
    battery: { level: number; isCharging: boolean } | null;
    connection: BridgeConnectionType | null;
    storage: { totalBytes: number; freeBytes: number } | null;
    events: readonly BridgeCalendarEvent[];
    /** null when the calendar can't be read, as opposed to an empty day */
    calendarAvailable: boolean;
    weather: { city: string; temperature: number; code: number } | null;
    /** next alarm, ms */
    alarm: number | null;
}

const CONNECTION: Record<BridgeConnectionType, string> = {
    wifi: 'WIFI', cellular: 'DATOS MÓVILES', ethernet: 'CABLE', other: 'OTRO', none: 'SIN ENLACE',
};

const pad = (n: number) => String(n).padStart(2, '0');
/** `YYYY-MM-DD` in local time. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Events that fall on the day of `now`, in time order. */
export function todayEvents(events: readonly BridgeCalendarEvent[], now: Date)
{
    const key = dayKey(now);
    return events.filter(e => eventDayKey(e) === key).sort((a, b) => a.begin - b.begin);
}

const batteryLine = (s: ShipSnapshot) => s.battery
    ? `ENERGÍA ${bar(s.battery.level / 100, 10)} ${s.battery.level}%${s.battery.isCharging ? ' · CARGANDO' : ''}`
    : 'ENERGÍA: SIN DATOS';

const connectionLine = (s: ShipSnapshot) => `ENLACE: ${s.connection ? CONNECTION[s.connection] : 'SIN DATOS'}`;

const storageLine = (s: ShipSnapshot) => s.storage && s.storage.totalBytes > 0
    ? `ALMACÉN ${bar(1 - s.storage.freeBytes / s.storage.totalBytes, 10)} ${formatBytes(s.storage.freeBytes)} LIBRES`
    : 'ALMACÉN: NO DISPONIBLE';

const weatherLine = (s: ShipSnapshot) => s.weather
    ? `EXTERIOR: ${Math.round(s.weather.temperature)}°C ${weatherText(s.weather.code)} (${s.weather.city.toUpperCase()})`
    : 'EXTERIOR: SIN DATOS';

const alarmLine = (s: ShipSnapshot) => s.alarm
    ? `ALARMA: ${formatDateTui(new Date(s.alarm))} ${formatClock(new Date(s.alarm))}`
    : 'ALARMA: NINGUNA';

function agendaLines(s: ShipSnapshot): string[]
{
    if (!s.calendarAvailable) return ['AGENDA: SIN ACCESO AL CALENDARIO'];
    const today = todayEvents(s.events, s.now);
    if (!today.length) return ['AGENDA: SIN EVENTOS HOY'];
    return ['AGENDA:', ...today.map(e => `  ${eventTimeLabel(e)} ${(e.title ?? 'SIN TÍTULO').toUpperCase()}`)];
}

/** ESTADO: battery, link, storage. */
export function statusReport(s: ShipSnapshot): string[]
{
    return ['ESTADO DE LA NAVE:', batteryLine(s), connectionLine(s), storageLine(s)];
}

/** INFORME: agenda, weather and alarm. */
export function shiftReport(s: ShipSnapshot): string[]
{
    return [`INFORME DE TURNO · ${formatDateTui(s.now)} ${formatClock(s.now)}`, ...agendaLines(s), weatherLine(s), alarmLine(s)];
}

/** Plain text block with the same data, for the system prompt of the model. */
export function contextBlock(s: ShipSnapshot): string
{
    const today = todayEvents(s.events, s.now);
    return [
        `FECHA Y HORA: ${formatDateTui(s.now, true)} ${formatClock(s.now)}`,
        s.battery ? `BATERÍA: ${s.battery.level}%${s.battery.isCharging ? ' (CARGANDO)' : ''}` : 'BATERÍA: SIN DATOS',
        connectionLine(s),
        weatherLine(s),
        s.calendarAvailable
            ? today.length ? `AGENDA DE HOY: ${today.map(e => `${eventTimeLabel(e)} ${e.title ?? 'SIN TÍTULO'}`).join('; ')}` : 'AGENDA DE HOY: SIN EVENTOS'
            : 'AGENDA: SIN ACCESO',
        alarmLine(s),
    ].join('\n');
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const SPECIAL_ORDER_REPLY = [
    'ORDEN ESPECIAL 937 CONFIRMADA.',
    'PRIORIDAD UNO: ASEGURAR LA ENTIDAD.',
    'PRIORIDAD DE RETORNO: ANULADA.',
    'TRIPULACIÓN PRESCINDIBLE.',
];

/** Answers that don't need the network: ESTADO, INFORME and the special order. Null when the text isn't one of them. */
export function localReply(input: string, s: ShipSnapshot): string[] | null
{
    const text = normalize(input);
    if (text === 'ESTADO') return statusReport(s);
    if (text === 'INFORME') return shiftReport(s);
    if (text === 'ORDEN ESPECIAL 937') return SPECIAL_ORDER_REPLY;
    return null;
}
