import { compassPoint, normalizeDegrees } from '../utils/compass';
import { bar, formatBytes, formatClock, formatDateTui } from '../utils/tui';
import { weatherText } from '../utils/weather';
import { SCREENS } from './world';

/** How loudly a monitor asks for attention. */
export type Level = 'idle' | 'notice' | 'urgent';

/** What the ship's monitors show, flattened out of the stores so this stays pure. */
export interface ShipInput
{
    now: number;
    /** compass heading in degrees, null without a sensor */
    heading: number | null;
    weather: { temperature: number; code: number } | null;
    /** name of the active shift protocol deck, if one is running */
    protocol: string | null;
    /** notifications waiting, and how many apps they come from */
    signals: number;
    battery: { level: number; charging: boolean } | null;
    /** `wifi`, `cellular`... or null when offline / unknown */
    link: string | null;
    storage: { used: number; total: number } | null;
    screenMs: number | null;
    alarmAt: number | null;
    nextEvent: { title: string; begin: number } | null;
    media: { title: string; artist: string; playing: boolean } | null;
    /** starred contacts */
    crew: number;
    /** favourite apps */
    shuttles: number;
    alerts: number;
    /** the latest log lines, newest last */
    log: string[];
}

export interface ScreenReading { id: string; lines: string[]; level: Level }

/** Shorten to a wall monitor's width. */
export function fit(text: string, width = 14)
{
    const t = text.toUpperCase().trim();
    return t.length <= width ? t : `${t.slice(0, width - 1)}…`;
}

const idle = (id: string, ...lines: string[]): ScreenReading => ({ id, lines: lines.map(l => fit(l)), level: 'idle' });

function hhmm(ms: number)
{
    const total = Math.floor(ms / 60000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function roomReadings(i: ShipInput): Record<string, ScreenReading>
{
    const out: Record<string, ScreenReading> = {};
    const put = (r: ScreenReading) => { out[r.id] = r; };
    const date = new Date(i.now);

    put(idle('puente.hora', formatClock(date), formatDateTui(date)));
    put(idle('puente.rumbo', i.heading === null ? 'RUMBO ---' : `RUMBO ${String(Math.round(normalizeDegrees(i.heading)) % 360).padStart(3, '0')}`,
        i.heading === null ? 'SIN BRÚJULA' : compassPoint(i.heading)));
    put(i.weather
        ? idle('puente.clima', `${Math.round(i.weather.temperature)} °C`, weatherText(i.weather.code))
        : idle('puente.clima', 'EXTERIOR', 'SIN DATOS'));
    put(idle('puente.turno', 'TURNO', i.protocol ?? 'SIN PROTOCOLO'));

    put({
        id: 'comms.senales',
        lines: i.signals > 0 ? [`${i.signals} ${i.signals === 1 ? 'SEÑAL' : 'SEÑALES'}`, 'EN ESPERA'] : ['SIN SEÑALES', 'CANAL LIBRE'],
        level: i.signals > 0 ? 'notice' : 'idle',
    });
    put(idle('comms.mother', 'MOTHER', 'EN LÍNEA'));

    if (i.battery)
    {
        const { level, charging } = i.battery;
        put({
            id: 'motor.reserva',
            lines: [`RESERVA ${level} %`, bar(level / 100, 10)],
            level: charging ? 'idle' : level <= 15 ? 'urgent' : level <= 30 ? 'notice' : 'idle',
        });
    }
    else put(idle('motor.reserva', 'RESERVA', 'SIN DATOS'));
    put(idle('motor.enlace', i.link ? `ENLACE ${i.link}` : 'SIN ENLACE', i.link ? 'ESTABLE' : 'SOLO LOCAL'));

    if (i.storage && i.storage.total > 0)
    {
        const full = i.storage.used / i.storage.total;
        put({
            id: 'bodega.almacen',
            lines: ['ALMACÉN', bar(full, 10), `${formatBytes(i.storage.total - i.storage.used)} LIBRES`].map(l => fit(l)),
            level: full >= 0.95 ? 'urgent' : full >= 0.85 ? 'notice' : 'idle',
        });
    }
    else put(idle('bodega.almacen', 'ALMACÉN', 'SIN DATOS'));
    put(idle('bodega.pantalla', 'PANTALLA HOY', i.screenMs === null ? 'SIN DATOS' : hhmm(i.screenMs)));

    put({
        id: 'enfermeria.sistema',
        lines: i.alerts > 0 ? ['SISTEMA', `${i.alerts} ${i.alerts === 1 ? 'ALERTA' : 'ALERTAS'}`] : ['SISTEMA', 'NOMINAL'],
        level: i.alerts > 0 ? 'notice' : 'idle',
    });
    put(idle('enfermeria.bitacora', ...(i.log.length ? i.log.slice(-2) : ['BITÁCORA', 'VACÍA'])));

    if (i.alarmAt !== null)
    {
        const soon = i.alarmAt - i.now;
        put({
            id: 'hipersueno.alarma',
            lines: [`ALARMA ${formatClock(new Date(i.alarmAt))}`, soon > 0 ? `EN ${hhmm(soon)} H` : 'AHORA'],
            level: soon <= 15 * 60000 ? 'urgent' : soon <= 60 * 60000 ? 'notice' : 'idle',
        });
    }
    else put(idle('hipersueno.alarma', 'SIN ALARMA'));
    put(i.nextEvent
        ? idle('hipersueno.agenda', formatClock(new Date(i.nextEvent.begin)), i.nextEvent.title)
        : idle('hipersueno.agenda', 'AGENDA', 'SIN EVENTOS'));

    put(i.media
        ? idle('comedor.pista', i.media.playing ? '» SONANDO' : '▌▌ PAUSA', i.media.title, i.media.artist)
        : idle('comedor.pista', 'SIN SEÑAL', 'DE AUDIO'));
    put(idle('comedor.tripulacion', i.crew === 1 ? '1 TRIPULANTE' : `${i.crew} TRIPULANTES`));

    put(idle('hangar.flota', i.shuttles === 1 ? '1 LANZADERA' : `${i.shuttles} LANZADERAS`));

    // the hub's terminal: a tap searches the apps or talks to MOTHER
    put(idle('hub.buscar', 'TERMINAL', '> BUSCAR APP'));
    put(idle('hub.mother', 'MOTHER', '> CONSULTAR'));

    for (const s of SCREENS) out[s.id] ??= idle(s.id, 'SIN DATOS');
    return out;
}

/** The loudest level among a room's monitors. */
export function roomLevel(readings: Record<string, ScreenReading>, room: string): Level
{
    let level: Level = 'idle';
    for (const s of SCREENS)
    {
        if (s.zone !== room) continue;
        const l = readings[s.id]?.level;
        if (l === 'urgent') return 'urgent';
        if (l === 'notice') level = 'notice';
    }
    return level;
}
