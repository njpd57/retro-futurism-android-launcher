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

export const idle = (id: string, ...lines: string[]): ScreenReading => ({ id, lines: lines.map(l => fit(l)), level: 'idle' });

export function hhmm(ms: number)
{
    const total = Math.floor(ms / 60000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
