import { PREFABS } from '@/ship3d/prefabs';
import { TERMINAL_VARIANTS } from '@/ship3d/terminalPlace';
import { ZONES } from '@/ship3d/zones';
import type { PropData, PropEntry, ScreenData, ShapeData, ShipData } from '@/ship3d/shipData';
import { shapeOf, type V2 } from '@/ship3d/world';
import { clean, nearestOnSegment, pointInPoly } from './geometry';
import type { Sel } from './selection';

/** Changes to the plan that more than one tool uses. They edit `data` in place; the caller checkpoints and touches. */

export function translateShape(shape: ShapeData, dx: number, dy: number): ShapeData
{
    if ('rect' in shape) return { rect: [shape.rect[0] + dx, shape.rect[1] + dy, shape.rect[2] + dx, shape.rect[3] + dy] };
    if ('chamfer' in shape) return { chamfer: [shape.chamfer[0] + dx, shape.chamfer[1] + dy, shape.chamfer[2] + dx, shape.chamfer[3] + dy, shape.chamfer[4]] };
    if ('ngon' in shape) return { ngon: [shape.ngon[0] + dx, shape.ngon[1] + dy, shape.ngon[2], shape.ngon[3]] };
    if ('dome' in shape) return { dome: [shape.dome[0] + dx, shape.dome[1] + dy, shape.dome[2], shape.dome[3], shape.dome[4]] };
    return { poly: shape.poly.map((p): V2 => [clean(p[0] + dx), clean(p[1] + dy)]) };
}

/** A room's outline as a literal polygon, so its corners can move. */
export function toPoly(data: ShipData, room: number)
{
    const r = data.rooms[room];
    if (!('poly' in r.shape)) r.shape = { poly: shapeOf(r.shape) };
}

/** Whether a point lies on a polygon's outline. */
export function onOutline(poly: readonly V2[], x: number, y: number, tol = 0.06): boolean
{
    return poly.some((p, i) => nearestOnSegment(x, y, p, poly[(i + 1) % poly.length]).d < tol);
}

/**
 * Moves a room and what belongs to it by `(dx, dy)`: the props and screens standing in it, the doorways on its walls,
 * its stand and route points. `base` is the data as the drag began, so repeating the call does not pile up.
 */
export function moveRoom(data: ShipData, base: ShipData, room: number, dx: number, dy: number, withContents: boolean)
{
    const b = base.rooms[room];
    const poly = shapeOf(b.shape);
    data.rooms[room].shape = translateShape(b.shape, dx, dy);
    if (!withContents) return;
    const has = (x: number, y: number) => pointInPoly(poly, x, y) || onOutline(poly, x, y);

    base.props.forEach((e, i) =>
    {
        const t = data.props[i];
        if ('gen' in e)
        {
            if (e.gen === 'pods' && 'gen' in t && t.gen === 'pods' && has(e.cx, e.cy)) { t.cx = clean(e.cx + dx); t.cy = clean(e.cy + dy); }
            return;
        }
        if (has(e.x, e.y)) { (t as { x: number }).x = clean(e.x + dx); (t as { y: number }).y = clean(e.y + dy); }
    });
    base.screens.forEach((s, i) =>
    {
        const t = data.screens[i];
        if (s.on === 'wall' && t.on === 'wall' && s.zone === b.zone && onOutline(poly, s.x, s.y)) { t.x = clean(s.x + dx); t.y = clean(s.y + dy); }
    });
    base.terminals?.forEach((s, i) =>
    {
        const t = data.terminals?.[i];
        if (t && has(s.x, s.y)) { t.x = clean(s.x + dx); t.y = clean(s.y + dy); }
    });
    base.portals.forEach((p, i) =>
    {
        if (onOutline(poly, p.x, p.y)) { data.portals[i].x = clean(p.x + dx); data.portals[i].y = clean(p.y + dy); }
    });
    base.extraLights.forEach((l, i) =>
    {
        if (has(l.x, l.y)) { data.extraLights[i].x = clean(l.x + dx); data.extraLights[i].y = clean(l.y + dy); }
    });
    const stand = base.stands[b.id];
    if (stand) data.stands[b.id] = [clean(stand[0] + dx), clean(stand[1] + dy)];
    base.vias[b.id]?.forEach((p, i) => { data.vias[b.id][i] = [clean(p[0] + dx), clean(p[1] + dy)]; });
    if (b.zone === 'comms') base.signalSlots.forEach((p, i) => { data.signalSlots[i].x = clean(p.x + dx); data.signalSlots[i].y = clean(p.y + dy); });
}

// ---- adding

export function addProp(data: ShipData, kind: 'box' | 'cyl', x: number, y: number): Sel
{
    const p: PropData = kind === 'box' ? { kind, x, y, w: 1, d: 1, h: 1 } : { kind, x, y, w: 1, h: 1 };
    data.props.push(p);
    return { t: 'prop', i: data.props.length - 1 };
}

/** A prefab set down where the view is centred. */
export function addPrefab(data: ShipData, prefab: string, x: number, y: number): Sel
{
    data.props.push({ prefab, x, y });
    return { t: 'prop', i: data.props.length - 1 };
}

