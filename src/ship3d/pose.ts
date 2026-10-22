import { wrapAngle, yawOf, type V3 } from './math';

/**
 * The crew's bodies as boxes between joints, in the figure's own frame: `x` to its right, `y` up, `z` where it looks,
 * the feet on `y = 0`. Pure: `figures.ts` places and draws them.
 */

/** A box from joint `a` to joint `b`, `w` across and `d` deep; `turn` twists it (radians, to the right) like a head. */
export interface Part { a: V3; b: V3; w: number; d: number; turn?: number; glow?: boolean }

export type Gesture = 'walk' | 'idle' | 'typing';

export interface PersonPose
{
    /** walk cycle, radians: the legs swing with its sine */
    phase: number;
    gesture: Gesture;
    /** seconds, for breathing and typing; 0 keeps them still */
    time: number;
    /** height scale: 1 for the crew, more for the android */
    tall: number;
    /** how far the head turns to the right, radians */
    headYaw: number;
    android?: boolean;
}

const THIGH = 0.46;
const SHIN = 0.44;
const UPPER_ARM = 0.29;
const FOREARM = 0.28;
export const HIP = THIGH + SHIN + 0.03;

/** A point `len` from `from`, at `angle` forward of straight down. */
const swing = (from: V3, len: number, angle: number): V3 => [from[0], from[1] - len * Math.cos(angle), from[2] + len * Math.sin(angle)];

/** A leg: the thigh swings by `swingA`, the knee folds back by `bend`. */
function leg(x: number, k: number, swingA: number, bend: number): Part[]
{
    const hip: V3 = [x, HIP * k, 0];
    const knee = swing(hip, THIGH * k, swingA);
    const ankle = swing(knee, SHIN * k, swingA - bend);
    return [
        { a: hip, b: knee, w: 0.14, d: 0.15 },
        { a: knee, b: ankle, w: 0.11, d: 0.12 },
        { a: [ankle[0], ankle[1] + 0.03, ankle[2] - 0.04], b: [ankle[0], ankle[1] + 0.03, ankle[2] + 0.16], w: 0.1, d: 0.06 },
    ];
}

/** An arm hanging from the shoulder: the upper arm at `upper` forward of down, the forearm at `fore`. */
function arm(x: number, k: number, top: number, upper: number, fore: number, lift = 0): Part[]
{
    const shoulder: V3 = [x, top, 0];
    const elbow = swing(shoulder, UPPER_ARM * k, upper);
    const hand = swing(elbow, FOREARM * k, fore);
    hand[1] += lift;
    return [
        { a: shoulder, b: elbow, w: 0.09, d: 0.1 },
        { a: elbow, b: hand, w: 0.08, d: 0.08 },
    ];
}

/** A person, posed. */
export function posePerson(p: PersonPose): Part[]
{
    const k = p.tall;
    const walking = p.gesture === 'walk';
    const s = walking ? Math.sin(p.phase) : 0;
    // a leg folds its knee while it swings back, the other one is straight under the body
    const bendL = walking ? Math.max(0, -Math.sin(p.phase)) * 0.7 : 0;
    const bendR = walking ? Math.max(0, Math.sin(p.phase)) * 0.7 : 0;
    const breath = 0.01 * Math.sin(p.time * 1.6);
    const neck = 1.42 * k + breath;
    const top = neck - 0.05;

    let arms: Part[];
    if (p.gesture === 'typing')
    {
        // forearms out over the desk, the hands tapping in steps
        const tap = (side: number) => (Math.sin(p.time * 9 + side * 1.3) > 0 ? 0.012 : 0);
        arms = [...arm(-0.24, k, top, 0.35, 1.45, tap(-1)), ...arm(0.24, k, top, 0.35, 1.45, tap(1))];
    }
    else
    {
        const a = walking ? 0.4 * s : 0;
        arms = [...arm(-0.24, k, top, -a, -a + 0.2), ...arm(0.24, k, top, a, a + 0.2)];
    }

    const h = p.headYaw;
    const head: Part[] = [
        { a: [0, neck, 0], b: [0, neck + 0.06, 0], w: 0.09, d: 0.09 },
        { a: [0, neck + 0.05, 0], b: [0, neck + 0.29, 0], w: 0.2, d: 0.23, turn: h },
    ];
    if (p.android)
        head.push({ a: [Math.sin(h) * 0.12, neck + 0.15, Math.cos(h) * 0.12], b: [Math.sin(h) * 0.12, neck + 0.2, Math.cos(h) * 0.12], w: 0.17, d: 0.02, turn: h, glow: true });

    return [
        ...leg(-0.1, k, 0.5 * s, bendL),
        ...leg(0.1, k, -0.5 * s, bendR),
        { a: [0, HIP * k - 0.06, 0], b: [0, neck, 0], w: 0.38, d: 0.22 },
        ...arms,
        ...head,
    ];
}

