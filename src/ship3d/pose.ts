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