/** An instance of a prefab replaced by the plain props it makes, to edit them one by one. */
export function explode(data: ShipData, index: number): boolean
{
    const e = data.props[index];
    if (!e || !('prefab' in e)) return false;
    const prefab = PREFABS.find(p => p.id === e.prefab);
    if (!prefab) return false;
    const c = Math.cos(e.yaw ?? 0);
    const s = Math.sin(e.yaw ?? 0);
    const plain = prefab.parts.map((part): PropData =>
    {
        const { material, ...rest } = part;
        return {
            ...rest,
            x: clean(e.x + part.x * c - part.y * s), y: clean(e.y + part.x * s + part.y * c),
            ...(part.kind === 'box' && ((part.yaw ?? 0) + (e.yaw ?? 0)) ? { yaw: clean((part.yaw ?? 0) + (e.yaw ?? 0)) } : {}),
            ...(material ? { material } : {}),
        };
    });
    data.props.splice(index, 1, ...plain);
    return true;
}

export function addPortal(data: ShipData, x: number, y: number): Sel
{
    data.portals.push({ x, y });
    return { t: 'portal', i: data.portals.length - 1 };
}

export function addScreen(data: ShipData, x: number, y: number): Sel
{
    let n = 1;
    while (data.screens.some(s => s.id === `nueva.${n}`)) n++;
    const s: ScreenData = { id: `nueva.${n}`, zone: data.rooms[0]?.zone ?? 'comedor', on: 'wall', x, y, face: 'S' };
    data.screens.push(s);
    return { t: 'screen', i: data.screens.length - 1 };
}

export function addTerminal(data: ShipData, x: number, y: number): Sel
{
    const list = (data.terminals ??= []);
    let n = 1;
    while ([...data.screens, ...list].some(s => s.id === `terminal.${n}`)) n++;
    list.push({ id: `terminal.${n}`, zone: data.rooms[0]?.zone ?? 'comedor', variant: TERMINAL_VARIANTS[0]?.id ?? 'karnak', x, y, yaw: 0 });
    return { t: 'terminal', i: list.length - 1 };
}

export function addLight(data: ShipData, x: number, y: number): Sel
{
    data.extraLights.push({ x, y, z: 2.5, power: 1.5 });
    return { t: 'light', i: data.extraLights.length - 1 };
}

export function addRoom(data: ShipData, x: number, y: number): Sel
{
    let n = 1;
    while (data.rooms.some(r => r.id === `sala-${n}`)) n++;
    data.rooms.push({ id: `sala-${n}`, zone: Object.values(ZONES).find(z => z.hall)?.id ?? 'pasillo', name: `SALA ${n}`, height: 3, shape: { rect: [x - 3, y - 3, x + 3, y + 3] } });
    return { t: 'room', i: data.rooms.length - 1 };
}

/** A copy of the selected thing, a metre away. */
export function duplicate(data: ShipData, sel: Sel): Sel | null
{
    if (sel.t === 'prop')
    {
        const e = structuredClone(data.props[sel.i]) as PropEntry;
        if ('gen' in e) { if (e.gen !== 'pods') return null; e.cx += 1; e.cy += 1; }
        else { e.x += 1; e.y += 1; if ('kind' in e) delete e.keyboard; }
        data.props.splice(sel.i + 1, 0, e);
        return { t: 'prop', i: sel.i + 1 };
    }
    if (sel.t === 'screen')
    {
        const s = structuredClone(data.screens[sel.i]);
        s.id = `${s.id}.copia`;
        if (s.on === 'wall') { s.x += 1; }
        data.screens.splice(sel.i + 1, 0, s);
        return { t: 'screen', i: sel.i + 1 };
    }
    if (sel.t === 'terminal')
    {
        const list = data.terminals ?? [];
        const t = structuredClone(list[sel.i]);
        t.id = `${t.id}.copia`;
        t.x = clean(t.x + 1);
        list.splice(sel.i + 1, 0, t);
        return { t: 'terminal', i: sel.i + 1 };
    }
    if (sel.t === 'portal') { const p = data.portals[sel.i]; data.portals.push({ x: p.x + 1, y: p.y }); return { t: 'portal', i: data.portals.length - 1 }; }
    if (sel.t === 'light') { data.extraLights.push({ ...data.extraLights[sel.i], x: data.extraLights[sel.i].x + 1 }); return { t: 'light', i: data.extraLights.length - 1 }; }
    if (sel.t === 'room')
    {
        const r = structuredClone(data.rooms[sel.i]);
        let n = 1;
        while (data.rooms.some(q => q.id === `${r.id}-${n}`)) n++;
        r.id = `${r.id}-${n}`;
        r.shape = translateShape(r.shape, 2, 2);
        data.rooms.push(r);
        return { t: 'room', i: data.rooms.length - 1 };
    }
    return null;
}

// ---- removing

export function remove(data: ShipData, sel: Sel): boolean
{
    switch (sel.t)
    {
        case 'room': data.rooms.splice(sel.i, 1); return true;
        case 'portal': data.portals.splice(sel.i, 1); return true;
        case 'prop': data.props.splice(sel.i, 1); return true;
        case 'screen': data.screens.splice(sel.i, 1); return true;
        case 'terminal': data.terminals?.splice(sel.i, 1); return true;
        case 'light': data.extraLights.splice(sel.i, 1); return true;
        case 'stand': delete data.stands[sel.room]; return true;
        case 'via': data.vias[sel.room]?.splice(sel.i, 1); return true;
        case 'signal': data.signalSlots.splice(sel.i, 1); return true;
    }
}
