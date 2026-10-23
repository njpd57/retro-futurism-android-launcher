/**
 * The moving parts of the panels' controls (a toggle's bat, a lever's handle, a selector's pointer, a button's cap and
 * the lamps), rebuilt into the dynamic buffer each frame like the crew, and what a tap does to each kind. The panels
 * and bezels that never move are baked in `mesh/controls.ts`.
 */
import type { V3 } from './math';
import { Builder, made, MAT, onPanel, panelFrame, panelOf, QUIET_CELLS, type PanelFrame } from './mesh';
import type { ControlData, ControlKind } from './shipData';
import { CONTROLS, roomAt } from './world';

/** Why a control can't be worked: a permission the user can grant, one only adb grants, or the phone lacks it. */
export type ControlLock = 'settings' | 'policy' | 'adb' | 'missing';

/**
 * What a control shows: a toggle or a lamp 0 / 1, a lever 0..1, a selector 0, 1 or 2; a button is lit at 1.
 * `null` value = nothing known (no fork), drawn dark.
 */
export interface ControlState { value: number | null; lock: ControlLock | null }

/** How far a lever's handle travels up and down from the middle of its slot. */
export const LEVER_TRAVEL = 0.12;
/** A tap on a lever moves it this much. */
export const LEVER_STEP = 0.25;
/** Positions of a selector. */
export const SELECTOR_STOPS = 3;
/** Seconds a button stays pushed in. */
export const PRESS_S = 0.15;
/** Units per second a moving part travels to where it should be: quick, like a detent. */
const TRAVEL_SPEED = 7;

/** Where a lever's handle is along its slot, metres up from the middle. */
export const leverOffset = (value: number) => -LEVER_TRAVEL + 2 * LEVER_TRAVEL * value;

/**
 * The value a tap gives a control, `'press'` for those that act without a value (buttons and lamps), or `'read'` for
 * a dial, which only says its reading.
 * `along` is where the tap landed up the control's face, in metres from its middle (a lever goes toward it).
 */
export function tapValue(kind: ControlKind, value: number | null, along = 0): number | 'press' | 'read'
{
    const v = value ?? 0;
    switch (kind)
    {
        case 'toggle': return v > 0.5 ? 0 : 1;
        case 'selector': return (Math.round(v) + 1) % SELECTOR_STOPS;
        case 'lever':
        {
            const up = along > leverOffset(v);
            return Math.max(0, Math.min(1, Math.round((v + (up ? LEVER_STEP : -LEVER_STEP)) / LEVER_STEP) * LEVER_STEP));
        }
        case 'gauge': return 'read';
        default: return 'press';
    }
}

/** A lever dragged by `dv` metres up its slot. */
export const dragValue = (value: number, dv: number) => Math.max(0, Math.min(1, value + dv / (2 * LEVER_TRAVEL)));

/** Moves each shown position toward its target at a steady rate (`shown` is changed in place). */
export function stepShown(shown: Map<string, number>, targets: ReadonlyMap<string, number>, dt: number)
{
    for (const [id, to] of targets)
    {
        const at = shown.get(id) ?? to;
        const step = TRAVEL_SPEED * dt;
        shown.set(id, Math.abs(to - at) <= step ? to : at + Math.sign(to - at) * step);
    }
}

// ---- drawing

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];

/** A box at `c` along three unit axes with half sizes `hx`, `hy`, `hz`, every face with uvs 0..1. */
function block(b: Builder, c: V3, ax: V3, ay: V3, az: V3, hx: number, hy: number, hz: number, mat: number, emit: number)
{
    const p = (sx: number, sy: number, sz: number) => add(add(add(c, scale(ax, sx * hx)), scale(ay, sy * hy)), scale(az, sz * hz));
    const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    b.quad([p(-1, 1, 1), p(1, 1, 1), p(1, -1, 1), p(-1, -1, 1)], az, uv, mat, emit);
    b.quad([p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1)], ay, uv, mat, emit);
    b.quad([p(-1, -1, 1), p(1, -1, 1), p(1, -1, -1), p(-1, -1, -1)], neg(ay), uv, mat, emit);
    b.quad([p(1, 1, 1), p(1, 1, -1), p(1, -1, -1), p(1, -1, 1)], ax, uv, mat, emit);
    b.quad([p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1), p(-1, -1, -1)], neg(ax), uv, mat, emit);
}

/** A small square lamp on the face. */
function lamp(b: Builder, f: PanelFrame, u: number, v: number, colour: string, emit: number, half = 0.022)
{
    block(b, onPanel(f, u, v, 0.012), f.right, f.up, f.normal, half, half, 0.006, made(MAT.glow, colour), emit);
}

/** The colour a lamp takes for each stop of a selector (the ringer: sound, vibration, silence). */
const STOP_COLOUR = ['green', 'amber', 'red'];

export interface ControlLook
{
    /** where each moving part is drawn now (see `stepShown`) */
    shown: ReadonlyMap<string, number>;
    /** seconds left of each button's push */
    pressed: ReadonlyMap<string, number>;
    /** the blink of locked controls' warning lamps */
    blink: boolean;
}

/** The controls' moving parts and lamps as triangles for the dynamic buffer. */
export function controlVertices(states: Readonly<Record<string, ControlState>>, look: ControlLook): Float32Array
{
    const b = new Builder();
    for (const c of CONTROLS)
    {
        const p = panelOf(c);
        if (!p) continue;
        const f = panelFrame(p);
        b.room = roomAt(p.x, p.y) ?? null;
        const st = states[c.id] ?? { value: null, lock: 'missing' };
        const v = look.shown.get(c.id) ?? st.value ?? 0;
        const dead = st.value === null;
        drawControl(b, f, c, v, dead, look.pressed.get(c.id) ?? 0);
        // a locked control has a red lamp in its bezel's corner that blinks until the permission is granted
        if (st.lock && st.lock !== 'missing') lamp(b, f, c.u + 0.05, c.v + 0.075, 'red', look.blink ? 0.9 : 0.1, 0.012);
    }
    return new Float32Array(b.data);
}

