import { yawOf } from './math';

/**
 * The ship as data: convex rooms (polygons extruded to a height), the doors between them, what stands in them, the
 * lamps and the monitors. Pure. Metres, `(x east, y south)`, the bow up (north, -y).
 */

export type V2 = [number, number];

/** The eight rooms the data lives in, plus the hub and the corridors between them. */
export type RoomId = 'puente' | 'comms' | 'motor' | 'bodega' | 'enfermeria' | 'hipersueno' | 'comedor' | 'hangar';
export type Zone = RoomId | 'hub' | 'pasillo';

export interface Room
{
    id: string;
    zone: Zone;
    name: string;
    /** convex outline */
    poly: V2[];
    height: number;
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
}

export interface Light { x: number; y: number; z: number; power: number }

/** A monitor hung on a wall, facing `yaw` (the way its picture looks, into the room). */
export interface ScreenDef
{
    id: string;
    /** the room whose card it opens; the hub's terminal opens the search and MOTHER instead */
    zone: RoomId | 'hub';
    x: number;
    y: number;
    /** height of its centre above the floor */
    z: number;
    w: number;
    h: number;
    yaw: number;
}

export const DOOR = { width: 3, height: 2.6 };
/** how far a monitor stands off its wall */
export const SCREEN_OFFSET = 0.04;

// ---- shapes

const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A rectangle with its corners cut. */
const chamfer = (x0: number, y0: number, x1: number, y1: number, c: number): V2[] => [
    [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
];

/** A regular octagon with flat sides facing the four directions, `a` from the centre to each flat. */
const octagon = (cx: number, cy: number, a: number): V2[] =>
{
    const t = a * Math.tan(Math.PI / 8);
    return ([[-t, -a], [t, -a], [a, -t], [a, t], [t, a], [-t, a], [-a, t], [-a, -t]] as V2[]).map(([x, y]): V2 => [cx + x, cy + y]);
};

/** The bridge: a flat edge to the south and a half-ellipse dome to the north. */
const dome = (cx: number, baseY: number, rx: number, ry: number, steps: number): V2[] =>
    Array.from({ length: steps + 1 }, (_, k): V2 =>
    {
        const a = (k * Math.PI) / steps;
        return [round(cx + rx * Math.cos(a)), round(baseY - ry * Math.sin(a))];
    });

const round = (n: number) => Math.round(n * 1e4) / 1e4;

// ---- the ship

const HUB_A = 4.6;
const BRIDGE_BASE = -10.6;
const DOME = dome(0, BRIDGE_BASE, 9, 7, 8);

export const ROOMS: readonly Room[] = [
    { id: 'hub', zone: 'hub', name: 'CONCENTRADOR', poly: octagon(0, 0, HUB_A), height: 5 },
    { id: 'puente', zone: 'puente', name: 'PUENTE', poly: DOME, height: 4.5 },
    { id: 'comms', zone: 'comms', name: 'COMMS', poly: chamfer(-23.6, -6, -11.6, 6, 2), height: 4 },
    { id: 'enfermeria', zone: 'enfermeria', name: 'ENFERMERÍA', poly: chamfer(11.6, -6, 23.6, 6, 2), height: 3.6 },
    { id: 'bodega', zone: 'bodega', name: 'BODEGA', poly: chamfer(-10, 10.6, 10, 26.6, 2), height: 7 },
    { id: 'comedor', zone: 'comedor', name: 'COMEDOR', poly: chamfer(-29, 12.6, -17, 24.6, 2), height: 3.6 },
    { id: 'hipersueno', zone: 'hipersueno', name: 'HIPERSUEÑO', poly: chamfer(17, 12.6, 29, 24.6, 2), height: 3.6 },
    { id: 'motor', zone: 'motor', name: 'MOTOR', poly: chamfer(-8, 32.6, 8, 46.6, 2), height: 6 },
    { id: 'hangar', zone: 'hangar', name: 'HANGAR', poly: chamfer(-12, 52.6, 12, 70.6, 2), height: 6.5 },
    // corridors, 3 m wide, ending exactly on the doorway
    { id: 'p-puente', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, BRIDGE_BASE, 1.5, -HUB_A), height: 3 },
    { id: 'p-comms', zone: 'pasillo', name: 'PASILLO', poly: rect(-11.6, -1.5, -HUB_A, 1.5), height: 3 },
    { id: 'p-enfermeria', zone: 'pasillo', name: 'PASILLO', poly: rect(HUB_A, -1.5, 11.6, 1.5), height: 3 },
    { id: 'p-bodega', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, HUB_A, 1.5, 10.6), height: 3 },
    { id: 'p-comedor', zone: 'pasillo', name: 'PASILLO', poly: rect(-17, 17.1, -10, 20.1), height: 3 },
    { id: 'p-hipersueno', zone: 'pasillo', name: 'PASILLO', poly: rect(10, 17.1, 17, 20.1), height: 3 },
    { id: 'p-motor', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, 26.6, 1.5, 32.6), height: 3 },
    { id: 'p-hangar', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, 46.6, 1.5, 52.6), height: 3 },
];