/** Jones: a body on four legs, a head with glowing eyes and a tail held up that sways. */
export function poseCat(phase: number, moving: boolean, time: number): Part[]
{
    const leg = (x: number, z: number, offset: number): Part =>
    {
        const step = moving ? 0.07 * Math.sin(phase + offset) : 0;
        return { a: [x, 0.24, z], b: [x, 0, z + step], w: 0.05, d: 0.05 };
    };
    const sway = 0.05 * Math.sin(time * 2.1);
    return [
        { a: [0, 0.27, -0.22], b: [0, 0.27, 0.22], w: 0.17, d: 0.15 },
        leg(-0.06, 0.16, 0), leg(0.06, 0.16, Math.PI), leg(-0.06, -0.17, Math.PI), leg(0.06, -0.17, 0),
        { a: [0, 0.3, 0.24], b: [0, 0.4, 0.32], w: 0.14, d: 0.13 },
        { a: [0, 0.39, 0.38], b: [0, 0.41, 0.38], w: 0.1, d: 0.02, glow: true },
        { a: [0, 0.3, -0.22], b: [sway * 0.5, 0.46, -0.34], w: 0.04, d: 0.04 },
        { a: [sway * 0.5, 0.46, -0.34], b: [sway, 0.6, -0.31], w: 0.035, d: 0.035 },
    ];
}

/** Within `range` metres, a crew member turns its head to the camera at `(px, py)`, as far as a neck turns. */
export function headTurn(x: number, y: number, yaw: number, px: number, py: number, range = 3): number
{
    if (Math.hypot(px - x, py - y) > range) return 0;
    const rel = wrapAngle(yawOf(px - x, py - y) - yaw);
    // someone behind it isn't looked at over the shoulder
    if (Math.abs(rel) > 2) return 0;
    return Math.max(-0.9, Math.min(0.9, rel));
}

