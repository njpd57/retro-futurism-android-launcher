// The bridge console: the status bar drawn as a ship's console (telemetry, annunciator lamps, MOTHER's teletype).
// Pure: the store gathers the state, the components paint it.

import { compassPoint } from './compass';
import { formatClock } from './tui';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

export const ALARM_SOON_MS = 8 * HOUR_MS;
export const ALARM_NEAR_MS = 10 * MIN_MS;
export const BATTERY_LOW = 20;
export const BATTERY_CRITICAL = 10;
/** Apps named one by one on the tape before the rest are summed up. */
export const MAX_SIGNALS = 3;

export type LampId = 'COM' | 'PWR' | 'MSG' | 'ALM' | 'PRT';
export const LAMP_IDS: readonly LampId[] = ['COM', 'PWR', 'MSG', 'ALM', 'PRT'];

export interface Lamp
{
    id: LampId;
    on: boolean;
    blink: boolean;
}

export interface ConsoleSignal
{
    packageName: string;
    category: string | null;
    isOngoing: boolean;
}

export interface ConsoleState
{
    now: number;
    /** null when unknown (no fork): the COM lamp stays off */
    online: boolean | null;
    battery: { level: number; isCharging: boolean } | null;
    signals: readonly ConsoleSignal[];
    alarmAt: number | null;
    /** names of the shift protocols that are active */
    protocols: readonly string[];
}

const live = (signals: readonly ConsoleSignal[]) => signals.filter(s => !s.isOngoing);
const urgent = (s: ConsoleSignal) => s.category === 'call' || s.category === 'alarm';

/** The annunciator panel: each lamp lit when something needs a look, blinking when it can't wait. */
export function annunciators(s: ConsoleState): Lamp[]
{
    const signals = live(s.signals);
    const toAlarm = s.alarmAt === null ? Infinity : s.alarmAt - s.now;
    const b = s.battery;
    return [
        { id: 'COM', on: s.online === false, blink: false },
        {
            id: 'PWR',
            on: !!b && (b.level < BATTERY_LOW || b.isCharging),
            blink: !!b && b.level < BATTERY_CRITICAL && !b.isCharging,
        },
        { id: 'MSG', on: signals.length > 0, blink: signals.some(urgent) },
        { id: 'ALM', on: toAlarm > 0 && toAlarm <= ALARM_SOON_MS, blink: toAlarm > 0 && toAlarm <= ALARM_NEAR_MS },
        { id: 'PRT', on: s.protocols.length > 0, blink: false },
    ];
}

/** Lamps that were off before and are lit now. */
export function newlyLit(prev: readonly Lamp[], next: readonly Lamp[]): LampId[]
{
    const wasOn = new Set(prev.filter(l => l.on).map(l => l.id));
    return next.filter(l => l.on && !wasOn.has(l.id)).map(l => l.id);
}

/** The lamps that fit in `room` characters (4 each): all if they fit, else the lit ones first, in panel order. */
export function fitLamps(lamps: readonly Lamp[], room: number): Lamp[]
{
    const max = Math.max(0, Math.floor((room + 1) / 4));
    if (lamps.length <= max) return [...lamps];
    const keep = new Set([...lamps.filter(l => l.on), ...lamps.filter(l => !l.on)].slice(0, max).map(l => l.id));
    return lamps.filter(l => keep.has(l.id));
}

export type TickerTarget =
    | { kind: 'notifications' }
    | { kind: 'alarms' }
    | { kind: 'mother' }
    | { kind: 'event'; id: number };

export interface TickerMessage
{
    id: string;
    text: string;
    target: TickerTarget;
    /** the lamp the message speaks for, if any */
    lamp?: LampId;
}

export interface TickerContext extends ConsoleState
{
    /** uppercase app name for a package */
    appLabel(packageName: string): string;
    nextEvent: { id: number; title: string | null; begin: number; allDay: boolean } | null;
    reminder: { at: number; text: string } | null;
    /** `14° NUBLADO`, already formatted */
    weather: string | null;
}

/** Routine lines MOTHER fills the tape with when nothing else is going on. */
export const AMBIENT_LINES: readonly string[] = [
    'SOPORTE VITAL NOMINAL',
    'CASCO ESTANCO',
    'RUMBO 090 · VELOCIDAD DE CRUCERO',
    'TRIPULACIÓN: 1',
    'RECICLADO DE AIRE OK',
    'PRESIÓN DE CABINA ESTABLE',
    'REACTOR EN RÉGIMEN',
    'SIN CONTACTOS EN EL SECTOR',
];

