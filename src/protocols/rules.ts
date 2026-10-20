import type { Phosphor } from '@/stores/useSettingsStore';

/** Weekdays as `Date.getDay()` gives them: 0 is Sunday. An empty list means every day. */
export type Days = number[];

export type Condition =
    /** Minutes of the day, `to` may be before `from` (the range wraps past midnight). */
    | { type: 'time'; from: number; to: number; days: Days }
    | { type: 'charging'; on: boolean }
    | { type: 'battery'; below: number }
    | { type: 'wifi'; on: boolean };

export type Effect =
    /** Index of the dashboard panel (0..3), shown once when the protocol starts. */
    | { type: 'panel'; index: number }
    | { type: 'phosphor'; phosphor: Phosphor }
    | { type: 'nightShift' }
    | { type: 'hideFolder'; folder: string }
    | { type: 'bigClock' };

export interface Rule
{
    id: string;
    name: string;
    enabled: boolean;
    when: Condition[];
    then: Effect[];
}

export interface RuleContext
{
    now: Date;
    /** null when the device can't tell */
    charging: boolean | null;
    battery: number | null;
    wifi: boolean | null;
}

/** What the rules that are active add on top of the user's own settings. */
export interface Overlay
{
    phosphor: Phosphor | null;
    nightShift: boolean;
    hiddenFolders: string[];
    bigClock: boolean;
    /** the panel to show when the protocol starts, null when none asks for one */
    panel: number | null;
}

export const EMPTY_OVERLAY: Overlay = { phosphor: null, nightShift: false, hiddenFolders: [], bigClock: false, panel: null };

const PHOSPHOR_IDS: Phosphor[] = ['amber', 'green', 'white', 'blue', 'red'];
const MINUTES_PER_DAY = 24 * 60;

export const WEEKDAYS = [
    { day: 1, label: 'L' }, { day: 2, label: 'M' }, { day: 3, label: 'X' }, { day: 4, label: 'J' },
    { day: 5, label: 'V' }, { day: 6, label: 'S' }, { day: 0, label: 'D' },
];

const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** True when the clock is inside [from, to). `from === to` covers the whole day. */
export function inTimeRange(now: Date, from: number, to: number, days: Days): boolean
{
    const m = minuteOfDay(now);
    if (from === to) return days.length === 0 || days.includes(now.getDay());
    if (from < to) return m >= from && m < to && (days.length === 0 || days.includes(now.getDay()));
    // past midnight: the evening part belongs to today, the morning part to the day that started the range
    if (m >= from) return days.length === 0 || days.includes(now.getDay());
    if (m < to) return days.length === 0 || days.includes((now.getDay() + 6) % 7);
    return false;
}

export function holds(c: Condition, ctx: RuleContext): boolean
{
    switch (c.type)
    {
        case 'time': return inTimeRange(ctx.now, c.from, c.to, c.days);
        case 'charging': return ctx.charging !== null && ctx.charging === c.on;
        case 'battery': return ctx.battery !== null && ctx.battery < c.below;
        case 'wifi': return ctx.wifi !== null && ctx.wifi === c.on;
    }
}

/** A rule with no conditions never runs: a protocol that is always on would just be a setting. */
export function isActive(rule: Rule, ctx: RuleContext): boolean
{
    return rule.enabled && rule.when.length > 0 && rule.when.every(c => holds(c, ctx));
}

/** Ids of the rules that are active now, in list order. */
export function evaluate(rules: readonly Rule[], ctx: RuleContext): string[]
{
    return rules.filter(r => isActive(r, ctx)).map(r => r.id);
}

/** The combined effect of the active rules; for phosphor and panel the last active rule in the list wins. */
export function overlay(rules: readonly Rule[], active: readonly string[]): Overlay
{
    const out: Overlay = { ...EMPTY_OVERLAY, hiddenFolders: [] };
    for (const rule of rules)
    {
        if (!active.includes(rule.id)) continue;
        for (const e of rule.then)
        {
            switch (e.type)
            {
                case 'phosphor': out.phosphor = e.phosphor; break;
                case 'nightShift': out.nightShift = true; break;
                case 'bigClock': out.bigClock = true; break;
                case 'panel': out.panel = e.index; break;
                case 'hideFolder': if (!out.hiddenFolders.includes(e.folder)) out.hiddenFolders.push(e.folder); break;
            }
        }
    }
    return out;
}

/** The ids that became active (`started`) or stopped (`ended`) between two evaluations. */
export function changes(before: readonly string[], after: readonly string[])
{
    return {
        started: after.filter(id => !before.includes(id)),
        ended: before.filter(id => !after.includes(id)),
    };
}

export const formatMinutes = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function formatDays(days: Days): string
{
    if (days.length === 0 || days.length === 7) return 'TODOS LOS DÍAS';
    const set = new Set(days);
    if (set.size === 5 && [1, 2, 3, 4, 5].every(d => set.has(d))) return 'L-V';
    if (set.size === 2 && set.has(0) && set.has(6)) return 'S-D';
    return WEEKDAYS.filter(w => set.has(w.day)).map(w => w.label).join('');
}