const door = (x: number, y: number): Portal => ({ x, y, ...DOOR });

export const PORTALS: readonly Portal[] = [
    door(0, -HUB_A), door(0, BRIDGE_BASE),
    door(-HUB_A, 0), door(-11.6, 0),
    door(HUB_A, 0), door(11.6, 0),
    door(0, HUB_A), door(0, 10.6),
    door(-10, 18.6), door(-17, 18.6),
    door(10, 18.6), door(17, 18.6),
    door(0, 26.6), door(0, 32.6),
    door(0, 46.6), door(0, 52.6),
];

const box = (x: number, y: number, w: number, d: number, h: number, extra: Partial<Prop> = {}): Prop =>
    ({ kind: 'box', x, y, w, d, h, yaw: 0, z0: 0, glow: 0, solid: true, ...extra });

const cyl = (x: number, y: number, diameter: number, h: number, extra: Partial<Prop> = {}): Prop =>
    ({ kind: 'cyl', x, y, w: diameter, d: diameter, h, yaw: 0, z0: 0, glow: 0, solid: true, ...extra });

/** Six sleeping capsules in a ring. */
const pods = (cx: number, cy: number, radius: number): Prop[] =>
    Array.from({ length: 6 }, (_, k) =>
    {
        const a = (k * Math.PI * 2) / 6 + Math.PI / 6;
        return cyl(round(cx + radius * Math.cos(a)), round(cy + radius * Math.sin(a)), 1.4, 1.1, { glow: 0.55 });
    });

/** The middle of the hub's diagonal side toward `(sx, sy)` (each ±1), its inward normal and the yaw along it. */
function hubSide(sx: number, sy: number)
{
    const m = (HUB_A + HUB_A * Math.tan(Math.PI / 8)) / 2;
    return { x: round(sx * m), y: round(sy * m), nx: -sx / Math.SQRT2, ny: -sy / Math.SQRT2, yaw: (-sx * sy * Math.PI) / 4 };
}

/** The hub's terminal: a console under each monitor on the two front diagonals (search on the right, MOTHER on the left). */
const HUB_TERMINAL = [hubSide(1, -1), hubSide(-1, -1)];

/** The three consoles of the bridge; the mesh puts a slanted keyboard on each. */
export const BRIDGE_CONSOLES: readonly Prop[] = [
    box(-4.8, -13.8, 3, 1.2, 1, { yaw: -0.55 }),
    box(0, -15.6, 3.4, 1.2, 1),
    box(4.8, -13.8, 3, 1.2, 1, { yaw: 0.55 }),
];

