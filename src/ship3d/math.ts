/**
 * Small 3D math for the ship engine. Pure: no DOM, no GL.
 *
 * Plan coordinates are `(x east, y south)` in metres, like the rest of the launcher; `yaw` 0 faces north (-y) and
 * grows clockwise. In GL space the same point is `(x, up, y)`, so north is -z, east +x, up +y (right-handed).
 */

export type V3 = [number, number, number];
export type Mat4 = Float32Array;

export const EYE_HEIGHT = 1.6;
/** horizontal field of view, radians: what a portrait phone should see across, whatever its height */
export const HFOV = 1.15;
/** the vertical one never goes past this, or a very tall screen would stretch everything */
export const MAX_FOVY = 1.75;

/** The vertical field of view for a view `aspect` (width over height) wide. */
export const fovYFor = (aspect: number) => Math.min(MAX_FOVY, 2 * Math.atan(Math.tan(HFOV / 2) / aspect));

/** The way a camera faces, in GL space (unit). */
export function forward(yaw: number, pitch: number): V3
{
    const cp = Math.cos(pitch);
    return [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** The camera's right-hand direction (horizontal, unit). */
export const rightOf = (yaw: number): V3 => [Math.cos(yaw), 0, Math.sin(yaw)];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function normalize(v: V3): V3
{
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
}

/** Column-major, like GL expects. */
export function perspective(fovy: number, aspect: number, near: number, far: number): Mat4
{
    const f = 1 / Math.tan(fovy / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
}

/** The view matrix of a camera at `eye` (GL space) looking along `yaw` / `pitch`. */
export function viewMatrix(eye: V3, yaw: number, pitch: number): Mat4
{
    const f = forward(yaw, pitch);
    const r = rightOf(yaw);
    const u = cross(r, f);
    const m = new Float32Array(16);
    m[0] = r[0]; m[4] = r[1]; m[8] = r[2]; m[12] = -dot(r, eye);
    m[1] = u[0]; m[5] = u[1]; m[9] = u[2]; m[13] = -dot(u, eye);
    m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2]; m[14] = dot(f, eye);
    m[15] = 1;
    return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4
{
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return out;
}

/** A point in GL space to clip space, for tests and for projecting markers. */
export function transform(m: Mat4, p: V3): [number, number, number, number]
{
    return [
        m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
    ];
}

export interface Ray { o: V3; d: V3 }

/** The ray through pixel (px, py) of a `w` x `h` view. */
export function rayFromPixel(eye: V3, yaw: number, pitch: number, w: number, h: number, px: number, py: number): Ray
{
    const t = Math.tan(fovYFor(w / h) / 2);
    const cx = (2 * px / w - 1) * t * (w / h);
    const cy = (1 - 2 * py / h) * t;
    const f = forward(yaw, pitch);
    const r = rightOf(yaw);
    const u = cross(r, f);
    return { o: eye, d: normalize([r[0] * cx + u[0] * cy + f[0], r[1] * cx + u[1] * cy + f[1], r[2] * cx + u[2] * cy + f[2]]) };
}

/** Distance along the ray to a flat rectangle, or null. `right` is the rectangle's across axis, `up` its other one. */
export function rayRect(ray: Ray, center: V3, normal: V3, right: V3, up: V3, halfW: number, halfH: number): number | null
{
    const denom = dot(ray.d, normal);
    if (Math.abs(denom) < 1e-6) return null;
    const t = dot([center[0] - ray.o[0], center[1] - ray.o[1], center[2] - ray.o[2]], normal) / denom;
    if (t <= 0) return null;
    const p: V3 = [ray.o[0] + ray.d[0] * t - center[0], ray.o[1] + ray.d[1] * t - center[1], ray.o[2] + ray.d[2] * t - center[2]];
    return Math.abs(dot(p, right)) <= halfW && Math.abs(dot(p, up)) <= halfH ? t : null;
}

/** Distance along the ray to a vertical cylinder's side (axis at plan (cx, cy), from `z0` to `z1`), or null. */
export function rayCylinder(ray: Ray, cx: number, cy: number, radius: number, z0: number, z1: number): number | null
{
    // work in the plan: x is GL x, y is GL z
    const ox = ray.o[0] - cx;
    const oy = ray.o[2] - cy;
    const a = ray.d[0] ** 2 + ray.d[2] ** 2;
    if (a < 1e-9) return null;
    const b = 2 * (ox * ray.d[0] + oy * ray.d[2]);
    const c = ox * ox + oy * oy - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)])
    {
        if (t <= 0) continue;
        const y = ray.o[1] + ray.d[1] * t;
        if (y >= z0 && y <= z1) return t;
    }
    return null;
}

/** The plan yaw of a plan direction `(dx, dy)`. */
export const yawOf = (dx: number, dy: number) => Math.atan2(dx, -dy);

/** Wraps an angle to `[-PI, PI]`. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
