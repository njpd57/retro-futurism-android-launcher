import { yawOf } from './math';
import type { Prefab } from './prefabData';
import shipJson from './ship.json';
import { materialIndex } from './materials';
import { prefabById } from './prefabs';
import type { HangarData, LampData, MessData, PropData, PropEntry, ScreenData, ShapeData, ShipData, SignData } from './shipData';

/**
 * The ship as data: convex rooms (polygons extruded to a height), the doors between them, what stands in them, the
 * lamps and the monitors. Pure. Metres, `(x east, y south)`, the bow up (north, -y).
 */

export type V2 = [number, number];

/** The nine rooms the data lives in (the mess in the middle), plus the corridors between them. */
export type RoomId = 'puente' | 'comms' | 'motor' | 'bodega' | 'enfermeria' | 'hipersueno' | 'comedor' | 'camarotes' | 'hangar';
export type Zone = RoomId | 'pasillo';

export interface Room
{
    id: string;
    zone: Zone;
    name: string;
    /** convex outline */
    poly: V2[];
    height: number;
    /** material index (`materials.json`) of each surface, or -1 for the kind's own */
    surface: { floor: number; wall: number; ceiling: number };
}

/** A doorway on the line where two rooms meet. */
export interface Portal { x: number; y: number; width: number; height: number }

export type PropKind = 'box' | 'cyl';

export interface Prop
{
    kind: PropKind;
    x: number;
    y: number;
    /** box: across; cylinder: diameter */
    w: number;
    /** box: deep (cylinders ignore it) */
    d: number;
    h: number;
    /** rotation of a box, plan yaw */
    yaw: number;
    /** height of its base above the floor */
    z0: number;
    /** 0..1 how much it shines by itself */
    glow: number;
    solid: boolean;
    /** a cylinder's sides in the mesh (16 when left out); its first corner is at `yaw` */
    sides?: number;
    /** index into `MATERIALS`; the kind's own when left out */
    material?: number;
}

export interface Light { x: number; y: number; z: number; power: number }

/** A monitor hung on a wall, facing `yaw` (the way its picture looks, into the room). */
export interface ScreenDef
{
    id: string;
    /** the room whose card it opens; the ship's terminal (`hub`, over the mess table) opens the search and MOTHER instead */
    zone: RoomId | 'hub';
    x: number;
    y: number;
    /** height of its centre above the floor */
    z: number;
    w: number;
    h: number;
    yaw: number;
    /** hangs in the room (the crown over the mess table) instead of on a wall */
    hung?: boolean;
}

/** Door size. Filled from `ship.json`; the door shader reads `height` once when it is built. */
const surfaceIndex = (id?: string) => (id ? materialIndex(id) : -1);

export const DOOR = { width: 3, height: 2.6 };
/** how far a monitor stands off its wall */
export const SCREEN_OFFSET = 0.04;

// ---- shapes

