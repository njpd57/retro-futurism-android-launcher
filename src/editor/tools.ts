import type { Face, PropData, ShipData } from '@/ship3d/shipData';
import { centroid, type V2 } from '@/ship3d/world';
import type { Doc } from './doc';
import { clean, nearestEdge, snap } from './geometry';
import * as ops from './ops';
import type { Scene } from './scene';
import { same, type Sel } from './selection';
import type { PlanView } from './view';

export interface ToolCtx
{
    doc: Doc;
    view: PlanView;
    svg: SVGSVGElement;
    /** the map tab is the one showing: the keys and the pointer belong to it only then */
    enabled(): boolean;
    sel(): Sel | null;
    select(sel: Sel | null): void;
    scene(): Scene;
    /** metres; 0 = free */
    grid(): number;
    /** moving a room takes what is in it along */
    carry(): boolean;
    /** the data is final for now (a drag ended): rebuild the 3D at once */
    settle(): void;
    /** the camera moved: redraw without touching the data */
    refresh(): void;
    status(text: string): void;
}

interface Drag
{
    /** screen position where it began */
    sx: number;
    sy: number;
    started: boolean;
    pan: boolean;
    /** moves whatever is being dragged to the plan point; called once `started` */
    apply?: (wx: number, wy: number, e: PointerEvent) => void;
    /** selected on release if it never moved */
    click?: Sel | null;
}

/** A point on the nearest wall of `polys`, snapped along it, with the unit normal that points into that room. */
function onWall(polys: readonly (readonly V2[])[], wx: number, wy: number, grid: number)
{
    const hit = nearestEdge(polys, wx, wy);
    if (!hit) return null;
    const poly = polys[hit.room];
    const a = poly[hit.edge];
    const b = poly[(hit.edge + 1) % poly.length];
    let x = hit.x;
    let y = hit.y;
    if (Math.abs(a[1] - b[1]) < 1e-9)
    {
        y = a[1];
        x = Math.min(Math.max(snap(hit.x, grid), Math.min(a[0], b[0])), Math.max(a[0], b[0]));
    }
    else if (Math.abs(a[0] - b[0]) < 1e-9)
    {
        x = a[0];
        y = Math.min(Math.max(snap(hit.y, grid), Math.min(a[1], b[1])), Math.max(a[1], b[1]));
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / len;
    let ny = (b[0] - a[0]) / len;
    const [cx, cy] = centroid(poly);
    if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
    return { x: clean(x), y: clean(y), nx, ny, room: hit.room, edge: hit.edge, t: hit.t };
}

const faceOf = (nx: number, ny: number): Face => (Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'E' : 'W') : ny > 0 ? 'S' : 'N');