function drawControl(b: Builder, f: PanelFrame, c: ControlData, v: number, dead: boolean, pressed: number)
{
    const metal = made(MAT.prop, 'frame');
    switch (c.kind)
    {
        case 'toggle':
        {
            // the bat leans up when on, down when off, from a pivot in the middle of its bezel
            const a = (v * 2 - 1) * 0.5;
            const dir: V3 = add(scale(f.normal, Math.cos(a)), scale(f.up, Math.sin(a)));
            const side: V3 = add(scale(f.up, Math.cos(a)), scale(f.normal, -Math.sin(a)));
            block(b, onPanel(f, c.u, c.v - 0.02, 0.012), f.right, f.up, f.normal, 0.028, 0.028, 0.008, made(MAT.prop, 'graphite'), 0);
            block(b, add(onPanel(f, c.u, c.v - 0.02, 0.012), scale(dir, 0.045)), f.right, side, dir, 0.012, 0.012, 0.045, metal, 0);
            lamp(b, f, c.u, c.v + 0.07, dead ? 'graphite' : v > 0.5 ? 'green' : 'amber', dead ? 0 : v > 0.5 ? 0.9 : 0.12);
            break;
        }
        case 'lever':
        {
            const at = c.v + leverOffset(v);
            block(b, onPanel(f, c.u, at, 0.03), f.right, f.up, f.normal, 0.045, 0.022, 0.03, made(MAT.prop, 'orange'), 0);
            // a column of lamps up the slot's side, lit up to the lever's level
            for (let k = 0; k < 5; k++)
            {
                const lit = !dead && v >= (k + 0.5) / 5;
                lamp(b, f, c.u + 0.045, c.v - LEVER_TRAVEL + (k / 4) * 2 * LEVER_TRAVEL, lit ? 'amber' : 'graphite', lit ? 0.8 : 0, 0.01);
            }
            break;
        }
        case 'selector':
        {
            // a round knob (an octagon of blocks would be too much: a square cap reads as one) and its pointer to a stop
            const stop = Math.max(0, Math.min(SELECTOR_STOPS - 1, v));
            const a = (stop - 1) * 0.8;
            const dir: V3 = add(scale(f.up, Math.cos(a)), scale(f.right, Math.sin(a)));
            const across: V3 = add(scale(f.right, Math.cos(a)), scale(f.up, -Math.sin(a)));
            const hub = onPanel(f, c.u, c.v - 0.015, 0.02);
            block(b, hub, across, dir, f.normal, 0.035, 0.035, 0.02, made(MAT.prop, 'graphite'), 0);
            block(b, add(hub, add(scale(dir, 0.03), scale(f.normal, 0.012))), across, dir, f.normal, 0.008, 0.03, 0.01, metal, 0);
            for (let k = 0; k < SELECTOR_STOPS; k++)
            {
                const ka = (k - 1) * 0.8;
                const on = !dead && Math.round(stop) === k;
                lamp(b, f, c.u + Math.sin(ka) * 0.07, c.v - 0.015 + Math.cos(ka) * 0.07, on ? STOP_COLOUR[k] : 'graphite', on ? 0.9 : 0, 0.011);
            }
            break;
        }
        case 'button':
        {
            const out = pressed > 0 ? 0.012 : 0.03;
            block(b, onPanel(f, c.u, c.v, out / 2 + 0.006), f.right, f.up, f.normal, 0.05, 0.05, out / 2, made(MAT.glow, 'amber'), dead ? 0 : v > 0.5 || pressed > 0 ? 0.85 : 0.2);
            break;
        }
        case 'lamp':
            lamp(b, f, c.u, c.v, dead ? 'graphite' : v > 0.5 ? 'green' : 'amber', dead ? 0 : v > 0.5 ? 0.9 : 0.15, 0.05);
            break;
        case 'gauge':
        {
            // a dial: a pale face, a needle swinging over 120 degrees and a ring of lamps, red at the low end
            const x = Math.max(0, Math.min(1, v));
            const a = (x - 0.5) * 2.1;
            const dir: V3 = add(scale(f.up, Math.cos(a)), scale(f.right, Math.sin(a)));
            const across: V3 = add(scale(f.right, Math.cos(a)), scale(f.up, -Math.sin(a)));
            const hub = onPanel(f, c.u, c.v - 0.035, 0.012);
            block(b, onPanel(f, c.u, c.v, 0.008), f.right, f.up, f.normal, 0.07, 0.07, 0.002, made(MAT.prop, 'frame'), 0);
            block(b, add(hub, scale(dir, 0.045)), across, dir, f.normal, 0.004, 0.045, 0.004, made(MAT.prop, 'graphite'), 0);
            for (let k = 0; k < 5; k++)
            {
                const ka = (k / 4 - 0.5) * 2.1;
                const on = !dead && x >= k / 4 - 0.01;
                lamp(b, f, c.u + Math.sin(ka) * 0.075, c.v - 0.035 + Math.cos(ka) * 0.075, on ? (k === 0 ? 'red' : k === 1 ? 'amber' : 'green') : 'graphite', on ? 0.7 : 0, 0.008);
            }
            break;
        }
    }
}

/** The amber cell of every doorway's status box lit up: the phone is silenced or on vibration. */
export function quietVertices(): Float32Array
{
    const b = new Builder();
    const uv: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const c of QUIET_CELLS) b.quad(c.corners, c.normal, uv, made(MAT.glow, 'amber'), 1);
    return new Float32Array(b.data);
}
