import { shapeOf, type V2 } from './shapes';
import type { PropEntry, ShipData } from './shipData';

/**
 * The plan lives in `plan/`: `global.json` (the door, the start, the mess, the hangar, the lamps, the assets and the order
 * of the rooms) and one `plan/rooms/<room id>.json` per room with everything that stands in it: its portals, props,
 * monitors, panels, seats, signs. `mergePlan` makes the single `ShipData` the engine and the editor work with;
 * `splitPlan` is its inverse, putting each thing in the file of the room it stands in (the nearest one). Pure and free of
 * the browser, so the dev server's save can use it too. Adding a room is adding a file; nothing else lists it.
 */

/** A file of the plan: any part of `ShipData`, and in `global.json` the order the rooms come in. */
export type PlanPart = Partial<ShipData> & { roomOrder?: string[] };

const LISTS = ['rooms', 'portals', 'props', 'screens', 'terminals', 'panels', 'controls', 'stations', 'signalSlots', 'stencils', 'signs', 'extraLights'] as const;
const RECORDS = ['stands', 'vias'] as const;
const GLOBALS = ['door', 'start', 'mess', 'hangar', 'lamps', 'assets', 'floodlight'] as const;

type Item = Record<string, unknown>;

/** The plan as one: global first, then each room's file in `roomOrder` (rooms missing from it after, by id). */
export function mergePlan(global: PlanPart, rooms: Readonly<Record<string, PlanPart>>): ShipData
{
    const ids = Object.keys(rooms);
    const order = [...(global.roomOrder ?? []).filter(id => id in rooms), ...ids.filter(id => !(global.roomOrder ?? []).includes(id)).sort()];
    const out: Record<string, unknown> = {};
    for (const k of GLOBALS) if (global[k] !== undefined) out[k] = global[k];
    for (const k of LISTS) out[k] = [...((global[k] as unknown[] | undefined) ?? []), ...order.flatMap(id => (rooms[id][k] as unknown[] | undefined) ?? [])];
    for (const k of RECORDS) out[k] = Object.assign({}, global[k], ...order.map(id => rooms[id][k]));
    return out as unknown as ShipData;
}

const edgeDistance = (poly: readonly V2[], x: number, y: number) => Math.min(...poly.map((a, i) =>
{
    const b = poly[(i + 1) % poly.length];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}));

function containing(poly: readonly V2[], x: number, y: number)
{
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** The plan cut into its files: `global` and one part per room id. */
export function splitPlan(data: ShipData): { global: PlanPart; rooms: Record<string, PlanPart> }
{
    const polys = data.rooms.map(r => ({ id: r.id, zone: r.zone, poly: shapeOf(r.shape) }));
    const global: PlanPart = { roomOrder: data.rooms.map(r => r.id) };
    for (const k of GLOBALS) if (data[k] !== undefined) (global as Item)[k] = data[k];
    const rooms: Record<string, PlanPart> = Object.fromEntries(data.rooms.map(r => [r.id, {}]));
    const part = (id: string | undefined): PlanPart => (id !== undefined && rooms[id]) || global;

    /** the room whose outline is nearest `(x, y)`, the first of them on a tie */
    const nearest = (x: number, y: number) =>
    {
        let best: string | undefined;
        let bestD = Infinity;
        for (const r of polys)
        {
            const d = containing(r.poly, x, y) ? 0 : edgeDistance(r.poly, x, y);
            if (d < bestD - 1e-9) { best = r.id; bestD = d; }
        }
        return best;
    };
    const byZone = (zone: string) => polys.find(r => r.id === zone)?.id ?? polys.find(r => r.zone === zone)?.id;
    const put = (id: string | undefined, key: (typeof LISTS)[number], item: unknown) =>
    {
        const p = part(id) as Record<string, unknown[]>;
        (p[key] ??= []).push(item);
    };
    const at = (i: { x: number; y: number }) => nearest(i.x, i.y);
    const messRoom = data.mess?.room ?? 'comedor';

    for (const r of data.rooms) put(r.id, 'rooms', r);
    for (const p of data.portals) put(at(p), 'portals', p);
    for (const e of data.props as PropEntry[])
    {
        if ('gen' in e) put(e.gen === 'mess' ? messRoom : nearest(e.cx, e.cy), 'props', e);
        else put(at(e), 'props', e);
    }
    for (const s of data.screens)
        put(s.on === 'wall' ? at(s) : s.on === 'dome' ? byZone(s.room ?? s.zone) : messRoom, 'screens', s);
    for (const t of data.terminals ?? []) put(at(t), 'terminals', t);
    const panelRoom = new Map<string, string | undefined>();
    for (const p of data.panels ?? []) { const id = at(p); panelRoom.set(p.id, id); put(id, 'panels', p); }
    for (const c of data.controls ?? []) put(panelRoom.get(c.panel), 'controls', c);
    for (const s of data.stations ?? []) put(at(s), 'stations', s);
    for (const s of data.signalSlots) put(at(s), 'signalSlots', s);
    for (const s of data.stencils) put(s.room, 'stencils', s);
    for (const s of data.signs ?? []) put(at(s), 'signs', s);
    for (const l of data.extraLights) put(at(l), 'extraLights', l);
    for (const k of RECORDS)
        for (const [id, v] of Object.entries(data[k]))
            ((part(id) as Item)[k] ??= {} as Item) as Item, ((part(id) as Record<string, Item>)[k][id] = v as unknown as Item);
    return { global, rooms };
}
