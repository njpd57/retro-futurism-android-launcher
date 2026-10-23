import { round, shapeOf } from './shapes';
import { configureHangar, configureMess, propsOf } from './worldGen';
import { screenOf } from './screenPlace';
import type { Light, Portal, Prop, Room, ScreenDef, V2, Zone } from './worldTypes';

export * from './worldTypes';
export * from './worldGen';
export { SCREEN_OFFSET, screenOf } from './screenPlace';
import { bundledPlan } from './plan';
import { materialIndex } from './materials';
import type { AssetPlacement } from './assets';
import { isHall } from './zones';
import type { ControlData, HangarData, LampData, MessData, PanelData, PropData, PropEntry, ScreenData, ShapeData, ShipData, SignData, StationData } from './shipData';

/**
 * The ship as data: convex rooms (polygons extruded to a height), the doors between them, what stands in them, the
 * lamps and the monitors. Pure. Metres, `(x east, y south)`, the bow up (north, -y).
 */


/** Door size. Filled from `ship.json`; the door shader reads `height` once when it is built. */
const surfaceIndex = (id?: string) => (id ? materialIndex(id) : -1);

export const DOOR = { width: 3, height: 2.6 };

// ---- shapes: see `shapes.ts`

export { shapeOf, round };

// ---- the ship
//
// Everything below is filled by `applyWorld` from `ship.json` (the map editor edits that file). The arrays and records
// are emptied and refilled in place, so what other modules imported stays valid.

const rooms: Room[] = [];
const portals: Portal[] = [];
const props: Prop[] = [];
const consoles: Prop[] = [];
const screens: ScreenDef[] = [];
const lights: Light[] = [];

export const ROOMS: readonly Room[] = rooms;
export const PORTALS: readonly Portal[] = portals;
/** The consoles of the bridge; the mesh puts a slanted keyboard on each. */
/** The assets the plan places (`ship.json` -> `assets`), built in this order (see `assets.ts`). */
export const ASSET_PLACEMENTS: AssetPlacement[] = [];
export const BRIDGE_CONSOLES: readonly Prop[] = consoles;
export const PROPS: readonly Prop[] = props;
export const SCREENS: readonly ScreenDef[] = screens;
export const LIGHTS: readonly Light[] = lights;

/** Where the camera starts: on the bridge, looking up the dome at its monitors. */
/** Where the flashlight shines from and in which kind of room (`floodlight` in the plan); none without it. */
export const FLOODLIGHT: { light: Light; zone: Zone } | { light: null; zone: null } = { light: null, zone: null } as { light: Light; zone: Zone } | { light: null; zone: null };
export const START = { x: 0, y: -14.2, yaw: 0, pitch: 0 };

/** Where the camera ends up in each room the data lives in. */
export const STANDS: Record<string, V2> = {};
/** Points to route round what stands in the way of a straight leg inside a room. */
export const VIAS: Record<string, V2[]> = {};
/** Where the crew of the signals stand in COMMS, facing their desks. */
export const SIGNAL_SLOTS: { x: number; y: number; yaw: number }[] = [];
/** The rooms that have a stencil on their wall, and what it says. */
export const STENCILS: { room: string; text: string }[] = [];
export const SIGNS: SignData[] = [];
export const PANELS: PanelData[] = [];
export const CONTROLS: ControlData[] = [];
export const STATIONS: StationData[] = [];

const door = (x: number, y: number): Portal => ({ x, y, ...DOOR });

const listeners = new Set<() => void>();

