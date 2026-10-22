import type { ShipGL } from '@/ship3d/gl';
import { packLights } from '@/ship3d/lights';
import { fovYFor, multiply, perspective, rayFromPixel, transform, viewMatrix, type Ray, type V3 } from '@/ship3d/math';
import { Builder, extrude, MAT, MAT_SURFACE, propMaterial, STRIDE, type Mesh } from '@/ship3d/mesh';
import { FAR_PLANE } from '@/ship3d/shaders';
import { propOutline, type Light, type Prop, type V2 } from '@/ship3d/world';

/** An orbit camera round a point of the scene (GL space: x, up, z), for the previews. */
export class Orbit
{
    target: V3 = [0, 1, 0];
    /** metres from the target */
    dist = 6;
    /** azimuth round the vertical axis, radians */
    azimuth = 0.6;
    /** elevation over the horizon, radians */
    elevation = 0.45;

    get eye(): V3
    {
        const c = Math.cos(this.elevation);
        return [
            this.target[0] + this.dist * Math.sin(this.azimuth) * c,
            this.target[1] + this.dist * Math.sin(this.elevation),
            this.target[2] + this.dist * Math.cos(this.azimuth) * c,
        ];
    }

    /** The yaw and pitch of the engine's camera for looking from `eye` at the target. */
    get look(): { yaw: number; pitch: number }
    {
        const e = this.eye;
        const f: V3 = [this.target[0] - e[0], this.target[1] - e[1], this.target[2] - e[2]];
        return { yaw: Math.atan2(f[0], -f[2]), pitch: Math.asin(f[1] / Math.hypot(...f)) };
    }

    /** Drag to turn, wheel to come closer. Calls `changed` after each. Returns the way to detach. */
    attach(el: Element, changed: () => void, canGrab: (e: PointerEvent) => boolean = () => true): () => void
    {
        let from: { x: number; y: number } | null = null;
        const down = (e: Event) =>
        {
            const p = e as PointerEvent;
            if (!canGrab(p)) return;
            from = { x: p.clientX, y: p.clientY };
            el.setPointerCapture(p.pointerId);
        };
        const move = (e: Event) =>
        {
            const p = e as PointerEvent;
            if (!from) return;
            this.azimuth -= (p.clientX - from.x) * 0.008;
            this.elevation = Math.min(1.5, Math.max(-0.1, this.elevation + (p.clientY - from.y) * 0.008));
            from = { x: p.clientX, y: p.clientY };
            changed();
        };
        const up = () => { from = null; };
        const wheel = (e: Event) =>
        {
            e.preventDefault();
            this.dist = Math.min(40, Math.max(0.8, this.dist * Math.exp((e as WheelEvent).deltaY * 0.0012)));
            changed();
        };
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('wheel', wheel, { passive: false });
        return () =>
        {
            el.removeEventListener('pointerdown', down);
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            el.removeEventListener('wheel', wheel);
        };
    }

    /** The ray through a pixel of a `w` x `h` view. */
    ray(w: number, h: number, px: number, py: number): Ray
    {
        const { yaw, pitch } = this.look;
        return rayFromPixel(this.eye, yaw, pitch, w, h, px, py);
    }

    viewProj(aspect: number)
    {
        const { yaw, pitch } = this.look;
        return multiply(perspective(fovYFor(aspect), aspect, 0.08, FAR_PLANE), viewMatrix(this.eye, yaw, pitch));
    }

    /** A point of the scene on the screen, in pixels of a `w` x `h` view; null when it is behind the camera. */
    project(p: V3, w: number, h: number): V2 | null
    {
        const [x, y, , cw] = transform(this.viewProj(w / h), p);
        if (cw <= 0.01) return null;
        return [(x / cw * 0.5 + 0.5) * w, (0.5 - (y / cw) * 0.5) * h];
    }
}

/** Lights for a lone object: two lamps over it, so it is lit but not flat. */
const LAMPS: Light[] = [
    { x: 1.5, y: 1.5, z: 3, power: 4 },
    { x: -2, y: -1, z: 2.5, power: 2.5 },
];

export function renderPreview(gl: ShipGL, orbit: Orbit)
{
    const { yaw, pitch } = orbit.look;
    gl.render({
        eye: orbit.eye, yaw, pitch, lights: packLights(LAMPS, [0, 1]), time: 0,
        doors: new Array(16).fill(0), sweep: -1000, holo: 0, grain: 0, edge: 0.6,
    });
}

const rectOutline = (x: number, y: number, w: number, d: number): V2[] => [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];

/** A floor, a back wall and a few boxes and a column, every surface made of material `material` (an index of `MATERIALS`). */
export function materialSampleMesh(material: number): Mesh
{
    const b = new Builder();
    const surf = (mat: number) => mat + (material + 1) * MAT_SURFACE;
    const S = 4;
    b.quad([[-S, 0, -S], [S, 0, -S], [S, 0, S], [-S, 0, S]], [0, 1, 0], [[-S, -S], [S, -S], [S, S], [-S, S]], surf(MAT.floor), 0);
    b.quad([[-S, 0, -S], [S, 0, -S], [S, 3, -S], [-S, 3, -S]], [0, 0, 1], [[-S, 0], [S, 0], [S, 3], [-S, 3]], surf(MAT.wall), 0);
    b.quad([[-S, 0, -S], [-S, 0, S], [-S, 3, S], [-S, 3, -S]], [1, 0, 0], [[-S, 0], [S, 0], [S, 3], [-S, 3]], surf(MAT.wall), 0);
    extrude(b, rectOutline(0, 0, 1.6, 1.6), 0, 1.2, surf(MAT.prop), 0);
    extrude(b, rectOutline(-2.2, -1.6, 0.9, 0.9), 0, 2, surf(MAT.prop), 0);
    extrude(b, propOutline({ kind: 'cyl', x: 2.2, y: 0.8, w: 1.1, d: 1.1, h: 1.6, yaw: 0, z0: 0, glow: 0, solid: true }, 20), 0, 1.6, surf(MAT.prop), 0);
    return { data: new Float32Array(b.data), vertices: b.data.length / STRIDE };
}

/** A grid floor and the props of a prefab (already expanded), for looking at it from all sides. */
export function prefabMesh(props: readonly Prop[]): Mesh
{
    const b = new Builder();
    const S = 5;
    b.quad([[-S, 0, -S], [S, 0, -S], [S, 0, S], [-S, 0, S]], [0, 1, 0], [[-S, -S], [S, -S], [S, S], [-S, S]], MAT.floor, 0);
    // a metre grid in thin strips, so size can be judged by eye
    for (let i = -S; i <= S; i++)
    {
        const w = i === 0 ? 0.03 : 0.012;
        b.quad([[i - w, 0.002, -S], [i + w, 0.002, -S], [i + w, 0.002, S], [i - w, 0.002, S]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 0.5);
        b.quad([[-S, 0.002, i - w], [S, 0.002, i - w], [S, 0.002, i + w], [-S, 0.002, i + w]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 0.5);
    }
    for (const p of props) extrude(b, propOutline(p, p.kind === 'cyl' ? 16 : 4), p.z0, p.z0 + p.h, propMaterial(p), p.glow);
    return { data: new Float32Array(b.data), vertices: b.data.length / STRIDE };
}