export const PROPS: readonly Prop[] = [
    // hub: a column of light in the middle and the terminal's two consoles
    cyl(0, 0, 1.2, 5, { glow: 0.5 }),
    ...HUB_TERMINAL.map(h => box(round(h.x + h.nx * 0.45), round(h.y + h.ny * 0.45), 2.4, 0.6, 1, { yaw: h.yaw })),
    // bridge: three consoles under the dome and the captain's chair before the middle one; the floor is left open
    ...BRIDGE_CONSOLES,
    cyl(0, -14.2, 0.6, 0.5), box(0, -14.55, 0.7, 0.12, 1.25),
    // comms: the antenna mast and two desks
    cyl(-18, 0, 1.2, 4, { glow: 0.4 }),
    box(-17, 4.9, 4.4, 1.1, 1),
    box(-17, -4.9, 4.4, 1.1, 1),
    // sickbay: four beds
    box(16, -4.2, 2.2, 1, 0.6), box(20, -4.2, 2.2, 1, 0.6),
    box(16, 4.2, 2.2, 1, 0.6), box(20, 4.2, 2.2, 1, 0.6),
    // cargo hold: crates and a stack
    box(-6, 15, 2.4, 2.4, 2.4), box(-6, 21.4, 1.8, 1.8, 1.4), box(-7, 23, 2.6, 2.2, 3.4),
    box(6.4, 14.4, 2.2, 2.2, 1.8), box(6, 22, 3, 2.4, 2.6), box(3.8, 24, 1.4, 1.4, 1),
    // mess: a round table and four bunks along the wall
    cyl(-23, 18.6, 3, 0.8),
    box(-28.2, 15, 1.2, 2.4, 1.8), box(-28.2, 18.6, 1.2, 2.4, 1.8), box(-28.2, 22, 1.2, 2.4, 1.8),
    // and a row of lockers along the north wall
    ...[-21.6, -21, -20.4, -19.8].map(x => box(x, 12.95, 0.6, 0.5, 1.9)),
    // hypersleep: the ring of capsules
    ...pods(23, 18.6, 3.6),
    // engine room: the reactor core
    cyl(0, 39.6, 4.4, 6, { glow: 0.55 }),
    // the hangar's shuttles are the favourite apps: see `hangarBays`
];

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

export const MAX_BAYS = 6;
const BAY_ROWS = [58.4, 63, 67.6];

/** Where the first `n` favourite apps are parked: left then right, front row first, up to `MAX_BAYS`. */
export function hangarBays(n: number): Bay[]
{
    return Array.from({ length: Math.max(0, Math.min(MAX_BAYS, n)) }, (_, i) =>
    {
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * 7.5;
        const y = BAY_ROWS[Math.floor(i / 2)];
        return { x, y, nx: -side, prop: box(x, y, 3.4, 3, 1.6, { z0: 0.3 }) };
    });
}

/** The unit vector `(dx, dy)` of a wall side that faces `face`. */
const NORMAL = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] } as const;

/** A monitor standing off the wall at `(x, y)`, facing `(nx, ny)`. */
function screenAt(id: string, zone: ScreenDef['zone'], x: number, y: number, nx: number, ny: number, w = 2.4, h = 1.3, z = 1.7): ScreenDef
{
    return { id, zone, x: round(x + nx * SCREEN_OFFSET), y: round(y + ny * SCREEN_OFFSET), z, w, h, yaw: yawOf(nx, ny) };
}

function onWall(id: string, zone: RoomId, x: number, y: number, face: keyof typeof NORMAL, w?: number, h?: number, z?: number)
{
    const [nx, ny] = NORMAL[face];
    return screenAt(id, zone, x, y, nx, ny, w, h, z);
}