export function attachTools(c: ToolCtx)
{
    const { svg, doc, view } = c;
    let drag: Drag | null = null;
    let spaceDown = false;

    const local = (e: { clientX: number; clientY: number }): V2 =>
    {
        const r = svg.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };

    /** Makes the closure that drags `target`. `checkpoint` has to run before the first change. */
    function grab(target: Element, wx: number, wy: number): Drag['apply'] | undefined
    {
        const grid = c.grid();
        const data = (): ShipData => doc.data;
        const handle = target.getAttribute('data-h');
        const t = target.getAttribute('data-t');
        const i = Number(target.getAttribute('data-i'));
        const roomId = target.getAttribute('data-room') ?? '';
        const current = c.sel();

        if (handle && current?.t === 'room')
        {
            let v = Number(target.getAttribute('data-v'));
            const room = current.i;
            let prepared = false;
            let carried: { p: number; t: number }[] = [];
            const prepare = () =>
            {
                const d = data();
                ops.toPoly(d, room);
                const pl = (d.rooms[room].shape as { poly: V2[] }).poly;
                if (handle === 'edge') { const a = pl[v]; const b = pl[(v + 1) % pl.length]; pl.splice(v + 1, 0, [clean((a[0] + b[0]) / 2), clean((a[1] + b[1]) / 2)]); v += 1; }
                // the doorways on the two sides that meet at this corner follow it
                carried = [];
                const sides: [V2, V2][] = [[pl[(v + pl.length - 1) % pl.length], pl[v]], [pl[v], pl[(v + 1) % pl.length]]];
                d.portals.forEach((p, k) =>
                {
                    sides.forEach(([a, b], s) =>
                    {
                        const n = nearestEdge([[a, b]], p.x, p.y);
                        if (n && n.d < 0.06) carried.push({ p: k, t: s === 0 ? n.t : n.t + 1 });
                    });
                });
                prepared = true;
            };
            return (mx, my) =>
            {
                if (!prepared) prepare();
                const d = data();
                const pl = (d.rooms[room].shape as { poly: V2[] }).poly;
                pl[v] = [clean(snap(mx, grid)), clean(snap(my, grid))];
                for (const { p, t: u } of carried)
                {
                    // `u` is the fraction along the side before the corner (0..1) or 1 + the fraction along the one after it
                    const [a, b] = u <= 1 ? [pl[(v + pl.length - 1) % pl.length], pl[v]] : [pl[v], pl[(v + 1) % pl.length]];
                    const f = u <= 1 ? u : u - 1;
                    d.portals[p].x = clean(a[0] + (b[0] - a[0]) * f);
                    d.portals[p].y = clean(a[1] + (b[1] - a[1]) * f);
                }
            };
        }

        if (handle && current?.t === 'prop')
        {
            const entry = current.i;
            return (mx, my, e) =>
            {
                const p = data().props[entry] as PropData;
                const yaw = p.yaw ?? 0;
                const dx = mx - p.x;
                const dy = my - p.y;
                if (handle === 'rotate' && 'prefab' in p)
                {
                    const a = Math.atan2(dx, -dy);
                    const step = e.shiftKey || grid === 0 ? 0 : Math.PI / 36;
                    (p as { yaw?: number }).yaw = clean(step ? Math.round(a / step) * step : a);
                    if (p.yaw === 0) delete p.yaw;
                }
                else if (handle === 'rotate')
                {
                    const a = Math.atan2(dx, -dy);
                    const step = e.shiftKey || grid === 0 ? 0 : Math.PI / 36;
                    p.yaw = clean(step ? Math.round(a / step) * step : a);
                    if (p.yaw === 0) delete p.yaw;
                }
                else if (handle === 'size-w') p.w = Math.max(0.05, clean(snap(p.kind === 'cyl' ? 2 * Math.hypot(dx, dy) : 2 * (dx * Math.cos(yaw) + dy * Math.sin(yaw)), grid || 0.01)));
                else if (handle === 'size-d') p.d = Math.max(0.05, clean(snap(2 * (-dx * Math.sin(yaw) + dy * Math.cos(yaw)), grid || 0.01)));
            };
        }

        if (handle) return undefined;

        switch (t)
        {
            case 'room':
            {
                const room = i;
                const base = structuredClone(data());
                return (mx, my) =>
                {
                    const dx = snap(mx - wx, grid);
                    const dy = snap(my - wy, grid);
                    ops.moveRoom(data(), base, room, dx, dy, c.carry());
                };
            }
            case 'prop':
            {
                const e0 = data().props[i];
                if ('gen' in e0)
                {
                    if (e0.gen !== 'pods') return undefined;
                    const [ox, oy] = [e0.cx, e0.cy];
                    return (mx, my) => { const p = data().props[i]; if ('gen' in p && p.gen === 'pods') { p.cx = clean(ox + snap(mx - wx, grid)); p.cy = clean(oy + snap(my - wy, grid)); } };
                }
                const [ox, oy] = [e0.x, e0.y];
                return (mx, my) => { const p = data().props[i] as PropData; p.x = clean(ox + snap(mx - wx, grid)); p.y = clean(oy + snap(my - wy, grid)); };
            }
            case 'portal':
                return (mx, my) =>
                {
                    const w = onWall(c.scene().rooms.map(r => r.poly), mx, my, grid || 0.5);
                    if (w) { const p = data().portals[i]; p.x = w.x; p.y = w.y; }
                };
            case 'screen':
            {
                const s0 = data().screens[i];
                if (s0.on !== 'wall') return undefined;
                return (mx, my) =>
                {
                    const s = data().screens[i];
                    if (s.on !== 'wall') return;
                    const own = c.scene().rooms.filter(r => r.zone === s.zone).map(r => r.poly);
                    const w = onWall(own.length ? own : c.scene().rooms.map(r => r.poly), mx, my, grid || 0.5);
                    if (w) { s.x = w.x; s.y = w.y; s.face = faceOf(w.nx, w.ny); }
                };
            }
            case 'light':
            {
                const [ox, oy] = [data().extraLights[i].x, data().extraLights[i].y];
                return (mx, my) => { const l = data().extraLights[i]; l.x = clean(ox + snap(mx - wx, grid)); l.y = clean(oy + snap(my - wy, grid)); };
            }
            case 'stand':
            {
                const [ox, oy] = data().stands[roomId];
                return (mx, my) => { data().stands[roomId] = [clean(ox + snap(mx - wx, grid)), clean(oy + snap(my - wy, grid))]; };
            }
            case 'via':
            {
                const [ox, oy] = data().vias[roomId][i];
                return (mx, my) => { data().vias[roomId][i] = [clean(ox + snap(mx - wx, grid)), clean(oy + snap(my - wy, grid))]; };
            }
            case 'signal':
            {
                const [ox, oy] = [data().signalSlots[i].x, data().signalSlots[i].y];
                return (mx, my) => { const p = data().signalSlots[i]; p.x = clean(ox + snap(mx - wx, grid)); p.y = clean(oy + snap(my - wy, grid)); };
            }
        }
        return undefined;
    }

    const selOf = (target: Element): Sel | null =>
    {
        const t = target.getAttribute('data-t');
        const i = Number(target.getAttribute('data-i'));
        const room = target.getAttribute('data-room') ?? '';
        switch (t)
        {
            case 'room': case 'portal': case 'prop': case 'screen': case 'light': case 'signal': return { t, i } as Sel;
            case 'stand': return { t, room };
            case 'via': return { t, room, i };
        }
        return null;
    };

    svg.addEventListener('contextmenu', e => e.preventDefault());

    svg.addEventListener('pointerdown', e =>
    {
        const [sx, sy] = local(e);
        const [wx, wy] = view.toWorld(sx, sy);
        const target = (e.target as Element).closest('[data-t],[data-h]');
        svg.setPointerCapture(e.pointerId);
        if (e.button === 1 || e.button === 2 || spaceDown || !target) { drag = { sx, sy, started: false, pan: true, click: e.button === 0 && !spaceDown ? null : undefined }; return; }
        if (e.button !== 0) return;

        const hit = selOf(target);
        const handleKind = target.getAttribute('data-h');
        // shift on a corner removes it
        if (handleKind === 'vertex' && e.shiftKey && c.sel()?.t === 'room')
        {
            const room = (c.sel() as { i: number }).i;
            const v = Number(target.getAttribute('data-v'));
            ops.toPoly(doc.data, room);
            const pl = (doc.data.rooms[room].shape as { poly: V2[] }).poly;
            if (pl.length > 3) { doc.checkpoint(); pl.splice(v, 1); doc.touch(); c.settle(); }
            return;
        }
        // a room is dragged only once it is selected; before that the drag pans and a click selects
        if (hit?.t === 'room' && !same(c.sel(), hit)) { drag = { sx, sy, started: false, pan: true, click: hit }; return; }
        drag = { sx, sy, started: false, pan: false, apply: grab(target, wx, wy), click: handleKind ? undefined : hit };
        if (hit && !handleKind && !same(c.sel(), hit)) c.select(hit);
    });

    svg.addEventListener('pointermove', e =>
    {
        const [sx, sy] = local(e);
        const [wx, wy] = view.toWorld(sx, sy);
        c.status(`x ${wx.toFixed(2)}  y ${wy.toFixed(2)} m`);
        if (!drag) return;
        if (!drag.started && Math.hypot(sx - drag.sx, sy - drag.sy) < 3) return;
        if (drag.pan)
        {
            if (!drag.started) { drag.sx = sx; drag.sy = sy; }
            view.pan(sx - drag.sx, sy - drag.sy);
            drag.sx = sx;
            drag.sy = sy;
            drag.started = true;
            c.refresh();
            return;
        }
        if (!drag.apply) return;
        if (!drag.started) { doc.checkpoint(); drag.started = true; }
        drag.apply(wx, wy, e);
        doc.touch();
    });

    const end = (e: PointerEvent) =>
    {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
        if (!d.started && d.click !== undefined) c.select(d.click);
        if (d.started && !d.pan) c.settle();
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    svg.addEventListener('wheel', e =>
    {
        e.preventDefault();
        const [sx, sy] = local(e);
        view.zoom(Math.exp(-e.deltaY * 0.0015), sx, sy);
        c.refresh();
    }, { passive: false });

    window.addEventListener('keyup', e => { if (e.code === 'Space') spaceDown = false; });
    window.addEventListener('keydown', e =>
    {
        const el = e.target as HTMLElement;
        if (!c.enabled() || el.closest('input, select, textarea')) return;
        if (e.code === 'Space') { spaceDown = true; e.preventDefault(); return; }
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); c.settle(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doc.redo(); c.settle(); return; }
        const sel = c.sel();
        if (!sel) return;
        if (mod && e.key.toLowerCase() === 'd')
        {
            e.preventDefault();
            doc.checkpoint();
            const copy = ops.duplicate(doc.data, sel);
            doc.touch();
            if (copy) c.select(copy);
            c.settle();
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace')
        {
            e.preventDefault();
            doc.checkpoint();
            if (ops.remove(doc.data, sel)) { c.select(null); doc.touch(); c.settle(); }
            return;
        }
        if (e.key === 'Escape') { c.select(null); return; }
        const arrows: Record<string, V2> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const dir = arrows[e.key];
        if (dir)
        {
            e.preventDefault();
            const step = e.shiftKey ? 0.1 : c.grid() || 0.1;
            const d = doc.data;
            doc.checkpoint();
            const [dx, dy] = [dir[0] * step, dir[1] * step];
            if (sel.t === 'prop') { const p = d.props[sel.i]; if ('gen' in p) { if (p.gen === 'pods') { p.cx = clean(p.cx + dx); p.cy = clean(p.cy + dy); } } else { p.x = clean(p.x + dx); p.y = clean(p.y + dy); } }
            else if (sel.t === 'light') { d.extraLights[sel.i].x = clean(d.extraLights[sel.i].x + dx); d.extraLights[sel.i].y = clean(d.extraLights[sel.i].y + dy); }
            else if (sel.t === 'stand') { const p = d.stands[sel.room]; d.stands[sel.room] = [clean(p[0] + dx), clean(p[1] + dy)]; }
            else if (sel.t === 'via') { const p = d.vias[sel.room][sel.i]; d.vias[sel.room][sel.i] = [clean(p[0] + dx), clean(p[1] + dy)]; }
            else if (sel.t === 'signal') { d.signalSlots[sel.i].x = clean(d.signalSlots[sel.i].x + dx); d.signalSlots[sel.i].y = clean(d.signalSlots[sel.i].y + dy); }
            else if (sel.t === 'room') ops.moveRoom(d, structuredClone(d), sel.i, dx, dy, c.carry());
            doc.touch();
            c.settle();
        }
    });
}
