import { materialIndex } from './materials';
import type { Prefab } from './prefabData';
import { prefabById } from './prefabs';
import { round } from './shapes';
import type { HangarData, MessData, PropData, PropEntry, ShipData } from './shipData';
import type { Prop } from './worldTypes';

/**
 * What the plan's props expand into: single props, prefab instances, and the generators (the sleeping pods, the mess
 * table with its chairs and crown, the hangar's bays). The numbers they use are set from the plan (`configureMess`,
 * `configureHangar`).
 */

/** Takes the mess's numbers from the plan. */
export function configureMess(m: MessData)
{
    TABLE_R = m.tableR;
    TABLE_TOP = m.tableTop;
    CHAIR_R = m.chairR;
    CHAIRS = m.chairs;
    BIRD_GLASS = m.bird.glass;
    Object.assign(BIRD, { x: m.bird.x, y: m.bird.y, yaw: m.bird.yaw });
}

/** Takes the hangar's numbers from the plan. */
export function configureHangar(h: HangarData)
{
    hangar = { ...h, rows: [...h.rows] };
    MAX_BAYS = hangar.max;
}

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
    if (e.gen === 'mess') return messProps(data.mess, data.rooms.find(r => r.id === (data.mess.room ?? 'comedor'))?.height ?? 4.2);
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