/** A monitor in the middle of side `k` of the bridge's dome, facing into the room. */
function onDome(id: string, k: number): ScreenDef
{
    const [ax, ay] = DOME[k];
    const [bx, by] = DOME[k + 1];
    const len = Math.hypot(bx - ax, by - ay);
    let nx = -(by - ay) / len;
    let ny = (bx - ax) / len;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    // toward the middle of the room
    if ((0 - mx) * nx + (BRIDGE_BASE - 3 - my) * ny < 0) { nx = -nx; ny = -ny; }
    return screenAt(id, 'puente', mx, my, nx, ny, 2.2, 1.2);
}

export const SCREENS: readonly ScreenDef[] = [
    onDome('puente.turno', 2), onDome('puente.clima', 3), onDome('puente.hora', 4), onDome('puente.rumbo', 5),
    onWall('comms.senales', 'comms', -23.6, -2, 'E'), onWall('comms.mother', 'comms', -23.6, 2, 'E'),
    onWall('enfermeria.sistema', 'enfermeria', 23.6, -2, 'W'), onWall('enfermeria.bitacora', 'enfermeria', 23.6, 2, 'W'),
    onWall('bodega.almacen', 'bodega', -5, 10.6, 'S'), onWall('bodega.pantalla', 'bodega', 5, 10.6, 'S'),
    onWall('comedor.pista', 'comedor', -24, 12.6, 'S'), onWall('comedor.tripulacion', 'comedor', -24, 24.6, 'N'),
    onWall('hipersueno.alarma', 'hipersueno', 21, 12.6, 'S'), onWall('hipersueno.agenda', 'hipersueno', 25, 12.6, 'S'),
    onWall('motor.reserva', 'motor', -8, 37, 'E'), onWall('motor.enlace', 'motor', 8, 37, 'W'),
    onWall('hangar.flota', 'hangar', 0, 70.6, 'N', 4, 2, 2),
    ...HUB_TERMINAL.map((h, k) => screenAt(k === 0 ? 'hub.buscar' : 'hub.mother', 'hub', h.x, h.y, h.nx, h.ny, 2, 1.1)),
];

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
            const a = (k * Math.PI * 2) / n;
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

/** Ceiling lamps on a grid inside each room, plus whatever shines by itself. */
export function buildLights(rooms: readonly Room[] = ROOMS, props: readonly Prop[] = PROPS, screens: readonly ScreenDef[] = SCREENS): Light[]
{
    const lights: Light[] = [];
    for (const room of rooms)
    {
        const xs = room.poly.map(p => p[0]);
        const ys = room.poly.map(p => p[1]);
        const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
        const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
        const step = room.zone === 'pasillo' ? 6 : 7;
        const nx = Math.max(1, Math.round((x1 - x0) / step));
        const ny = Math.max(1, Math.round((y1 - y0) / step));
        for (let i = 0; i < nx; i++)
            for (let j = 0; j < ny; j++)
            {
                const x = round(x0 + ((i + 0.5) * (x1 - x0)) / nx);
                const y = round(y0 + ((j + 0.5) * (y1 - y0)) / ny);
                if (inside(room.poly, x, y)) lights.push({ x, y, z: room.height - 0.3, power: 2.2 });
            }
    }
    for (const p of props)
        if (p.glow > 0) lights.push({ x: p.x, y: p.y, z: p.z0 + p.h / 2, power: p.glow * 1.6 });
    for (const s of screens)
    {
        const [nx, ny] = screenNormal(s);
        lights.push({ x: round(s.x + nx * 0.5), y: round(s.y + ny * 0.5), z: s.z, power: 0.3 });
    }
    return lights;
}

export const LIGHTS: readonly Light[] = buildLights();

/** Where the camera starts: on the bridge, looking up the dome at its monitors. */
export const START = { x: 0, y: -11.8, yaw: 0, pitch: 0 };

/** The plan's bounds, for the minimap. */
export function bounds(rooms: readonly Room[] = ROOMS): { x0: number; y0: number; x1: number; y1: number }
{
    const xs = rooms.flatMap(r => r.poly.map(p => p[0]));
    const ys = rooms.flatMap(r => r.poly.map(p => p[1]));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
