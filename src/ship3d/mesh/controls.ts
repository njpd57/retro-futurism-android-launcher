import { labelUv } from '../atlas';
import { CONTROL_PLATES } from '../labels';
import type { V3 } from '../math';
import type { ControlData, PanelData } from '../shipData';
import { CONTROLS, PANELS, roomAt } from '../world';
import { MAT, type Builder } from './builder';
import { made } from './doorway';

/** A panel's frame in GL space: its middle, the viewer's right, up its (leaning) face and out of it. */
export interface PanelFrame { center: V3; right: V3; up: V3; normal: V3 }

export function panelFrame(p: PanelData): PanelFrame
{
    const t = p.tilt ?? 0;
    // the way an upright face would look, like a monitor's normal
    const n0: V3 = [Math.sin(p.yaw), 0, -Math.cos(p.yaw)];
    return {
        center: [p.x, p.z, p.y],
        right: [-Math.cos(p.yaw), 0, -Math.sin(p.yaw)],
        // leaning back: the top goes away from the viewer
        up: [-n0[0] * Math.sin(t), Math.cos(t), -n0[2] * Math.sin(t)],
        normal: [n0[0] * Math.cos(t), Math.sin(t), n0[2] * Math.cos(t)],
    };
}

/** The point `u` across, `v` up and `o` out of a panel's face. */
export const onPanel = (f: PanelFrame, u: number, v: number, o: number): V3 => [
    f.center[0] + f.right[0] * u + f.up[0] * v + f.normal[0] * o,
    f.center[1] + f.right[1] * u + f.up[1] * v + f.normal[1] * o,
    f.center[2] + f.right[2] * u + f.up[2] * v + f.normal[2] * o,
];

export const panelOf = (c: ControlData): PanelData | undefined => PANELS.find(p => p.id === c.panel);

/** How far below a control its name plate sits, and how wide the plate is. */
export const PLATE_DROP = 0.19;
export const CONTROL_PLATE_W = 0.32;

/** A flat rectangle on the face, `hw` x `hh` half sizes, `o` out of it. */
export function facePatch(b: Builder, f: PanelFrame, u: number, v: number, hw: number, hh: number, o: number, mat: number, emit: number)
{
    b.quad([onPanel(f, u - hw, v + hh, o), onPanel(f, u + hw, v + hh, o), onPanel(f, u + hw, v - hh, o), onPanel(f, u - hw, v - hh, o)],
        f.normal, [[0, 0], [1, 0], [1, 1], [0, 1]], mat, emit);
}

/** A name plate lying on the face (not standing upright like `plate`), painted like the signs. */
function facePlate(b: Builder, f: PanelFrame, u: number, v: number, slot: number)
{
    b.room = null;
    const [u0, v0, u1, v1] = labelUv(slot);
    const [hw, hh] = [CONTROL_PLATE_W / 2, CONTROL_PLATE_W / 8];
    b.quad([onPanel(f, u - hw, v + hh, 0.008), onPanel(f, u + hw, v + hh, 0.008), onPanel(f, u + hw, v - hh, 0.008), onPanel(f, u - hw, v - hh, 0.008)],
        f.normal, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], MAT.label, 0.75);
}

/** The bezel each kind of control sits in: what does not move. */
const BEZEL: Record<ControlData['kind'], [number, number]> = { toggle: [0.07, 0.1], lever: [0.06, 0.17], selector: [0.09, 0.1], button: [0.07, 0.07], lamp: [0.07, 0.07], gauge: [0.09, 0.09] };

/** The panels of controls: a dark slab on a stand, the bezels of its controls and their names. The moving parts are in `controls.ts`. */
export function addPanels(b: Builder)
{
    for (const p of PANELS)
    {
        const f = panelFrame(p);
        const room = roomAt(p.x, p.y) ?? null;
        b.room = room;
        const [hw, hh, depth] = [p.w / 2, p.h / 2, 0.07];
        // the face, a white lip round it and the slab's sides and back
        facePatch(b, f, 0, 0, hw + 0.03, hh + 0.03, -0.002, made(MAT.prop, 'frame'), 0);
        facePatch(b, f, 0, 0, hw, hh, 0.002, made(MAT.prop, 'graphite'), 0);
        const back = (u: number, v: number) => onPanel(f, u, v, -depth);
        const front = (u: number, v: number) => onPanel(f, u, v, -0.002);
        const side = (a: [number, number], c: [number, number], n: V3) =>
            b.quad([front(a[0], a[1]), front(c[0], c[1]), back(c[0], c[1]), back(a[0], a[1])], n, [[0, 0], [1, 0], [1, 1], [0, 1]], made(MAT.prop, 'frame'), 0);
        const [W, H] = [hw + 0.03, hh + 0.03];
        side([-W, H], [W, H], f.up);
        side([W, -H], [-W, -H], [-f.up[0], -f.up[1], -f.up[2]]);
        side([-W, -H], [-W, H], [-f.right[0], -f.right[1], -f.right[2]]);
        side([W, H], [W, -H], f.right);
        b.quad([back(-W, H), back(W, H), back(W, -H), back(-W, -H)], [-f.normal[0], -f.normal[1], -f.normal[2]], [[0, 0], [1, 0], [1, 1], [0, 1]], made(MAT.prop, 'frame'), 0);

        CONTROLS.forEach((c, i) =>
        {
            if (c.panel !== p.id) return;
            b.room = room;
            const [bw, bh] = BEZEL[c.kind];
            facePatch(b, f, c.u, c.v, bw, bh, 0.004, made(MAT.prop, 'frame'), 0);
            // a dark well the moving part stands in; the lever's is a slot
            if (c.kind === 'lever') facePatch(b, f, c.u, c.v, 0.018, bh - 0.02, 0.006, made(MAT.prop, 'graphite'), 0);
            else facePatch(b, f, c.u, c.v, bw - 0.015, bh - 0.015, 0.006, made(MAT.prop, 'graphite'), 0);
            if (c.label) facePlate(b, f, c.u, c.v - PLATE_DROP, CONTROL_PLATES + i);
        });
    }
}
