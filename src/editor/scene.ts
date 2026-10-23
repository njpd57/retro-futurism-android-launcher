import type { ShipData } from '@/ship3d/shipData';
import { terminalOf } from '@/ship3d/terminalPlace';
import { buildLights, propOutline, propsOf, screenOf, shapeOf, type Light, type Portal, type Prop, type ScreenDef, type V2 } from '@/ship3d/world';

/** What the plan makes once expanded, with the link back to the entry of the data that made each piece. */
export interface Scene
{
    rooms: { id: string; zone: string; name: string; height: number; poly: V2[] }[];
    portals: Portal[];
    props: { entry: number; prop: Prop; outline: V2[] }[];
    screens: ScreenDef[];
    /** the glass of each entry of `data.terminals`, null when its variant is unknown */
    terminals: (ScreenDef | null)[];
    lights: Light[];
}

export function sceneOf(data: ShipData): Scene
{
    const rooms = data.rooms.map(r => ({ id: r.id, zone: r.zone, name: r.name, height: r.height, poly: shapeOf(r.shape), surface: { floor: -1, wall: -1, ceiling: -1 } }));
    const portals = data.portals.map((p): Portal => ({ x: p.x, y: p.y, ...data.door }));
    const props = data.props.flatMap((e, entry) => propsOf(e, data).map(prop => ({ entry, prop, outline: propOutline(prop, 24) })));
    const screens = data.screens.map(s => screenOf(s, data));
    const terminals = (data.terminals ?? []).map(terminalOf);
    const lit = [...screens, ...terminals.filter((s): s is ScreenDef => !!s)];
    const lights = buildLights(rooms.map(r => ({ ...r, zone: r.zone as never })), props.map(p => p.prop), lit, data.lamps, data.extraLights);
    return { rooms, portals, props, screens, terminals, lights };
}
