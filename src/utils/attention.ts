// Living windows: a window whose subject needs a look grows one size for a while. Pure; the store gathers the state.

import { BATTERY_CRITICAL, BATTERY_LOW, type Lamp } from './bridgeConsole';
import { SIZE_CELLS, type WidgetSize } from './dashboardLayout';

export type Attention = 'idle' | 'notice' | 'urgent';

/** A plain notice stays grown this long; an urgent one until it is over. */
export const NOTICE_MS = 90_000;
/** At most this many windows are grown at once, or the panel would be rearranged under the finger. */
export const MAX_GROWN = 2;

/** The console lamp each widget kind follows. */
const FOLLOWS: Record<string, 'MSG' | 'ALM'> = { radar: 'MSG', alarm: 'ALM' };

/** What each live widget kind needs right now. Kinds that are not here never grow. */
export function attentionByKind(lamps: readonly Lamp[], battery: { level: number; isCharging: boolean } | null): Record<string, Attention>
{
    const out: Record<string, Attention> = {};
    for (const [kind, id] of Object.entries(FOLLOWS))
    {
        const lamp = lamps.find(l => l.id === id);
        out[kind] = !lamp?.on ? 'idle' : lamp.blink ? 'urgent' : 'notice';
    }
    out.power = !battery || battery.isCharging || battery.level >= BATTERY_LOW ? 'idle' : battery.level < BATTERY_CRITICAL ? 'urgent' : 'notice';
    return out;
}

const area = (s: WidgetSize) => SIZE_CELLS[s].cols * SIZE_CELLS[s].rows;

/** The smallest size the widget supports that is larger than `current`, or `current` when there is none. */
export function grownSize(current: WidgetSize, sizes: readonly WidgetSize[]): WidgetSize
{
    let best: WidgetSize | null = null;
    for (const s of sizes) if (area(s) > area(current) && (best === null || area(s) < area(best))) best = s;
    return best ?? current;
}

/** The kinds that are still worth showing grown: urgent ones always, notices only until `NOTICE_MS` after they rose. */
export function liveKinds(attention: Record<string, Attention>, raisedAt: Record<string, number>, now: number): Record<string, Attention>
{
    const out: Record<string, Attention> = {};
    for (const [kind, a] of Object.entries(attention))
    {
        if (a === 'idle') continue;
        if (a === 'notice' && now - (raisedAt[kind] ?? now) > NOTICE_MS) continue;
        out[kind] = a;
    }
    return out;
}

/** Which windows grow: urgent first, then the order of the panel, at most `max`; only those that have a larger size. */
export function pickGrown(items: readonly { id: string; kind: string; size: WidgetSize; sizes: readonly WidgetSize[] }[], live: Record<string, Attention>, max = MAX_GROWN): Set<string>
{
    const candidates = items
        .filter(i => live[i.kind] && grownSize(i.size, i.sizes) !== i.size)
        .sort((a, b) => Number(live[b.kind] === 'urgent') - Number(live[a.kind] === 'urgent'));
    return new Set(candidates.slice(0, max).map(i => i.id));
}