const v3 = {
    add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
    lerp: (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

/**
 * Where the elbow goes for the hand to reach `hand` from `shoulder` with an upper arm `l1` and a forearm `l2` long:
 * bent toward `pole`. A hand out of reach is pulled in along the line to it.
 */
export function elbowFor(shoulder: V3, hand: V3, l1: number, l2: number, pole: V3): { elbow: V3; hand: V3 }
{
    const to = v3.sub(hand, shoulder);
    const d = Math.min(v3.len(to), l1 + l2 - 1e-4);
    const u = v3.scale(to, 1 / (v3.len(to) || 1));
    const reach = v3.add(shoulder, v3.scale(u, d));
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const up = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    let p = v3.sub(pole, v3.scale(u, v3.dot(pole, u)));
    p = v3.scale(p, 1 / (v3.len(p) || 1));
    return { elbow: v3.add(v3.add(shoulder, v3.scale(u, along)), v3.scale(p, up)), hand: reach };
}

const smooth = (a: number, b: number, x: number) =>
{
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

/** Seconds of one spoonful: the hand rests on the table, comes up to the mouth, stays a moment and goes back. */
export const BITE_S = 5.5;

/** 0 with the hand on the table, 1 at the mouth, along a spoonful `t` seconds in. */
export function biteLift(t: number): number
{
    const f = (((t % BITE_S) + BITE_S) % BITE_S) / BITE_S;
    return smooth(0.55, 0.66, f) * (1 - smooth(0.8, 0.9, f));
}

export interface SeatedPose
{
    /** seconds; 0 keeps them still with the hands on the table */
    time: number;
    /** shifts the spoonful and the glances so the table doesn't eat in step */
    seed: number;
    /** how far the head turns to the right, radians (toward the camera) */
    headYaw: number;
}

/** Height of the seat the crew sits on. */
export const SEAT_H = 0.47;

/** Someone sitting at the mess table, facing it: the left hand on the table, the right one eating. */
export function poseSeated(p: SeatedPose): Part[]
{
    const t = p.time === 0 ? 0 : p.time + p.seed;
    const lift = p.time === 0 ? 0 : biteLift(t);
    // a slow look round the table, and a nod while chewing
    const glance = p.time === 0 ? 0 : 0.35 * Math.sin(t * 0.37 + p.seed);
    const nod = p.time === 0 ? 0 : 0.012 * Math.sin(t * 7) * smooth(0.82, 0.9, ((t % BITE_S) + BITE_S) % BITE_S / BITE_S);
    const neck: V3 = [0, SEAT_H + 0.55, 0.06];
    const top = neck[1] - 0.05;
    const h = Math.max(-0.9, Math.min(0.9, p.headYaw + glance));

    const legs = [-0.1, 0.1].flatMap((x): Part[] =>
    {
        const hip: V3 = [x, SEAT_H, -0.02];
        const knee: V3 = [x, SEAT_H + 0.02, 0.42];
        const ankle: V3 = [x, 0.05, 0.46];
        return [
            { a: hip, b: knee, w: 0.14, d: 0.15 },
            { a: knee, b: ankle, w: 0.11, d: 0.12 },
            { a: [x, 0.03, 0.42], b: [x, 0.03, 0.62], w: 0.1, d: 0.06 },
        ];
    });

    const armTo = (x: number, hand: V3, pole: V3): Part[] =>
    {
        const shoulder: V3 = [x, top, 0.04];
        const j = elbowFor(shoulder, hand, UPPER_ARM, FOREARM, pole);
        return [
            { a: shoulder, b: j.elbow, w: 0.09, d: 0.1 },
            { a: j.elbow, b: j.hand, w: 0.08, d: 0.08 },
        ];
    };
    const mouth: V3 = [0.05, neck[1] + 0.1, 0.2];
    const rest: V3 = [0.17, SEAT_H + 0.33, 0.52];

    return [
        ...legs,
        { a: [0, SEAT_H - 0.04, -0.04], b: neck, w: 0.38, d: 0.22 },
        ...armTo(-0.24, [-0.17, SEAT_H + 0.32, 0.5], [-0.4, -1, 0]),
        ...armTo(0.24, v3.lerp(rest, mouth, lift), [0.5, -1, -0.2]),
        { a: [0, neck[1] + nod, neck[2]], b: [0, neck[1] + 0.06 + nod, neck[2]], w: 0.09, d: 0.09 },
        { a: [0, neck[1] + 0.05 + nod, neck[2]], b: [0, neck[1] + 0.29 + nod, neck[2]], w: 0.2, d: 0.23, turn: h },
    ];
}

/** Seconds of one of the drinking bird's dips, from upright to beak in the glass and back. */
export const DIP_S = 9;

/**
 * How far the drinking bird leans forward at `t` seconds, radians: it rocks, swinging further each time as it tips,
 * dips its beak in the glass, then rights itself with a dying wobble. 0 at time 0, so a still screen shows it upright.
 */
export function birdTilt(t: number): number
{
    if (t === 0) return 0;
    const f = (((t % DIP_S) + DIP_S) % DIP_S) / DIP_S;
    if (f < 0.62)
    {
        const k = f / 0.62;
        return 0.55 * k * k + 0.22 * k * Math.sin(t * 2 * Math.PI * 0.9);
    }
    if (f < 0.74) return 1.45;
    const k = (f - 0.74) / 0.26;
    return 0.5 * Math.exp(-k * 5) * Math.cos(k * 14);
}

/** Size of the bird: about a palm and a half tall, a little big so it reads across the table. */
const BIRD_K = 1.6;

/** The drinking bird at a lean of `tilt`: its stand, the body on its pivot, the head, top hat and beak. The red of its belly glows. */
export function poseBird(tilt: number): Part[]
{
    const k = BIRD_K;
    const pivot: V3 = [0, 0.19 * k, 0];
    // along the body, up toward the head, and the way the beak points
    const up: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
    const fwd: V3 = [0, -Math.sin(tilt), Math.cos(tilt)];
    const at = (s: number, f = 0): V3 => v3.add(v3.add(pivot, v3.scale(up, s * k)), v3.scale(fwd, f * k));
    return [
        { a: [0, 0, 0], b: [0, 0.012 * k, 0], w: 0.12 * k, d: 0.09 * k },
        { a: [-0.045 * k, 0.012 * k, 0], b: [-0.025 * k, pivot[1], 0], w: 0.01 * k, d: 0.012 * k },
        { a: [0.045 * k, 0.012 * k, 0], b: [0.025 * k, pivot[1], 0], w: 0.01 * k, d: 0.012 * k },
        { a: at(-0.1), b: at(-0.05), w: 0.05 * k, d: 0.05 * k, glow: true },
        { a: at(-0.05), b: at(0.13), w: 0.014 * k, d: 0.014 * k },
        { a: at(0.13), b: at(0.18), w: 0.045 * k, d: 0.045 * k },
        { a: at(0.18), b: at(0.19), w: 0.07 * k, d: 0.07 * k },
        { a: at(0.19), b: at(0.225), w: 0.042 * k, d: 0.042 * k },
        { a: at(0.155, 0.02), b: at(0.155, 0.075), w: 0.012 * k, d: 0.012 * k },
    ];
}
