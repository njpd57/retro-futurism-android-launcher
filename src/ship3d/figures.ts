import type { Agent } from './crew';
import { Builder, extrude, MAT } from './mesh';
import type { V2 } from './world';

/** A rotated rectangle `across` x `along` centred on `(x, y)` whose long side points where `yaw` faces. */
function footprint(x: number, y: number, yaw: number, across: number, along: number, ahead = 0, side = 0): V2[]
{
    // forward is (sin yaw, -cos yaw), right is (cos yaw, sin yaw)
    const f: V2 = [Math.sin(yaw), -Math.cos(yaw)];
    const r: V2 = [Math.cos(yaw), Math.sin(yaw)];
    const cx = x + f[0] * ahead + r[0] * side;
    const cy = y + f[1] * ahead + r[1] * side;
    return ([[-across / 2, -along / 2], [across / 2, -along / 2], [across / 2, along / 2], [-across / 2, along / 2]] as V2[])
        .map(([u, v]): V2 => [cx + r[0] * u + f[0] * v, cy + r[1] * u + f[1] * v]);
}

const ring = (x: number, y: number, radius: number, n: number): V2[] =>
    Array.from({ length: n }, (_, k): V2 => [x + radius * Math.cos((k * Math.PI * 2) / n), y + radius * Math.sin((k * Math.PI * 2) / n)]);

/** A person: a column for the body and a smaller one for the head; the android is taller and has a glowing visor. */
function person(b: Builder, a: Agent, step: number)
{
    const tall = a.kind === 'android' ? 1.25 : 1;
    const lift = Math.abs(Math.sin(step)) * 0.025;
    extrude(b, ring(a.x, a.y, 0.23, 8), lift, 1.38 * tall + lift, MAT.crew, 0);
    extrude(b, ring(a.x, a.y, 0.13, 6), 1.44 * tall + lift, 1.72 * tall + lift, MAT.crew, 0);
    if (a.kind === 'android')
        extrude(b, footprint(a.x, a.y, a.yaw, 0.2, 0.05, 0.14), 1.58 * tall, 1.66 * tall, MAT.glow, 1);
}

/** Jones: a body, a head, a raised tail. */
function cat(b: Builder, a: Agent, step: number)
{
    const lift = Math.abs(Math.sin(step)) * 0.02;
    extrude(b, footprint(a.x, a.y, a.yaw, 0.2, 0.5), 0.1 + lift, 0.3 + lift, MAT.crew, 0);
    extrude(b, footprint(a.x, a.y, a.yaw, 0.15, 0.15, 0.3), 0.18 + lift, 0.4 + lift, MAT.crew, 0);
    extrude(b, footprint(a.x, a.y, a.yaw, 0.05, 0.3, -0.36), 0.28 + lift, 0.34 + lift, MAT.crew, 0);
    extrude(b, footprint(a.x, a.y, a.yaw, 0.12, 0.04, 0.37), 0.3 + lift, 0.34 + lift, MAT.glow, 1);
}

/** The crew as triangles for the dynamic buffer; `time` (seconds) drives the walking bounce of those who move. */
export function figureVertices(agents: readonly Agent[], time: number, moving: ReadonlySet<string>): Float32Array
{
    const b = new Builder();
    for (const a of agents)
    {
        const step = moving.has(a.id) ? time * (a.kind === 'cat' ? 14 : 8) : 0;
        if (a.kind === 'cat') cat(b, a, step);
        else person(b, a, step);
    }
    return new Float32Array(b.data);
}