export function describeCondition(c: Condition): string
{
    switch (c.type)
    {
        case 'time': return `HORA ${formatMinutes(c.from)}-${formatMinutes(c.to)} · ${formatDays(c.days)}`;
        case 'charging': return c.on ? 'CARGANDO' : 'SIN CARGA';
        case 'battery': return `BATERÍA < ${c.below}%`;
        case 'wifi': return c.on ? 'CON WI-FI' : 'SIN WI-FI';
    }
}

const PHOSPHOR_LABEL: Record<Phosphor, string> = { amber: 'ÁMBAR', green: 'VERDE', white: 'BLANCO P4', blue: 'AZUL', red: 'ROJO' };

export function describeEffect(e: Effect): string
{
    switch (e.type)
    {
        case 'panel': return `PANEL P${e.index + 1}`;
        case 'phosphor': return `FÓSFORO ${PHOSPHOR_LABEL[e.phosphor]}`;
        case 'nightShift': return 'TURNO NOCTURNO';
        case 'hideFolder': return `OCULTA ${e.folder}`;
        case 'bigClock': return 'RELOJ GRANDE EN REPOSO';
    }
}

/** The starting points offered by `[+ PLANTILLA]`. Ids are made when one is added. */
export const TEMPLATES: Omit<Rule, 'id'>[] = [
    {
        name: 'ATRACADO',
        enabled: true,
        when: [{ type: 'charging', on: true }, { type: 'time', from: 22 * 60, to: 7 * 60, days: [] }],
        then: [{ type: 'phosphor', phosphor: 'red' }, { type: 'bigClock' }],
    },
    {
        name: 'EN TRÁNSITO',
        enabled: true,
        when: [{ type: 'wifi', on: false }, { type: 'charging', on: false }],
        then: [{ type: 'panel', index: 1 }],
    },
    {
        name: 'JORNADA',
        enabled: true,
        when: [{ type: 'time', from: 9 * 60, to: 18 * 60, days: [1, 2, 3, 4, 5] }],
        then: [{ type: 'hideFolder', folder: 'JUEGOS' }],
    },
];

export const MAX_RULES = 12;
const MAX_NAME = 20;

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function readCondition(raw: unknown): Condition | null
{
    if (typeof raw !== 'object' || raw === null) return null;
    const c = raw as Record<string, unknown>;
    switch (c.type)
    {
        case 'time':
            if (!isInt(c.from, 0, MINUTES_PER_DAY - 1) || !isInt(c.to, 0, MINUTES_PER_DAY - 1)) return null;
            return { type: 'time', from: c.from, to: c.to, days: Array.isArray(c.days) ? c.days.filter((d): d is number => isInt(d, 0, 6)) : [] };
        case 'charging': return { type: 'charging', on: c.on !== false };
        case 'battery': return isInt(c.below, 1, 100) ? { type: 'battery', below: c.below } : null;
        case 'wifi': return { type: 'wifi', on: c.on !== false };
        default: return null;
    }
}

function readEffect(raw: unknown): Effect | null
{
    if (typeof raw !== 'object' || raw === null) return null;
    const e = raw as Record<string, unknown>;
    switch (e.type)
    {
        case 'panel': return isInt(e.index, 0, 3) ? { type: 'panel', index: e.index } : null;
        case 'phosphor': return PHOSPHOR_IDS.includes(e.phosphor as Phosphor) ? { type: 'phosphor', phosphor: e.phosphor as Phosphor } : null;
        case 'nightShift': return { type: 'nightShift' };
        case 'hideFolder': return typeof e.folder === 'string' && e.folder.trim() ? { type: 'hideFolder', folder: e.folder.trim().toUpperCase().slice(0, 16) } : null;
        case 'bigClock': return { type: 'bigClock' };
        default: return null;
    }
}

/** Reads whatever was saved: unknown shapes are dropped, so a broken entry can never take the launcher down. */
export function normalizeRules(raw: unknown): Rule[]
{
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const rules: Rule[] = [];
    for (const r of raw)
    {
        if (typeof r !== 'object' || r === null) continue;
        const o = r as Record<string, unknown>;
        if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) continue;
        seen.add(o.id);
        rules.push({
            id: o.id,
            name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().toUpperCase().slice(0, MAX_NAME) : 'PROTOCOLO',
            enabled: o.enabled !== false,
            when: Array.isArray(o.when) ? o.when.map(readCondition).filter((c): c is Condition => c !== null) : [],
            then: Array.isArray(o.then) ? o.then.map(readEffect).filter((e): e is Effect => e !== null) : [],
        });
    }
    return rules.slice(0, MAX_RULES);
}

export const cleanRuleName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME).toUpperCase();