/** Calls `fn` after every `applyWorld`, for what a module derived from the world at import (caches, slot tables). Returns the way to stop. */
export function onWorldChange(fn: () => void): () => void
{
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Replaces the whole ship with the plan in `data` and recomputes what derives from it, in place. */
export function applyWorld(data: ShipData): void
{
    Object.assign(DOOR, data.door);
    Object.assign(START, data.start);

    rooms.length = 0;
    for (const r of data.rooms) rooms.push({ id: r.id, zone: r.zone as Zone, name: r.name, poly: shapeOf(r.shape), height: r.height,
        surface: { floor: surfaceIndex(r.floor), wall: surfaceIndex(r.wall), ceiling: surfaceIndex(r.ceiling) } });
    ASSET_PLACEMENTS.length = 0;
    ASSET_PLACEMENTS.push(...(data.assets ?? []));
    portals.length = 0;
    for (const p of data.portals) portals.push(door(p.x, p.y));

    Object.assign(FLOODLIGHT, data.floodlight ? { light: { x: data.floodlight.x, y: data.floodlight.y, z: data.floodlight.z, power: data.floodlight.power }, zone: data.floodlight.zone } : { light: null, zone: null });
    configureMess(data.mess);
    configureHangar(data.hangar);

    props.length = 0;
    consoles.length = 0;
    for (const e of data.props)
    {
        const made = propsOf(e, data);
        props.push(...made);
        if (!('gen' in e) && !('prefab' in e) && e.keyboard) consoles.push(...made);
    }

    screens.length = 0;
    for (const s of data.screens) screens.push(screenOf(s, data));

    for (const k of Object.keys(STANDS)) delete STANDS[k];
    Object.assign(STANDS, data.stands);
    for (const k of Object.keys(VIAS)) delete VIAS[k];
    Object.assign(VIAS, data.vias);
    SIGNAL_SLOTS.length = 0;
    SIGNAL_SLOTS.push(...data.signalSlots);
    STENCILS.length = 0;
    STENCILS.push(...data.stencils);
    SIGNS.length = 0;
    SIGNS.push(...(data.signs ?? []));
    PANELS.length = 0;
    PANELS.push(...(data.panels ?? []));
    CONTROLS.length = 0;
    CONTROLS.push(...(data.controls ?? []).filter(c => PANELS.some(p => p.id === c.panel)));
    STATIONS.length = 0;
    STATIONS.push(...(data.stations ?? []));

    lights.length = 0;
    lampCfg = { ...data.lamps };
    lights.push(...buildLights(rooms, props, screens, lampCfg, data.extraLights));
    for (const fn of listeners) fn();
}

export const roomById = (id: string): Room | undefined => ROOMS.find(r => r.id === id);

export const screenById = (id: string): ScreenDef | undefined => SCREENS.find(s => s.id === id);

export const stationById = (id: string): StationData | undefined => STATIONS.find(s => s.id === id);

/** The unit direction a screen faces, in the plan. */
export const screenNormal = (s: ScreenDef): V2 => [Math.sin(s.yaw), -Math.cos(s.yaw)];

// ---- geometry of the rooms

export function centroid(poly: readonly V2[]): V2
{
    let x = 0;
    let y = 0;
    for (const p of poly) { x += p[0]; y += p[1]; }
    return [x / poly.length, y / poly.length];
}

/** Whether the point is inside a convex polygon (any winding), at least `margin` metres from every side. */
export function inside(poly: readonly V2[], x: number, y: number, margin = 0): boolean
{
    let area = 0;
    for (let i = 0; i < poly.length; i++)
    {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        area += ax * by - bx * ay;
    }
    const orient = Math.sign(area) || 1;
    for (let i = 0; i < poly.length; i++)
    {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        const side = (((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay)) * orient;
        if (side < margin - 1e-9) return false;
    }
    return true;
}

/** The room whose floor holds the point, or undefined (inside a wall, or outside the ship). */
export const roomAt = (x: number, y: number): Room | undefined => ROOMS.find(r => inside(r.poly, x, y));

/** One side of a room's outline cut at its doorways: the stretches that are wall and the doorways. */
export interface EdgeSplit
{
    /** edge start, unit direction along it, and its length */
    ax: number; ay: number; dx: number; dy: number; length: number;
    /** inward unit normal */
    nx: number; ny: number;
    /** `[from, to]` in metres along the edge */
    walls: [number, number][];
    doors: { portal: Portal; from: number; to: number }[];
}

export function splitEdge(room: Room, i: number, portals: readonly Portal[] = PORTALS): EdgeSplit
{
    const [ax, ay] = room.poly[i];
    const [bx, by] = room.poly[(i + 1) % room.poly.length];
    const length = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / length;
    const dy = (by - ay) / length;
    // the normal that points toward the room's middle
    const [cx, cy] = centroid(room.poly);
    let nx = -dy;
    let ny = dx;
    if ((cx - ax) * nx + (cy - ay) * ny < 0) { nx = -nx; ny = -ny; }

    const doors: EdgeSplit['doors'] = [];
    for (const p of portals)
    {
        const vx = p.x - ax;
        const vy = p.y - ay;
        const along = vx * dx + vy * dy;
        const off = Math.abs(vx * dy - vy * dx);
        if (off < 0.05 && along - p.width / 2 >= -0.05 && along + p.width / 2 <= length + 0.05)
            doors.push({ portal: p, from: Math.max(0, along - p.width / 2), to: Math.min(length, along + p.width / 2) });
    }
    doors.sort((p, q) => p.from - q.from);

    const walls: [number, number][] = [];
    let at = 0;
    for (const d of doors)
    {
        if (d.from - at > 0.01) walls.push([at, d.from]);
        at = d.to;
    }
    if (length - at > 0.01) walls.push([at, length]);
    return { ax, ay, dx, dy, length, nx, ny, walls, doors };
}

/** The direction a doorway runs along (the wall's direction) and the normal across it, for the door leaf. */
export function portalAxis(portal: Portal): { dx: number; dy: number; nx: number; ny: number }
{
    for (const r of ROOMS)
        for (let i = 0; i < r.poly.length; i++)
        {
            const e = splitEdge(r, i);
            if (e.doors.some(d => d.portal === portal)) return { dx: e.dx, dy: e.dy, nx: e.nx, ny: e.ny };
        }
    return { dx: 1, dy: 0, nx: 0, ny: 1 };
}

// ---- collision

export interface Seg { ax: number; ay: number; bx: number; by: number }

/** The outline of a solid prop, as segments. */
export function propOutline(p: Prop, n = 10): V2[]
{
    if (p.kind === 'cyl')
    {
        return Array.from({ length: n }, (_, k): V2 =>
        {
            const a = (k * Math.PI * 2) / n + p.yaw;
            return [p.x + (p.w / 2) * Math.cos(a), p.y + (p.w / 2) * Math.sin(a)];
        });
    }
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    return ([[-p.w / 2, -p.d / 2], [p.w / 2, -p.d / 2], [p.w / 2, p.d / 2], [-p.w / 2, p.d / 2]] as V2[])
        .map(([u, v]): V2 => [p.x + u * c - v * s, p.y + u * s + v * c]);
}

/** Every wall (cut at the doorways) and solid prop of the ship, as segments to walk into. */
export function collisionSegments(rooms: readonly Room[] = ROOMS, props: readonly Prop[] = PROPS): Seg[]
{
    const out: Seg[] = [];
    for (const room of rooms)
        for (let i = 0; i < room.poly.length; i++)
        {
            const e = splitEdge(room, i);
            for (const [from, to] of e.walls)
                out.push({ ax: e.ax + e.dx * from, ay: e.ay + e.dy * from, bx: e.ax + e.dx * to, by: e.ay + e.dy * to });
        }
    for (const p of props)
    {
        if (!p.solid) continue;
        const o = propOutline(p);
        for (let i = 0; i < o.length; i++)
            out.push({ ax: o[i][0], ay: o[i][1], bx: o[(i + 1) % o.length][0], by: o[(i + 1) % o.length][1] });
    }
    return out;
}

// ---- lights

let lampCfg: LampData = { step: 7, corridorStep: 6, power: 2.2 };

/** Ceiling lamps on a grid inside each room, plus whatever shines by itself and the lights placed by hand. */
export function buildLights(rooms: readonly Room[] = ROOMS, props: readonly Prop[] = PROPS, screens: readonly ScreenDef[] = SCREENS, lamps: LampData = lampCfg, extra: readonly Light[] = []): Light[]
{
    const lights: Light[] = [];
    for (const room of rooms)
    {
        const xs = room.poly.map(p => p[0]);
        const ys = room.poly.map(p => p[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        const step = isHall(room.zone) ? lamps.corridorStep : lamps.step;
        const nx = Math.max(1, Math.round((x1 - x0) / step));
        const ny = Math.max(1, Math.round((y1 - y0) / step));
        for (let i = 0; i < nx; i++)
            for (let j = 0; j < ny; j++)
            {
                const x = round(x0 + ((i + 0.5) * (x1 - x0)) / nx);
                const y = round(y0 + ((j + 0.5) * (y1 - y0)) / ny);
                if (inside(room.poly, x, y)) lights.push({ x, y, z: room.height - 0.3, power: lamps.power });
            }
    }
    for (const p of props)
        if (p.glow > 0) lights.push({ x: p.x, y: p.y, z: p.z0 + p.h / 2, power: p.glow * 1.6 });
    for (const s of screens)
    {
        const [nx, ny] = screenNormal(s);
        lights.push({ x: round(s.x + nx * 0.5), y: round(s.y + ny * 0.5), z: s.z, power: 0.3 });
    }
    for (const l of extra) lights.push({ ...l });
    return lights;
}

/** The plan's bounds, for the minimap. */
export function bounds(rooms: readonly Room[] = ROOMS): { x0: number; y0: number; x1: number; y1: number }
{
    const xs = rooms.flatMap(r => r.poly.map(p => p[0]));
    const ys = rooms.flatMap(r => r.poly.map(p => p[1]));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

applyWorld(bundledPlan);
