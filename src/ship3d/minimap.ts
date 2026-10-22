import { bounds, ROOMS, type Zone } from './world';

export interface MiniRoom { id: string; zone: Zone; name: string; points: string }

export interface MiniMap
{
    w: number;
    h: number;
    rooms: MiniRoom[];
    /** the camera: a triangle pointing the way it faces, as an SVG `points` string */
    you: string;
}

/** The ship from above, `scale` pixels per metre, with the camera marked. The bow is up, like the ship. */
export function miniMap(pose: { x: number; y: number; yaw: number }, scale: number, pad = 2): MiniMap
{
    const b = bounds();
    const px = (x: number) => (x - b.x0) * scale + pad;
    const py = (y: number) => (y - b.y0) * scale + pad;
    const rooms = ROOMS.map(r => ({
        id: r.id, zone: r.zone, name: r.name,
        points: r.poly.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' '),
    }));

    const cx = px(pose.x);
    const cy = py(pose.y);
    const r = Math.max(3, scale * 2.4);
    const corner = (a: number) => `${(cx + Math.sin(pose.yaw + a) * r * 0.75).toFixed(1)},${(cy - Math.cos(pose.yaw + a) * r * 0.75).toFixed(1)}`;
    const tip = `${(cx + Math.sin(pose.yaw) * r).toFixed(1)},${(cy - Math.cos(pose.yaw) * r).toFixed(1)}`;
    return { w: (b.x1 - b.x0) * scale + pad * 2, h: (b.y1 - b.y0) * scale + pad * 2, rooms, you: [tip, corner(2.5), corner(-2.5)].join(' ') };
}