const hhmm = (t: number) => formatClock(new Date(t));

/**
 * What the teletype says, in order: the message of the lamp the user tapped, then those of blinking lamps,
 * then lit lamps, then the rest of the context, and one ambient line at the end (`ambient` picks which).
 * Notifications only name the app, never their title or text.
 */
export function tickerQueue(ctx: TickerContext, ambient: number, focus: LampId | null = null): TickerMessage[]
{
    const lamps = new Map(annunciators(ctx).map(l => [l.id, l]));
    const out: { msg: TickerMessage; rank: number }[] = [];
    const push = (msg: TickerMessage, base: number) =>
    {
        const lamp = msg.lamp ? lamps.get(msg.lamp) : undefined;
        const rank = msg.lamp && msg.lamp === focus ? 100 : lamp?.blink ? 80 : lamp?.on ? 60 : base;
        out.push({ msg, rank });
    };

    if (ctx.online === false)
        push({ id: 'com', text: 'ENLACE PERDIDO', target: { kind: 'mother' }, lamp: 'COM' }, 40);

    const apps = [...new Set(live(ctx.signals).map(s => s.packageName))];
    apps.slice(0, MAX_SIGNALS).forEach(pkg =>
        push({ id: `msg:${pkg}`, text: `SEÑAL DE ${ctx.appLabel(pkg)}`, target: { kind: 'notifications' }, lamp: 'MSG' }, 40));
    if (apps.length > MAX_SIGNALS)
    {
        const rest = apps.length - MAX_SIGNALS;
        push({ id: 'msg:rest', text: `${rest} ${rest === 1 ? 'SEÑAL' : 'SEÑALES'} MÁS`, target: { kind: 'notifications' }, lamp: 'MSG' }, 40);
    }

    if (ctx.alarmAt !== null && ctx.alarmAt > ctx.now)
        push({ id: 'alm', text: `ALARMA ${hhmm(ctx.alarmAt)}`, target: { kind: 'alarms' }, lamp: 'ALM' }, 40);

    ctx.protocols.forEach((name, i) =>
        push({ id: `prt:${i}`, text: `PROTOCOLO ${name.toUpperCase()} ACTIVO`, target: { kind: 'mother' }, lamp: 'PRT' }, 40));

    const ev = ctx.nextEvent;
    if (ev && ev.begin - ctx.now < DAY_MS)
    {
        const title = (ev.title ?? 'SIN TÍTULO').toUpperCase();
        const text = ev.allDay ? `HOY: ${title}` : `EVENTO ${hhmm(ev.begin)} ${title}`;
        push({ id: `ev:${ev.id}`, text, target: { kind: 'event', id: ev.id } }, 40);
    }

    if (ctx.reminder)
        push({ id: 'rem', text: `RECORDATORIO ${hhmm(ctx.reminder.at)} ${ctx.reminder.text.toUpperCase()}`, target: { kind: 'mother' } }, 40);

    if (ctx.weather)
        push({ id: 'wx', text: ctx.weather, target: { kind: 'mother' } }, 30);

    if (ctx.battery)
    {
        const text = `RESERVA ${ctx.battery.level} %${ctx.battery.isCharging ? ' · CARGANDO' : ''}`;
        push({ id: 'pwr', text, target: { kind: 'mother' }, lamp: 'PWR' }, 30);
    }

    const line = AMBIENT_LINES[((ambient % AMBIENT_LINES.length) + AMBIENT_LINES.length) % AMBIENT_LINES.length];
    push({ id: 'amb', text: line, target: { kind: 'mother' } }, 0);

    // stable sort: within a rank, messages keep the order above
    return out.map((o, i) => ({ ...o, i })).sort((a, b) => b.rank - a.rank || a.i - b.i).map(o => o.msg);
}

export const TAPE_SEPARATOR = ' · ';

export interface Tape
{
    text: string;
    spans: { from: number; to: number; target: TickerTarget }[];
}

/** The messages joined into one strip of tape, remembering where each one is. */
export function buildTape(messages: readonly TickerMessage[]): Tape
{
    let text = '';
    const spans: Tape['spans'] = [];
    for (const m of messages)
    {
        if (text) text += TAPE_SEPARATOR;
        spans.push({ from: text.length, to: text.length + m.text.length, target: m.target });
        text += m.text;
    }
    return { text, spans };
}

