import { moveCircle } from './collide';
import { EYE_HEIGHT, wrapAngle } from './math';
import type { Seg } from './world';

/** The camera as a body walking the ship: a position, where it looks, and how fast it is going. */
export interface Walker { x: number; y: number; yaw: number; pitch: number; vx: number; vy: number; bob: number }

export interface WalkInput
{
    /** -1..1, positive to the right */
    strafe: number;
    /** -1..1, positive forward */
    forward: number;
    /** radians to turn this step, positive clockwise (to the right) */
    turn: number;
    /** radians to tilt this step, positive up */
    tilt: number;
}

export const WALK = {
    radius: 0.3,
    /** metres per second */
    speed: 10,
    back: 4,
    strafe: 5.2,
    /** how quickly the speed follows what the stick asks (per second): short, so it feels direct but never jerks */
    accel: 12,
    pitchMax: 0.5,
    bobAmp: 0.03,
    /** steps (bob cycles) per metre walked: about two a second at full speed */
    bobRate: 0.35,
};

export const walker = (x: number, y: number, yaw = 0, pitch = 0): Walker => ({ x, y, yaw, pitch, vx: 0, vy: 0, bob: 0 });

/** One step of `dt` seconds (the caller keeps it short): turns, accelerates, walks and slides along walls. */
export function stepWalk(w: Walker, input: WalkInput, dt: number, segs: readonly Seg[]): Walker
{
    const yaw = wrapAngle(w.yaw + input.turn);
    const pitch = Math.max(-WALK.pitchMax, Math.min(WALK.pitchMax, w.pitch + input.tilt));

    // where the stick asks to go: forward is the facing, right is a quarter turn clockwise
    const fx = Math.sin(yaw);
    const fy = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const ry = Math.sin(yaw);
    const ahead = input.forward * (input.forward >= 0 ? WALK.speed : WALK.back);
    const side = input.strafe * WALK.strafe;
    let tx = fx * ahead + rx * side;
    let ty = fy * ahead + ry * side;
    const asked = Math.hypot(tx, ty);
    if (asked > WALK.speed)
    {
        tx = (tx / asked) * WALK.speed;
        ty = (ty / asked) * WALK.speed;
    }

    const ease = 1 - Math.exp(-WALK.accel * dt);
    let vx = w.vx + (tx - w.vx) * ease;
    let vy = w.vy + (ty - w.vy) * ease;
    if (Math.hypot(vx, vy) < 0.01 && asked === 0) { vx = 0; vy = 0; }

    const moved = moveCircle(segs, w.x, w.y, vx * dt, vy * dt, WALK.radius);
    // what actually happened: a wall takes the speed that pushed into it
    if (dt > 0)
    {
        vx = (moved.x - w.x) / dt;
        vy = (moved.y - w.y) / dt;
    }
    const speed = Math.hypot(vx, vy);
    return { x: moved.x, y: moved.y, yaw, pitch, vx, vy, bob: w.bob + speed * dt * WALK.bobRate };
}

/** The eye's height: standing, with a little bob while walking (none when `still`). */
export function eyeHeight(w: Walker, still: boolean): number
{
    if (still) return EYE_HEIGHT;
    return EYE_HEIGHT + Math.sin(w.bob * Math.PI * 2) * WALK.bobAmp * Math.min(1, Math.hypot(w.vx, w.vy) / WALK.speed);
}
