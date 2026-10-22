import { yawOf } from './math';

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

// ---- the ship

/** The mess, the ship's heart: from its middle to each of its flat sides. Everything else hangs off its four doors. */
export const MESS_A = 7;
const BRIDGE_BASE = -13;
const DOME = dome(0, BRIDGE_BASE, 9, 7, 8);

export const ROOMS: readonly Room[] = [
    { id: 'comedor', zone: 'comedor', name: 'COMEDOR', poly: ngon(0, 0, MESS_A, 12), height: 4.2 },
    { id: 'puente', zone: 'puente', name: 'PUENTE', poly: DOME, height: 4.5 },
    { id: 'comms', zone: 'comms', name: 'COMMS', poly: chamfer(-26, -6, -14, 6, 2), height: 4 },
    { id: 'enfermeria', zone: 'enfermeria', name: 'ENFERMERÍA', poly: chamfer(14, -6, 26, 6, 2), height: 3.6 },
    { id: 'bodega', zone: 'bodega', name: 'BODEGA', poly: chamfer(-10, 13, 10, 29, 2), height: 7 },
    { id: 'camarotes', zone: 'camarotes', name: 'CAMAROTES', poly: chamfer(-29, 15, -17, 27, 2), height: 3.6 },
    { id: 'hipersueno', zone: 'hipersueno', name: 'HIPERSUEÑO', poly: chamfer(17, 15, 29, 27, 2), height: 3.6 },
    { id: 'motor', zone: 'motor', name: 'MOTOR', poly: chamfer(-8, 35, 8, 49, 2), height: 6 },
    { id: 'hangar', zone: 'hangar', name: 'HANGAR', poly: chamfer(-12, 55, 12, 73, 2), height: 6.5 },
    // corridors, 3 m wide, ending exactly on the doorway
    { id: 'p-puente', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, BRIDGE_BASE, 1.5, -MESS_A), height: 3 },
    { id: 'p-comms', zone: 'pasillo', name: 'PASILLO', poly: rect(-14, -1.5, -MESS_A, 1.5), height: 3 },
    { id: 'p-enfermeria', zone: 'pasillo', name: 'PASILLO', poly: rect(MESS_A, -1.5, 14, 1.5), height: 3 },
    { id: 'p-bodega', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, MESS_A, 1.5, 13), height: 3 },
    { id: 'p-camarotes', zone: 'pasillo', name: 'PASILLO', poly: rect(-17, 19.5, -10, 22.5), height: 3 },
    { id: 'p-hipersueno', zone: 'pasillo', name: 'PASILLO', poly: rect(10, 19.5, 17, 22.5), height: 3 },
    { id: 'p-motor', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, 29, 1.5, 35), height: 3 },
    { id: 'p-hangar', zone: 'pasillo', name: 'PASILLO', poly: rect(-1.5, 49, 1.5, 55), height: 3 },
];

const door = (x: number, y: number): Portal => ({ x, y, ...DOOR });

