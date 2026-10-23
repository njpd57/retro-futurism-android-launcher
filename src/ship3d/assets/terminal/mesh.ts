import type { V3 } from '../../math';
import { MAT, Builder } from '../../mesh/builder';
import { made } from '../../mesh/doorway';
import { round } from '../../shapes';
import { variantById } from '../../terminalPlace';
import type { TerminalLights, TerminalPart } from '../../terminalData';
import type { TerminalData } from '../../shipData';
import { roomAt, SCREENS, TERMINALS } from '../../world';
import { addScreen } from '../screen/mesh';

/** A terminal's own frame in GL space: `u` to the viewer's right, `v` toward the viewer, `z` up. */
function frameOf(t: TerminalData)
{
    const k = t.scale ?? 1;
    const [rx, rz] = [-Math.cos(t.yaw), -Math.sin(t.yaw)];
    const [nx, nz] = [Math.sin(t.yaw), -Math.cos(t.yaw)];
    return {
        point: (u: number, v: number, z: number): V3 => [t.x + (rx * u + nx * v) * k, (t.z ?? 0) + z * k, t.y + (rz * u + nz * v) * k],
        dir: (u: number, v: number, z: number): V3 => [rx * u + nx * v, z, rz * u + nz * v],
        k,
    };
}

type Frame = ReturnType<typeof frameOf>;

/** The axes of a plane that leans back `tilt` about the `u` axis: along `u`, toward the viewer along the plane, and out of it. */
function axes(tilt: number): [V3, V3, V3]
{
    const [c, s] = [Math.cos(tilt), Math.sin(tilt)];
    return [[1, 0, 0], [0, c, s], [0, -s, c]];
}

const UV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

function addBox(b: Builder, f: Frame, p: TerminalPart)
{
    const E = axes(p.tilt ?? 0);
    const half = [p.w / 2, (p.d ?? p.w) / 2, p.h / 2];
    const mid: V3 = [p.u ?? 0, p.v ?? 0, (p.z0 ?? 0) + p.h / 2];
    const mat = made(MAT.prop, p.material ?? 'prop');
    /** the corner `(a, c, d)` of the box, each -1..1 along its own axis */
    const at = (a: number, c: number, d: number): V3 => f.point(
        mid[0] + E[0][0] * half[0] * a + E[1][0] * half[1] * c + E[2][0] * half[2] * d,
        mid[1] + E[0][1] * half[0] * a + E[1][1] * half[1] * c + E[2][1] * half[2] * d,
        mid[2] + E[0][2] * half[0] * a + E[1][2] * half[1] * c + E[2][2] * half[2] * d);
    for (const [axis, sign] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]] as const)
    {
        const [a1, a2] = [0, 1, 2].filter(i => i !== axis);
        const corner = (s1: number, s2: number): V3 =>
        {
            const c = [0, 0, 0];
            c[axis] = sign;
            c[a1] = s1;
            c[a2] = s2;
            return at(c[0], c[1], c[2]);
        };
        const n = f.dir(E[axis][0] * sign, E[axis][1] * sign, E[axis][2] * sign);
        b.quad([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], n, UV, mat, p.glow ?? 0);
    }
}

function addCylinder(b: Builder, f: Frame, p: TerminalPart, sides = 12)
{
    const [u, v, z0] = [p.u ?? 0, p.v ?? 0, p.z0 ?? 0];
    const r = p.w / 2;
    const mat = made(MAT.prop, p.material ?? 'prop');
    const ring = (i: number, z: number): V3 => f.point(u + Math.cos((i / sides) * Math.PI * 2) * r, v + Math.sin((i / sides) * Math.PI * 2) * r, z);
    for (let i = 0; i < sides; i++)
    {
        const a = ((i + 0.5) / sides) * Math.PI * 2;
        b.quad([ring(i, z0), ring(i + 1, z0), ring(i + 1, z0 + p.h), ring(i, z0 + p.h)], f.dir(Math.cos(a), Math.sin(a), 0), UV, mat, p.glow ?? 0);
        b.tri(f.point(u, v, z0 + p.h), ring(i, z0 + p.h), ring(i + 1, z0 + p.h), f.dir(0, 0, 1), mat, p.glow ?? 0);
    }
}

/** Rows and columns of small lit cells on a plane leaning back `tilt`: keys, LEDs, a cluster of buttons. */
function addLights(b: Builder, f: Frame, l: TerminalLights)
{
    const [eu, ev, ez] = axes(l.tilt ?? 0);
    const n = f.dir(ez[0], ez[1], ez[2]);
    /** `(s, t)` 0..1 across and along the plane, a hair off it */
    const at = (s: number, t: number): V3 => f.point(
        (l.u ?? 0) + eu[0] * l.w * (s - 0.5) + ev[0] * l.d * (t - 0.5) + ez[0] * 0.004,
        (l.v ?? 0) + eu[1] * l.w * (s - 0.5) + ev[1] * l.d * (t - 0.5) + ez[1] * 0.004,
        l.z + eu[2] * l.w * (s - 0.5) + ev[2] * l.d * (t - 0.5) + ez[2] * 0.004);
    for (let row = 0; row < l.rows; row++)
        for (let col = 0; col < l.cols; col++)
        {
            const [s0, s1] = [(col + 0.15) / l.cols, (col + 0.85) / l.cols];
            const [t0, t1] = [(row + 0.15) / l.rows, (row + 0.85) / l.rows];
            const id = l.colors[(col + row * 2) % l.colors.length];
            b.quad([at(s0, t1), at(s1, t1), at(s1, t0), at(s0, t0)], n, UV, made(MAT.glow, id), l.glow ?? 0.35);
        }
}

/** A terminal: its body and lit controls from its variant, and the glass the atlas paints on. */
export function addTerminal(b: Builder, t: TerminalData)
{
    const variant = variantById(t.variant);
    if (!variant) return;
    b.room = roomAt(t.x, t.y) ?? null;
    const f = frameOf(t);
    for (const p of variant.body ?? []) (p.kind === 'cyl' ? addCylinder : addBox)(b, f, p);
    for (const l of variant.lights ?? []) addLights(b, f, l);
    const glass = SCREENS.find(s => s.id === t.id);
    if (glass) addScreen(b, glass, round((variant.glass.bezel ?? 0.06) * f.k));
}

export const build = (b: Builder) => { for (const t of TERMINALS) addTerminal(b, t); };
