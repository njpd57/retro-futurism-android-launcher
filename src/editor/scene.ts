import type { ShipData } from '@/ship3d/shipData';
import { buildLights, propOutline, propsOf, screenOf, shapeOf, type Light, type Portal, type Prop, type ScreenDef, type V2 } from '@/ship3d/world';

/** What the plan makes once expanded, with the link back to the entry of the data that made each piece. */
export interface Scene
{
    rooms: { id: string; zone: string; name: string; height: number; poly: V2[] }[];
    portals: Portal[];
    props: { entry: number; prop: Prop; outline: V2[] }[];
    screens: ScreenDef[];
    lights: Light[];
}

export function sceneOf(data: ShipData): Scene
{
    const rooms = data.rooms.map(r => ({ id: r.id, zone: r.zone, name: r.name, height: r.height, poly: shapeOf(r.shape) }));
    const portals = data.portals.map((p): Portal => ({ x: p.x, y: p.y, ...data.door }));
    const props = data.props.flatMap((e, entry) => propsOf(e, data).map(prop => ({ entry, prop, outline: propOutline(prop, 24) })));
    const screens = data.screens.map(s => screenOf(s, data));
    const lights = buildLights(rooms.map(r => ({ ...r, zone: r.zone as never })), props.map(p => p.prop), screens, data.lamps, data.extraLights);
    return { rooms, portals, props, screens, lights };
}
