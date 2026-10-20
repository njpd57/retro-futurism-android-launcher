export interface Reminder
{
    id: string;
    /** ms epoch */
    at: number;
    text: string;
    /** shown and dismissed, or cancelled */
    done: boolean;
}

export type ReminderDraft = Pick<Reminder, 'at' | 'text'>;

export const REMINDER_USAGE = 'RECORDAR <18:30 | EN 20 MIN | MAÑANA 9:00> <TEXTO>';
export const MAX_REMINDER_TEXT = 80;

/** `18:30`, `18h`, `18h30`, `9:05`: hours and minutes at the start of the text, with the length they took. */
function readClock(text: string): { hours: number; minutes: number; length: number } | null
{
    const m = /^(?:a\s+las\s+|para\s+las\s+|las\s+)?(\d{1,2})(?::(\d{2})|h(\d{2})?)(?=\s|$)/i.exec(text);
    if (!m) return null;
    const hours = Number(m[1]);
    const minutes = Number(m[2] ?? m[3] ?? 0);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes, length: m[0].length };
}

function atTime(base: Date, hours: number, minutes: number, dayOffset: number): number
{
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hours, minutes, 0, 0).getTime();
}

const clean = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, MAX_REMINDER_TEXT);

/**
 * Parses what is typed after `> recordar`: `18:30 comprar pan` (tomorrow when the time has passed),
 * `en 20 min llamar`, `en 2 h 30 min ...`, `mañana 9:00 reunión`. Null when the time or the text is missing.
 */
export function parseReminder(input: string, now: Date): ReminderDraft | null
{
    const text = input.trim();
    if (!text) return null;

    // the keywords have no accents, so the original text can be matched directly and keeps its case in the label
    const relative = /^en\s+(\d+)\s*(h|hora|horas|m|min|mins|minuto|minutos)\b(?:\s*y?\s*(\d+)\s*(m|min|mins|minutos?)\b)?\s*(.*)$/i.exec(text);
    if (relative)
    {
        const first = Number(relative[1]);
        const minutes = (relative[2].toLowerCase().startsWith('h') ? first * 60 : first) + (relative[3] ? Number(relative[3]) : 0);
        const label = clean(relative[5]);
        if (minutes < 1 || minutes > 7 * 24 * 60 || !label) return null;
        return { at: Math.floor(now.getTime() / 60_000) * 60_000 + minutes * 60_000, text: label };
    }

    let rest = text;
    let dayOffset = 0;
    const tomorrow = /^ma(?:ñ|n\u0303|n)ana\s+/i.exec(text);
    if (tomorrow)
    {
        rest = text.slice(tomorrow[0].length);
        dayOffset = 1;
    }

    const clock = readClock(rest);
    if (!clock) return null;
    const label = clean(rest.slice(clock.length));
    if (!label) return null;

    let at = atTime(now, clock.hours, clock.minutes, dayOffset);
    if (dayOffset === 0 && at <= now.getTime()) at = atTime(now, clock.hours, clock.minutes, 1);
    return { at, text: label };
}

/** `18:30` today, `MAÑ 09:00` tomorrow, `21/10 09:00` later. */
export function formatWhen(at: number, now: Date): string
{
    const d = new Date(at);
    const p = (n: number) => String(n).padStart(2, '0');
    const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfDay) / 86_400_000);
    if (days <= 0) return time;
    if (days === 1) return `MAÑ ${time}`;
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${time}`;
}

export const isDue = (r: Reminder, nowMs: number) => !r.done && r.at <= nowMs;

/** Pending reminders, soonest first. */
export const pendingReminders = (list: readonly Reminder[]) => list.filter(r => !r.done).sort((a, b) => a.at - b.at);

const DAY_MS = 86_400_000;

/** Reads what was saved and drops the dismissed ones older than a day. */
export function normalizeReminders(raw: unknown, nowMs: number): Reminder[]
{
    if (!Array.isArray(raw)) return [];
    const out: Reminder[] = [];
    for (const r of raw)
    {
        if (typeof r !== 'object' || r === null) continue;
        const o = r as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.at !== 'number' || !Number.isFinite(o.at) || typeof o.text !== 'string') continue;
        const done = o.done === true;
        if (done && nowMs - o.at > DAY_MS) continue;
        out.push({ id: o.id, at: o.at, text: o.text.slice(0, MAX_REMINDER_TEXT), done });
    }
    return out;
}
