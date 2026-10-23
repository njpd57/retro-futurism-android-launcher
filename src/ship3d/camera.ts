/** Where the camera is put when it is not walking: in front of a monitor or at a station, and the move there and back. Pure. */
import { fovYFor, multiply, perspective, transform, viewMatrix, wrapAngle, type V3 } from './math';
import { screenFrame } from './mesh/screens';
import type { StationData } from './shipData';
import type { ScreenDef } from './world';

/** A camera: plan position, eye height, and the way it looks. */
export interface Shot { x: number; y: number; z: number; yaw: number; pitch: number }

/** Seconds a move to or from a monitor takes. */
export const SHOT_SECONDS = 0.6;
/** Share of the view's width (or height) the monitor's glass fills when it is in focus. */
export const FOCUS_FILL = 0.94;

/** Straight in front of the monitor's glass, level with it, as close as lets the glass fill `fill` of a view `aspect` wide. */
export function focusShot(s: ScreenDef, aspect: number, fill = FOCUS_FILL): Shot
{
    const tanY = Math.tan(fovYFor(aspect) / 2);
    const tanX = tanY * aspect;
    const d = Math.max(s.w / (2 * fill * tanX), s.h / (2 * fill * tanY));
    const nx = Math.sin(s.yaw);
    const ny = -Math.cos(s.yaw);
    return { x: s.x + nx * d, y: s.y + ny * d, z: s.z, yaw: wrapAngle(s.yaw + Math.PI), pitch: 0 };
}

/** The way from `a` to `b` at `t` (0..1), eased at both ends; the turn takes the short way round. */
export function tweenShot(a: Shot, b: Shot, t: number): Shot
{
    const k = Math.max(0, Math.min(1, t));
    const e = k * k * (3 - 2 * k);
    const mix = (p: number, q: number) => p + (q - p) * e;
    return { x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z), yaw: wrapAngle(a.yaw + wrapAngle(b.yaw - a.yaw) * e), pitch: mix(a.pitch, b.pitch) };
}

/** NEAR and FAR only shape depth, not where a point lands on the screen. */
const NEAR = 0.08;
const FAR = 100;

/**
 * The corners of a monitor's glass (top-left, top-right, bottom-right, bottom-left as the viewer sees them) in CSS
 * pixels of a `w` x `h` view from `shot`, or null if one is behind the camera.
 */
export function glassCorners(s: ScreenDef, shot: Shot, w: number, h: number): [number, number][] | null
{
    const f = screenFrame(s);
    const m = multiply(perspective(fovYFor(w / h), w / h, NEAR, FAR), viewMatrix([shot.x, shot.z, shot.y], shot.yaw, shot.pitch));
    const corner = (dw: number, dh: number): V3 => [f.center[0] + f.right[0] * dw, f.center[1] + dh, f.center[2] + f.right[2] * dw];
    const out: [number, number][] = [];
    for (const p of [corner(-s.w / 2, s.h / 2), corner(s.w / 2, s.h / 2), corner(s.w / 2, -s.h / 2), corner(-s.w / 2, -s.h / 2)])
    {
        const [x, y, , cw] = transform(m, p);
        if (cw <= NEAR) return null;
        out.push([(x / cw + 1) / 2 * w, (1 - y / cw) / 2 * h]);
    }
    return out;
}

/** The way a station lets the eye look: within `arc` of its own heading, between its pitch limits. */
export function clampLook(s: StationData, yaw: number, pitch: number): { yaw: number; pitch: number }
{
    const off = wrapAngle(yaw - s.yaw);
    return {
        yaw: wrapAngle(s.yaw + Math.max(-s.arc, Math.min(s.arc, off))),
        pitch: Math.max(s.pitchMin ?? -0.9, Math.min(s.pitchMax ?? 0.6, pitch)),
    };
}

/** The camera of someone at a station, looking `yaw` / `pitch` (its own heading when left out). */
export function stationShot(s: StationData, yaw = s.yaw, pitch = s.pitch ?? 0): Shot
{
    const look = clampLook(s, yaw, pitch);
    return { x: s.x, y: s.y, z: s.z, ...look };
}