export const PORTALS: readonly Portal[] = [
    door(0, -MESS_A), door(0, BRIDGE_BASE),
    door(-MESS_A, 0), door(-14, 0),
    door(MESS_A, 0), door(14, 0),
    door(0, MESS_A), door(0, 13),
    door(-10, 21), door(-17, 21),
    door(10, 21), door(17, 21),
    door(0, 29), door(0, 35),
    door(0, 49), door(0, 55),
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

/** The three consoles of the bridge; the mesh puts a slanted keyboard on each. */
export const BRIDGE_CONSOLES: readonly Prop[] = [
    box(-4.8, -16.2, 3, 1.2, 1, { yaw: -0.55 }),
    box(0, -18, 3.4, 1.2, 1),
    box(4.8, -16.2, 3, 1.2, 1, { yaw: 0.55 }),
];

// ---- the mess: a round table in a sunken ring under a crown of monitors, as on the Torrens

/** Radius of the mess table and the height of its top. */
export const TABLE_R = 2.5;
export const TABLE_TOP = 0.76;
/** Radius of the ring of chairs round the table, and how many there are. */
export const CHAIR_R = 3.05;
export const CHAIRS = 8;
/** The crown that hangs over the table: its radius and where its monitors are. */
const CROWN_R = 1.25;
const CROWN_Z0 = 2.6;

/** The middle of chair `k`, a quarter turn off the doorways so the way round the table stays open. */
export function chairAt(k: number): { x: number; y: number; a: number }
{
    const a = ((k + 0.5) * Math.PI * 2) / CHAIRS;
    return { x: round(CHAIR_R * Math.cos(a)), y: round(CHAIR_R * Math.sin(a)), a };
}

/** A point `r` from the middle of the mess toward plan angle `a` (radians, 0 east, clockwise), `t` along the wall. */
function messAt(a: number, r: number, t = 0): { x: number; y: number; yaw: number }
{
    return { x: round(r * Math.cos(a) - t * Math.sin(a)), y: round(r * Math.sin(a) + t * Math.cos(a)), yaw: a + Math.PI / 2 };
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Something standing against the wall of the mess at plan angle `a`: `w` along the wall, `d` deep, `h` tall. */
function againstWall(a: number, w: number, d: number, h: number, extra: Partial<Prop> = {}, t = 0, gap = 0.05): Prop
{
    const p = messAt(a, MESS_A - gap - d / 2, t);
    return box(p.x, p.y, w, d, h, { yaw: p.yaw, ...extra });
}

/** The drinking bird on the table, facing east: the mesh puts its glass where its beak dips. */
export const BIRD = { x: 1, y: 1.1, yaw: Math.PI / 2 };
/** How far in front of the bird its glass stands. */
export const BIRD_GLASS = 0.26;

function messProps(): Prop[]
{
    const out: Prop[] = [
        // the sunken ring the table stands in, a floor of another kind with an edge you can see
        cyl(0, 0, 9, 0.03, { solid: false }),
        cyl(0, 0, TABLE_R * 2, TABLE_TOP),
        // the lit turntable in the middle and the jars on it
        cyl(0, 0, 1.4, 0.05, { z0: TABLE_TOP, glow: 0.25, solid: false }),
        ...[0, 1, 2].map(k => cyl(round(0.42 * Math.cos(k * 2.1)), round(0.42 * Math.sin(k * 2.1)), 0.2, 0.3, { z0: TABLE_TOP + 0.05, solid: false })),
        // the bird's glass
        cyl(round(BIRD.x + Math.sin(BIRD.yaw) * BIRD_GLASS), round(BIRD.y - Math.cos(BIRD.yaw) * BIRD_GLASS), 0.1, 0.23, { z0: TABLE_TOP, solid: false }),
        // the crown over the table and the ring of light under it
        cyl(0, 0, CROWN_R * 2, 4.2 - CROWN_Z0, { z0: CROWN_Z0, solid: false }),
        cyl(0, 0, 1.6, 0.12, { z0: CROWN_Z0 - 0.12, glow: 0.8, solid: false }),
    ];
    for (let k = 0; k < CHAIRS; k++)
    {
        const c = chairAt(k);
        const back = messAt(c.a, CHAIR_R + 0.24);
        const mug = messAt(c.a, TABLE_R - 0.35);
        out.push(
            box(c.x, c.y, 0.56, 0.5, 0.46, { yaw: c.a + Math.PI / 2 }),
            box(back.x, back.y, 0.56, 0.07, 0.55, { yaw: back.yaw, z0: 0.46, solid: false }),
            cyl(mug.x, mug.y, 0.09, 0.11, { z0: TABLE_TOP, solid: false }),
        );
    }
    // the galley along the two walls between the west and north doors: counter, a lit strip, cupboards over it
    for (const a of [deg(210), deg(240)])
        out.push(
            againstWall(a, 3, 0.7, 1),
            againstWall(a, 3, 0.06, 0.06, { z0: 1.75, glow: 0.5, solid: false }),
            againstWall(a, 3, 0.4, 0.75, { z0: 1.9, solid: false }),
        );
    // lockers between the north and east doors
    for (const a of [deg(300), deg(330)])
        for (const t of [-0.96, -0.32, 0.32, 0.96]) out.push(againstWall(a, 0.6, 0.5, 1.9, {}, t));
    // a dispenser with a lit panel, and a bench
    out.push(
        againstWall(deg(30), 1.2, 0.7, 1.85),
        againstWall(deg(30), 0.8, 0.04, 0.6, { z0: 1, glow: 0.6, solid: false }, 0, 0.77),
        againstWall(deg(60), 2.6, 0.5, 0.45),
    );
    // a crate and a traffic cone somebody left by the south-west wall
    const crate = messAt(deg(150), 6.4);
    const cone = messAt(deg(128), 6.2);
    out.push(
        box(crate.x, crate.y, 0.8, 0.8, 0.7, { yaw: crate.yaw + 0.2 }),
        box(cone.x, cone.y, 0.4, 0.4, 0.03),
        cyl(cone.x, cone.y, 0.32, 0.25, { z0: 0.03 }),
        cyl(cone.x, cone.y, 0.2, 0.22, { z0: 0.28, solid: false }),
        cyl(cone.x, cone.y, 0.1, 0.2, { z0: 0.5, solid: false }),
    );
    return out;
}

export const PROPS: readonly Prop[] = [
    ...messProps(),
    // bridge: three consoles under the dome and the captain's chair before the middle one; the floor is left open
    ...BRIDGE_CONSOLES,
    cyl(0, -16.6, 0.6, 0.5), box(0, -16.95, 0.7, 0.12, 1.25),
    // comms: the antenna mast and two desks
    cyl(-20.4, 0, 1.2, 4, { glow: 0.4 }),
    box(-19.4, 4.9, 4.4, 1.1, 1),
    box(-19.4, -4.9, 4.4, 1.1, 1),
    // sickbay: four beds
    box(18.4, -4.2, 2.2, 1, 0.6), box(22.4, -4.2, 2.2, 1, 0.6),
    box(18.4, 4.2, 2.2, 1, 0.6), box(22.4, 4.2, 2.2, 1, 0.6),
    // cargo hold: crates and a stack
    box(-6, 17.4, 2.4, 2.4, 2.4), box(-6, 23.8, 1.8, 1.8, 1.4), box(-7, 25.4, 2.6, 2.2, 3.4),
    box(6.4, 16.8, 2.2, 2.2, 1.8), box(6, 24.4, 3, 2.4, 2.6), box(3.8, 26.4, 1.4, 1.4, 1),
    // crew quarters: four bunks along the west wall, a small table, a row of lockers along the north wall
    box(-28.2, 17.4, 1.2, 2.4, 1.8), box(-28.2, 21, 1.2, 2.4, 1.8), box(-28.2, 24.4, 1.2, 2.4, 1.8),
    box(-23, 22.4, 1.6, 0.9, 0.75),
    ...[-21.6, -21, -20.4, -19.8].map(x => box(x, 15.35, 0.6, 0.5, 1.9)),
    // hypersleep: the ring of capsules
    ...pods(23, 21, 3.6),
    // engine room: the reactor core
    cyl(0, 42, 4.4, 6, { glow: 0.55 }),
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
const BAY_ROWS = [60.8, 65.4, 70];

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
function onCrown(id: string, zone: ScreenDef['zone'], face: keyof typeof NORMAL)
{
    const [nx, ny] = NORMAL[face];
    return screenAt(id, zone, nx * CROWN_R, ny * CROWN_R, nx, ny, 1.1, 0.62, 3.1, true);
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
    onWall('comms.senales', 'comms', -26, -2, 'E'), onWall('comms.mother', 'comms', -26, 2, 'E'),
    onWall('enfermeria.sistema', 'enfermeria', 26, -2, 'W'), onWall('enfermeria.bitacora', 'enfermeria', 26, 2, 'W'),
    onWall('bodega.almacen', 'bodega', -5, 13, 'S'), onWall('bodega.pantalla', 'bodega', 5, 13, 'S'),
    onWall('camarotes.tripulacion', 'camarotes', -24, 15, 'S'),
    onWall('hipersueno.alarma', 'hipersueno', 21, 15, 'S'), onWall('hipersueno.agenda', 'hipersueno', 25, 15, 'S'),
    onWall('motor.reserva', 'motor', -8, 39.4, 'E'), onWall('motor.enlace', 'motor', 8, 39.4, 'W'),
    onWall('hangar.flota', 'hangar', 0, 73, 'N', 4, 2, 2),
    // the crown over the mess table: the ship's terminal (search, MOTHER), the meal and the music
    onCrown('hub.buscar', 'hub', 'N'), onCrown('hub.mother', 'hub', 'E'),
    onCrown('comedor.rancho', 'comedor', 'S'), onCrown('comedor.pista', 'comedor', 'W'),
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
export const START = { x: 0, y: -14.2, yaw: 0, pitch: 0 };

/** The plan's bounds, for the minimap. */
export function bounds(rooms: readonly Room[] = ROOMS): { x0: number; y0: number; x1: number; y1: number }
{
    const xs = rooms.flatMap(r => r.poly.map(p => p[0]));
    const ys = rooms.flatMap(r => r.poly.map(p => p[1]));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
