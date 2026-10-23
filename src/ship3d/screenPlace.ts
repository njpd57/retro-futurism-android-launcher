import { yawOf } from './math';
import { round, shapeOf, type V2 } from './shapes';
import type { ScreenData, ShipData } from './shipData';
import type { RoomId, ScreenDef } from './worldTypes';

/** Where the plan puts each monitor: on a wall, over the mess table, or on a side of a dome-shaped room. */

/** how far a monitor stands off its wall */
export const SCREEN_OFFSET = 0.04;

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
function onDome(id: string, zone: string, k: number, poly: readonly V2[], centre: V2, w = 2.2, h = 1.2, z?: number): ScreenDef
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
    return screenAt(id, zone, mx, my, nx, ny, w, h, z);
}

/** The monitor an entry of `data.screens` places. */
export function screenOf(s: ScreenData, data: ShipData): ScreenDef
{
    if (s.on === 'crown') return onCrown(s.id, s.zone as ScreenDef['zone'], s.face, data.mess.crownR);
    if (s.on === 'wall') return onWall(s.id, s.zone as RoomId, s.x, s.y, s.face, s.w, s.h, s.z);
    const shape = data.rooms.find(r => r.id === (s.room ?? s.zone))?.shape;
    if (!shape || !('dome' in shape)) return { id: s.id, zone: s.zone as ScreenDef['zone'], x: 0, y: 0, z: 1.7, w: 2.2, h: 1.2, yaw: 0 };
    // the dome's screens look toward a point 3 m in from its flat edge
    return onDome(s.id, s.zone, s.k, shapeOf(shape), [shape.dome[0], shape.dome[1] - 3], s.w, s.h, s.z);
}
