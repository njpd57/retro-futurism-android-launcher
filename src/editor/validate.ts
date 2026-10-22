import type { ShipData } from '@/ship3d/shipData';
import { MATERIALS } from '@/ship3d/materials';
import { PREFABS } from '@/ship3d/prefabs';
import { inside, splitEdge, type Room, type V2 } from '@/ship3d/world';
import { centroid } from '@/ship3d/world';
import { area, isConvex, nearestEdge, overlaps } from './geometry';
import { sceneOf, type Scene } from './scene';
import type { Sel } from './selection';

export interface Issue
{
    level: 'error' | 'warn';
    text: string;
    x: number;
    y: number;
    sel?: Sel;
}

/** The nine rooms the hud, the sounds and the crew expect to exist. */
const REQUIRED = ['puente', 'comms', 'motor', 'bodega', 'enfermeria', 'hipersueno', 'comedor', 'camarotes', 'hangar'];

const asRoom = (r: Scene['rooms'][number]) => r as unknown as Room;

/** Everything about the plan that would break the ship or look wrong; cheap enough to run on every change. */
export function validateWorld(data: ShipData, scene: Scene = sceneOf(data)): Issue[]
{
    const out: Issue[] = [];
    const add = (level: Issue['level'], text: string, at: V2, sel?: Sel) => out.push({ level, text, x: at[0], y: at[1], sel });
    const polys = scene.rooms.map(r => r.poly);
    const portals = scene.portals;

    // ---- rooms
    for (const id of REQUIRED)
        if (!data.rooms.some(r => r.zone === id)) add('error', `FALTA LA SALA ${id.toUpperCase()}`, [0, 0]);
    const seen = new Set<string>();
    scene.rooms.forEach((r, i) =>
    {
        const at = centroid(r.poly);
        const sel: Sel = { t: 'room', i };
        if (seen.has(r.id)) add('error', `ID DE SALA REPETIDO: ${r.id}`, at, sel);
        seen.add(r.id);
        if (r.poly.length < 3 || Math.abs(area(r.poly)) < 1) add('error', `${r.id}: SALA SIN ÁREA`, at, sel);
        else if (!isConvex(r.poly)) add('error', `${r.id}: SALA NO CONVEXA`, at, sel);
        if (r.height < 1) add('error', `${r.id}: ALTURA DEMASIADO BAJA`, at, sel);
    });
    scene.rooms.forEach((a, i) =>
        scene.rooms.forEach((b, j) =>
        {
            if (j > i && a.poly.length >= 3 && b.poly.length >= 3 && overlaps(a.poly, b.poly, 0.02))
                add('error', `SALAS SOLAPADAS: ${a.id} / ${b.id}`, centroid(a.poly), { t: 'room', i });
        }));

    // ---- doorways
    const hosts = portals.map(p => scene.rooms.filter(r => r.poly.some((_, e) => splitEdge(asRoom(r), e, [p]).doors.length > 0)));
    portals.forEach((p, i) =>
    {
        const sel: Sel = { t: 'portal', i };
        const e = nearestEdge(polys, p.x, p.y);
        if (!e || e.d > 0.06) { add('error', 'PUERTA FUERA DE CUALQUIER PARED', [p.x, p.y], sel); return; }
        if (hosts[i].length < 2) add('warn', `PUERTA QUE NO UNE DOS SALAS (${hosts[i].map(r => r.id).join(', ') || 'ninguna'})`, [p.x, p.y], sel);
        // a solid prop in the opening
        const a = polys[e.room][e.edge];
        const b = polys[e.room][(e.edge + 1) % polys[e.room].length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const dx = (b[0] - a[0]) / len;
        const dy = (b[1] - a[1]) / len;
        const opening: V2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): V2 => [p.x + dx * u * (p.width / 2) - dy * v * 0.7, p.y + dy * u * (p.width / 2) + dx * v * 0.7]);
        for (const { prop, outline } of scene.props)
            if (prop.solid && overlaps(outline, opening, 0.01)) { add('warn', 'PUERTA TAPADA POR UN OBJETO', [p.x, p.y], sel); break; }
    });
    scene.rooms.forEach((r, i) =>
    {
        if (r.zone !== 'pasillo') return;
        const doors = portals.filter((p, k) => hosts[k].includes(r)).length;
        if (doors < 2) add('warn', `${r.id}: PASILLO CON ${doors} PUERTA(S); NECESITA UNA EN CADA EXTREMO`, centroid(r.poly), { t: 'room', i });
    });

    // ---- props
    data.props.forEach((e, i) =>
    {
        if ('prefab' in e && !PREFABS.some(f => f.id === e.prefab)) add('error', `PREFAB QUE NO EXISTE: ${e.prefab}`, [e.x, e.y], { t: 'prop', i });
        if (!('gen' in e) && !('prefab' in e) && e.material && !MATERIALS.some(m => m.id === e.material)) add('error', `MATERIAL QUE NO EXISTE: ${e.material}`, [e.x, e.y], { t: 'prop', i });
    });
    for (const { entry, prop, outline } of scene.props)
    {
        const room = scene.rooms.find(r => inside(r.poly, prop.x, prop.y));
        const sel: Sel = { t: 'prop', i: entry };
        if (!room) { add('warn', 'OBJETO FUERA DE LA NAVE', [prop.x, prop.y], sel); continue; }
        if (outline.some(q => !inside(room.poly, q[0], q[1], -0.03))) add('warn', `OBJETO QUE ATRAVIESA LA PARED (${room.id})`, [prop.x, prop.y], sel);
        if (prop.z0 + prop.h > room.height + 1e-6) add('warn', `OBJETO MÁS ALTO QUE LA SALA (${room.id})`, [prop.x, prop.y], sel);
    }

    // ---- screens
    const ids = new Set<string>();
    scene.screens.forEach((s, i) =>
    {
        const sel: Sel = { t: 'screen', i };
        if (ids.has(s.id)) add('error', `ID DE PANTALLA REPETIDO: ${s.id}`, [s.x, s.y], sel);
        ids.add(s.id);
        const d = data.screens[i];
        if (d.on === 'wall')
        {
            const own = scene.rooms.filter(r => r.zone === d.zone).map(r => r.poly);
            const e = own.length ? nearestEdge(own, d.x, d.y) : null;
            if (!e || e.d > 0.06) add('warn', `${s.id}: PANTALLA QUE NO ESTÁ EN UNA PARED DE SU SALA`, [s.x, s.y], sel);
        }
    });

    // ---- the places the crew uses
    const solids = scene.props.filter(p => p.prop.solid).map(p => p.outline);
    const free = (x: number, y: number) => !solids.some(o => inside(o, x, y, -0.3));
    for (const id of REQUIRED)
        if (!data.stands[id]) add('error', `FALTA EL PUNTO DE PARADA DE ${id.toUpperCase()}`, [0, 0]);
    for (const [room, p] of Object.entries(data.stands))
    {
        const r = scene.rooms.find(q => q.id === room);
        const sel: Sel = { t: 'stand', room };
        if (!r) add('warn', `PARADA DE UNA SALA QUE NO EXISTE: ${room}`, p, sel);
        else if (!inside(r.poly, p[0], p[1], 0.3)) add('warn', `${room}: LA PARADA ESTÁ FUERA DE LA SALA`, p, sel);
        else if (!free(p[0], p[1])) add('warn', `${room}: LA PARADA ESTÁ DENTRO DE UN OBJETO`, p, sel);
    }
    for (const [room, list] of Object.entries(data.vias))
        list.forEach((p, i) =>
        {
            const r = scene.rooms.find(q => q.id === room);
            if (!r || !inside(r.poly, p[0], p[1], 0.2) || !free(p[0], p[1])) add('warn', `${room}: PUNTO DE RUTA FUERA DE LUGAR`, p, { t: 'via', room, i });
        });
    const comms = scene.rooms.find(r => r.id === 'comms');
    data.signalSlots.forEach((p, i) =>
    {
        if ((comms && !inside(comms.poly, p.x, p.y, 0.2)) || !free(p.x, p.y)) add('warn', 'PUESTO DE SEÑALES FUERA DE LUGAR', [p.x, p.y], { t: 'signal', i });
    });
    for (const s of data.stencils)
        if (!scene.rooms.some(r => r.id === s.room)) add('warn', `RÓTULO DE UNA SALA QUE NO EXISTE: ${s.room}`, [0, 0]);

    // ---- the rest
    if (!scene.rooms.some(r => inside(r.poly, data.start.x, data.start.y))) add('error', 'EL PUNTO DE INICIO ESTÁ FUERA DE LA NAVE', [data.start.x, data.start.y]);
    if (data.hangar.rows.length * 2 < data.hangar.max) add('error', 'EL HANGAR TIENE MENOS FILAS QUE PLAZAS', [0, 60]);
    if (data.mess.chairs < 1) add('error', 'EL COMEDOR NECESITA AL MENOS UNA SILLA', [0, 0]);
    if (data.screens.length > 20) add('error', 'MÁXIMO 20 PANTALLAS (EL ATLAS TIENE 20 HUECOS)', [0, 0]);
    if (data.stencils.length > 12) add('error', 'MÁXIMO 12 RÓTULOS DE SALA EN EL ATLAS', [0, 0]);
    if (portals.length > 16) add('error', 'MÁXIMO 16 PUERTAS (EL SHADER TIENE 16 HOJAS)', [0, 0]);
    return out;
}