/** What the window of the teletype shows: one character per cell, each with the message it belongs to. */
export interface Strip
{
    text: string;
    targets: (TickerTarget | null)[];
}

export const emptyStrip = (width: number): Strip => ({ text: ' '.repeat(width), targets: Array(width).fill(null) });

/**
 * One step of the teletype: the strip moves one cell to the left and the next character of the tape (or of the
 * separator after it) comes in on the right. `done` says the tape and its separator have been printed, so the
 * caller can load a fresh tape for the next pass.
 */
export function advance(strip: Strip, width: number, tape: Tape, cursor: number): { strip: Strip; cursor: number; done: boolean }
{
    const full = tape.text + TAPE_SEPARATOR;
    const ch = full[cursor] ?? ' ';
    const span = tape.spans.find(s => cursor >= s.from && cursor < s.to);
    const text = (strip.text + ch).slice(-width).padStart(width, ' ');
    const targets = [...strip.targets, span?.target ?? null].slice(-width);
    while (targets.length < width) targets.unshift(null);
    const next = cursor + 1;
    return { strip: { text, targets }, cursor: next >= full.length ? 0 : next, done: next >= full.length };
}

/** What a tap on the strip at cell `index` opens: the message under it, else the nearest one on either side. */
export function targetUnder(strip: Strip, index: number): TickerTarget | null
{
    for (let d = 0; d < strip.targets.length; d++)
    {
        const hit = strip.targets[index - d] ?? strip.targets[index + d];
        if (hit) return hit;
    }
    return null;
}

export type RotorScreen = 'heading' | 'pulse' | 'weather' | 'storage';

/** What the left side of the console rotates through; a reading with nothing to say (no compass, no forecast) is skipped. */
export function rotorScreens(have: { heading: boolean; weather: boolean; storage: boolean }): RotorScreen[]
{
    const out: RotorScreen[] = [];
    if (have.heading) out.push('heading');
    out.push('pulse');
    if (have.weather) out.push('weather');
    if (have.storage) out.push('storage');
    return out;
}

/** `BODEGA 62 %`: how full the phone's storage is. */
export function storageText(totalBytes: number, freeBytes: number): string | null
{
    if (!(totalBytes > 0)) return null;
    const used = Math.min(1, Math.max(0, (totalBytes - freeBytes) / totalBytes));
    return `BODEGA ${Math.round(used * 100)} %`;
}

/** `RUMBO 090 E`: three digits and the point of the compass (`SO` and `O` for sur-oeste and oeste). */
export function headingText(deg: number): string
{
    const d = Math.round(((deg % 360) + 360) % 360) % 360;
    return `RUMBO ${String(d).padStart(3, '0')} ${compassPoint(d)}`;
}

export const CREW_BPM_MIN = 60;
export const CREW_BPM_REST = 72;
export const CREW_BPM_MAX = 100;

/** Simulated pulse of the crew member: a slow drift around 72, higher while a lamp is blinking. */
export function crewBpm(nowMs: number, stress: boolean): number
{
    const t = nowMs / 1000;
    const base = CREW_BPM_REST + 6 * Math.sin(t / 47) * Math.cos(t / 113 + 1);
    const bpm = Math.round(base + (stress ? 18 : 0));
    return Math.min(CREW_BPM_MAX, Math.max(CREW_BPM_MIN, bpm));
}

/** Columns left blank just ahead of the cursor of the monitor. */
export const SWEEP_GAP = 2;

/**
 * A cardiac monitor of `width` columns: a bright cursor `▓` moves from left to right one column per `stepMs`, writes
 * the pulse trace behind it (a spike `▃▅█` on every beat) and wipes what is ahead of it, then starts over.
 */
export function monitorSweep(nowMs: number, bpm: number, width: number, stepMs: number): string
{
    if (width <= 0) return '';
    const beatMs = 60_000 / Math.max(20, bpm);
    const tick = Math.floor(nowMs / stepMs);
    const pos = tick % width;
    let out = '';
    for (let c = 0; c < width; c++)
    {
        const age = (pos - c + width) % width;
        if (age === 0) { out += '▓'; continue; }
        if (age > width - 1 - SWEEP_GAP) { out += ' '; continue; }
        // the moment the cursor wrote this column
        const t = (tick - age) * stepMs;
        const phase = (((t % beatMs) + beatMs) % beatMs) / beatMs;
        out += phase < 0.08 ? '█' : phase < 0.16 ? '▅' : phase < 0.26 ? '▃' : '▁';
    }
    return out;
}