const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A rectangle with its corners cut. */
const chamfer = (x0: number, y0: number, x1: number, y1: number, c: number): V2[] => [
    [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
];

/** A regular polygon of `n` sides (a multiple of four) with flat sides facing the four directions, `a` from the centre to each flat. */
const ngon = (cx: number, cy: number, a: number, n: number): V2[] =>
{
    const r = a / Math.cos(Math.PI / n);
    return Array.from({ length: n }, (_, k): V2 =>
    {
        const t = ((k + 0.5) * Math.PI * 2) / n;
        return [round(cx + r * Math.cos(t)), round(cy + r * Math.sin(t))];
    });
};

/** The bridge: a flat edge to the south and a half-ellipse dome to the north. */
const dome = (cx: number, baseY: number, rx: number, ry: number, steps: number): V2[] =>
    Array.from({ length: steps + 1 }, (_, k): V2 =>
    {
        const a = (k * Math.PI) / steps;
        return [round(cx + rx * Math.cos(a)), round(baseY - ry * Math.sin(a))];
    });

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** The outline a room's shape makes. */
export function shapeOf(s: ShapeData): V2[]
{
    if ('rect' in s) return rect(...s.rect);
    if ('chamfer' in s) return chamfer(...s.chamfer);
    if ('ngon' in s) return ngon(...s.ngon);
    if ('dome' in s) return dome(...s.dome);
    return s.poly.map((p): V2 => [p[0], p[1]]);
}

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
export const BRIDGE_CONSOLES: readonly Prop[] = consoles;
export const PROPS: readonly Prop[] = props;
export const SCREENS: readonly ScreenDef[] = screens;
export const LIGHTS: readonly Light[] = lights;

/** Where the camera starts: on the bridge, looking up the dome at its monitors. */
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

const door = (x: number, y: number): Portal => ({ x, y, ...DOOR });

const box = (x: number, y: number, w: number, d: number, h: number, extra: Partial<Prop> = {}): Prop =>
    ({ kind: 'box', x, y, w, d, h, yaw: 0, z0: 0, glow: 0, solid: true, ...extra });

const cyl = (x: number, y: number, diameter: number, h: number, extra: Partial<Prop> = {}): Prop =>
    ({ kind: 'cyl', x, y, w: diameter, d: diameter, h, yaw: 0, z0: 0, glow: 0, solid: true, ...extra });

const propOf = (p: PropData): Prop =>
{
    const material = p.material ? materialIndex(p.material) : -1;
    return {
        kind: p.kind, x: p.x, y: p.y, w: p.w, d: p.kind === 'cyl' ? p.w : p.d ?? p.w, h: p.h, yaw: p.yaw ?? 0, z0: p.z0 ?? 0, glow: p.glow ?? 0, solid: p.solid ?? true,
        ...(material >= 0 ? { material } : {}),
    };
};

/** The props a prefab makes where it is set down: its parts moved to `(x, y)` and turned `yaw`. */
export function prefabProps(prefab: Prefab, x: number, y: number, yaw = 0): Prop[]
{
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return prefab.parts.map(part =>
        propOf({
            ...part,
            x: round(x + part.x * c - part.y * s),
            y: round(y + part.x * s + part.y * c),
            ...(part.kind === 'box' ? { yaw: round((part.yaw ?? 0) + yaw) } : {}),
        }));
}

/** Six sleeping capsules in a ring. */
const pods = (cx: number, cy: number, radius: number): Prop[] =>
    Array.from({ length: 6 }, (_, k) =>
    {
        const a = (k * Math.PI * 2) / 6 + Math.PI / 6;
        const [x, y] = [round(cx + radius * Math.cos(a)), round(cy + radius * Math.sin(a))];
        // a white shell, a dark seal and a lid of cold light
        return [
            cyl(x, y, 1.4, 0.7, of('frame')),
            cyl(x, y, 1.46, 0.06, of('graphite', { z0: 0.68, solid: false })),
            cyl(x, y, 1.2, 0.32, of('blue', { z0: 0.72, glow: 0.35, solid: false })),
        ];
    }).flat();

// ---- the mess: a round table in a sunken ring under a crown of monitors, as on the Torrens

/** Radius of the mess table and the height of its top. */
export let TABLE_R = 2.5;
export let TABLE_TOP = 0.76;
/** Radius of the ring of chairs round the table, and how many there are. */
export let CHAIR_R = 3.05;
export let CHAIRS = 8;

/** The middle of chair `k`, a quarter turn off the doorways so the way round the table stays open. */
export function chairAt(k: number, radius = CHAIR_R, count = CHAIRS): { x: number; y: number; a: number }
{
    const a = ((k + 0.5) * Math.PI * 2) / count;
    return { x: round(radius * Math.cos(a)), y: round(radius * Math.sin(a)), a };
}

/** A point `r` from the middle of the mess toward plan angle `a` (radians, 0 east, clockwise), `t` along the wall. */
function messAt(a: number, r: number, t = 0): { x: number; y: number; yaw: number }
{
    return { x: round(r * Math.cos(a) - t * Math.sin(a)), y: round(r * Math.sin(a) + t * Math.cos(a)), yaw: a + Math.PI / 2 };
}

/** The drinking bird on the table, facing east: the mesh puts its glass where its beak dips. */
export const BIRD = { x: 1, y: 1.1, yaw: Math.PI / 2 };
/** How far in front of the bird its glass stands. */
export let BIRD_GLASS = 0.26;

/** `extra` for a prop made of material `id` of `materials.json`, as many as it has; the kind's own if there is none. */
function of(id: string, extra: Partial<Prop> = {}): Partial<Prop>
{
    const material = materialIndex(id);
    return material >= 0 ? { ...extra, material } : extra;
}

/**
 * One of the mess's chairs at plan angle `a` from the middle, `r` out: a yellow seat and back on a frame of dark tube,
 * as on the Torrens. The seat is what you bump into.
 */
function chairProps(r: number, a: number): Prop[]
{
    const at = (radial: number, along: number) => messAt(a, r + radial, along);
    const yaw = a + Math.PI / 2;
    const out: Prop[] = [];
    const seat = at(0, 0);
    out.push(box(seat.x, seat.y, 0.5, 0.46, 0.06, of('seat', { yaw, z0: 0.42 })));
    for (const [radial, along] of [[-0.19, -0.21], [-0.19, 0.21], [0.19, -0.21], [0.19, 0.21]])
    {
        const leg = at(radial, along);
        out.push(box(leg.x, leg.y, 0.035, 0.035, 0.42, of('graphite', { yaw, solid: false })));
    }
    for (const along of [-0.21, 0.21])
    {
        const post = at(0.23, along);
        out.push(box(post.x, post.y, 0.035, 0.035, 0.55, of('graphite', { yaw, z0: 0.47, solid: false })));
    }
    const back = at(0.25, 0);
    out.push(box(back.x, back.y, 0.5, 0.05, 0.3, of('seat', { yaw, z0: 0.68, solid: false })));
    return out;
}

/** The table, the chairs and what is on and over them. The furniture along the walls is plain props in the data. */
function messProps(m: MessData, height: number): Prop[]
{
    const top = m.tableTop;
    const out: Prop[] = [
        // the sunken ring the table stands in, a floor of another kind with an edge you can see
        cyl(0, 0, m.ringD, 0.03, of('graphite', { solid: false })),
        // the table: a mesh drum on a dark plinth, an orange rim and a white top just proud of it
        cyl(0, 0, m.tableR * 2 - 0.5, top - 0.08, of('mesh')),
        cyl(0, 0, m.tableR * 2 - 0.36, 0.1, of('graphite', { solid: false })),
        cyl(0, 0, m.tableR * 2, 0.08, of('orange', { z0: top - 0.08, solid: false })),
        cyl(0, 0, m.tableR * 2 - 0.1, 0.085, of('prop', { z0: top - 0.08, solid: false })),
        // the turntable in the middle, a dark ring round a white disc, and the jars of cereal on it with their lids
        cyl(0, 0, 1.9, 0.012, of('graphite', { z0: top, solid: false })),
        cyl(0, 0, 1.3, 0.04, of('prop', { z0: top, solid: false })),
        ...[0, 1, 2].flatMap(k =>
        {
            const [x, y] = [round(0.42 * Math.cos(k * 2.1)), round(0.42 * Math.sin(k * 2.1))];
            return [cyl(x, y, 0.2, 0.26, of('amber', { z0: top + 0.04, solid: false })), cyl(x, y, 0.21, 0.04, of('prop', { z0: top + 0.3, solid: false }))];
        }),
        // the bird's glass
        cyl(round(m.bird.x + Math.sin(m.bird.yaw) * m.bird.glass), round(m.bird.y - Math.cos(m.bird.yaw) * m.bird.glass), 0.1, 0.23, of('prop', { z0: top, solid: false })),
        // the octagonal hood over the table, its monitors on four of its faces, a band of vents round its foot, and the
        // ring of light under it
        cyl(0, 0, (m.crownR * 2) / Math.cos(Math.PI / 8), height - m.crownZ0, of('frame', { z0: m.crownZ0 + 0.25, solid: false, sides: 8, yaw: Math.PI / 8 })),
        cyl(0, 0, (m.crownR * 2 + 0.1) / Math.cos(Math.PI / 8), 0.25, of('louvre', { z0: m.crownZ0, solid: false, sides: 8, yaw: Math.PI / 8 })),
        cyl(0, 0, m.crownR * 2 - 0.3, 0.06, of('graphite', { z0: m.crownZ0 - 0.06, solid: false })),
        cyl(0, 0, 1.6, 0.1, { z0: m.crownZ0 - 0.16, glow: 0.8, solid: false }),
    ];
    for (let k = 0; k < m.chairs; k++)
    {
        const c = chairAt(k, m.chairR, m.chairs);
        const mug = messAt(c.a, m.tableR - 0.35);
        out.push(...chairProps(m.chairR, c.a), cyl(mug.x, mug.y, 0.09, 0.11, of(k % 2 ? 'graphite' : 'prop', { z0: top, solid: false })));
    }
    return out;
}

/** What one entry of `data.props` makes: itself, or the props a generator makes from its numbers. */
export function propsOf(e: PropEntry, data: ShipData): Prop[]
{
    if ('prefab' in e)
    {
        const prefab = prefabById(e.prefab);
        return prefab ? prefabProps(prefab, e.x, e.y, e.yaw ?? 0) : [];
    }
    if (!('gen' in e)) return [propOf(e)];
    if (e.gen === 'mess') return messProps(data.mess, data.rooms.find(r => r.id === 'comedor')?.height ?? 4.2);
    return pods(e.cx, e.cy, e.radius);
}

/** A shuttle in the hangar: one per favourite app, in two rows facing the middle aisle. */
export interface Bay
{
    x: number;
    y: number;
    /** unit plan normal of the side that faces the aisle, where its name is painted */
    nx: number;
    /** across x 3.4 m, along y 3 m */
    prop: Prop;
}

export let MAX_BAYS = 6;
let hangar: HangarData = { max: 6, rows: [60.8, 65.4, 70], x: 7.5, w: 3.4, d: 3, h: 1.6, z0: 0.3 };

/** Where the first `n` favourite apps are parked: left then right, front row first, up to `MAX_BAYS`. */
export function hangarBays(n: number): Bay[]
{
    return Array.from({ length: Math.max(0, Math.min(MAX_BAYS, n)) }, (_, i) =>
    {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * hangar.x;
        const y = hangar.rows[Math.floor(i / 2)];
        return { x, y, nx: -side, prop: box(x, y, hangar.w, hangar.d, hangar.h, { z0: hangar.z0 }) };
    });
}

/** The unit vector `(dx, dy)` of a wall side that faces `face`. */
const NORMAL = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;

/** A monitor standing off the wall at `(x, y)`, facing `(nx, ny)`. */
function screenAt(id: string, zone: ScreenDef['zone'], x: number, y: number, nx: number, ny: number, w = 2.4, h = 1.3, z = 1.7, hung = false): ScreenDef
{
    return { id, zone, x: round(x + nx * SCREEN_OFFSET), y: round(y + ny * SCREEN_OFFSET), z, w, h, yaw: yawOf(nx, ny), ...(hung ? { hung } : {}) };
}

function onWall(id: string, zone: RoomId, x: number, y: number, face: keyof typeof NORMAL, w?: number, h?: number, z?: number)
{
    const [nx, ny] = NORMAL[face];
    return screenAt(id, zone, x, y, nx, ny, w, h, z);
}

/** A monitor on the crown over the mess table, looking out toward `face`. */
function onCrown(id: string, zone: ScreenDef['zone'], face: keyof typeof NORMAL, crownR: number)
{
    const [nx, ny] = NORMAL[face];
    return screenAt(id, zone, nx * crownR, ny * crownR, nx, ny, 1.1, 0.62, 3.1, true);
}

/** A monitor in the middle of side `k` of the bridge's dome, facing into the room. */
function onDome(id: string, k: number, poly: readonly V2[], centre: V2): ScreenDef
{
    const [ax, ay] = poly[k];
    const [bx, by] = poly[k + 1];
    const len = Math.hypot(bx - ax, by - ay);
    let nx = -(by - ay) / len;
    let ny = (bx - ax) / len;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    // toward the middle of the room
    if ((centre[0] - mx) * nx + (centre[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
    return screenAt(id, 'puente', mx, my, nx, ny, 2.2, 1.2);
}

/** The monitor an entry of `data.screens` places. */
export function screenOf(s: ScreenData, data: ShipData): ScreenDef
{
    if (s.on === 'crown') return onCrown(s.id, s.zone as ScreenDef['zone'], s.face, data.mess.crownR);
    if (s.on === 'wall') return onWall(s.id, s.zone as RoomId, s.x, s.y, s.face, s.w, s.h, s.z);
    const shape = data.rooms.find(r => r.id === 'puente')?.shape;
    if (!shape || !('dome' in shape)) return { id: s.id, zone: s.zone as ScreenDef['zone'], x: 0, y: 0, z: 1.7, w: 2.2, h: 1.2, yaw: 0 };
    // the dome's screens look toward a point 3 m in from its flat edge
    return onDome(s.id, s.k, shapeOf(shape), [shape.dome[0], shape.dome[1] - 3]);
}

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
    portals.length = 0;
    for (const p of data.portals) portals.push(door(p.x, p.y));

    const m = data.mess;
    TABLE_R = m.tableR;
    TABLE_TOP = m.tableTop;
    CHAIR_R = m.chairR;
    CHAIRS = m.chairs;
    BIRD_GLASS = m.bird.glass;
    Object.assign(BIRD, { x: m.bird.x, y: m.bird.y, yaw: m.bird.yaw });
    hangar = { ...data.hangar, rows: [...data.hangar.rows] };
    MAX_BAYS = hangar.max;

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

    lights.length = 0;
    lampCfg = { ...data.lamps };
    lights.push(...buildLights(rooms, props, screens, lampCfg, data.extraLights));
    for (const fn of listeners) fn();
}

export const roomById = (id: string): Room | undefined => ROOMS.find(r => r.id === id);

export const screenById = (id: string): ScreenDef | undefined => SCREENS.find(s => s.id === id);

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
        const step = room.zone === 'pasillo' ? lamps.corridorStep : lamps.step;
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

applyWorld(shipJson as unknown as ShipData);
