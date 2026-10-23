import { MATERIALS } from '@/ship3d/materials';
import { PREFABS } from '@/ship3d/prefabs';
import { ZONES as ZONE_DEFS } from '@/ship3d/zones';
import type { Face, PropData, ShapeData } from '@/ship3d/shipData';
import type { V2 } from '@/ship3d/world';
import type { Doc } from './doc';
import { clean, nearestEdge, pointInPoly } from './geometry';
import * as ops from './ops';
import type { Scene } from './scene';
import type { Sel } from './selection';
import type { Issue } from './validate';

export interface PanelCtx
{
    doc: Doc;
    sel(): Sel | null;
    select(sel: Sel | null): void;
    scene(): Scene;
    /** the rebuild of the 3D, now */
    settle(): void;
    /** the middle of what the view shows, for where new things go */
    centre(): V2;
    focus(x: number, y: number): void;
}

const ZONES = Object.keys(ZONE_DEFS);
const ROOM_ZONES = ZONES.filter(z => !ZONE_DEFS[z].hall);
const FACES: Face[] = ['N', 'E', 'S', 'W'];
const deg = (r: number) => clean((r * 180) / Math.PI);
const rad = (d: number) => (d * Math.PI) / 180;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K]
{
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

export class Panel
{
    private root: HTMLElement;
    private open = new Set<string>(JSON.parse(localStorage.getItem('shipEditor.open') ?? '["Selección","Mundo"]'));

    constructor(root: HTMLElement, private c: PanelCtx) { this.root = root; }

    /** Whether the user is typing in it: do not rebuild it under their fingers. */
    get busy() { return this.root.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement && document.activeElement.type !== 'checkbox'; }

    // ---- field builders

    private commit(fn: () => void)
    {
        this.c.doc.checkpoint();
        fn();
        this.c.doc.touch();
        this.c.settle();
    }

    private num(parent: HTMLElement, label: string, get: () => number, set: (v: number) => void, step = 0.1, min?: number)
    {
        const row = el('label', 'row');
        row.append(el('span', '', label));
        const input = el('input');
        input.type = 'number';
        input.step = String(step);
        if (min !== undefined) input.min = String(min);
        input.value = String(clean(get()));
        input.addEventListener('change', () =>
        {
            const v = Number(input.value);
            if (Number.isFinite(v)) this.commit(() => set(min !== undefined ? Math.max(min, v) : v));
        });
        row.append(input);
        parent.append(row);
    }

    private text(parent: HTMLElement, label: string, get: () => string, set: (v: string) => void)
    {
        const row = el('label', 'row');
        row.append(el('span', '', label));
        const input = el('input');
        input.type = 'text';
        input.value = get();
        input.addEventListener('change', () => this.commit(() => set(input.value)));
        row.append(input);
        parent.append(row);
    }

    private pick<T extends string>(parent: HTMLElement, label: string, options: readonly T[], get: () => T, set: (v: T) => void)
    {
        const row = el('label', 'row');
        row.append(el('span', '', label));
        const select = el('select');
        for (const o of options) select.append(new Option(o, o, false, o === get()));
        select.addEventListener('change', () => this.commit(() => set(select.value as T)));
        row.append(select);
        parent.append(row);
    }

    private check(parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void)
    {
        const row = el('label', 'row');
        row.append(el('span', '', label));
        const input = el('input');
        input.type = 'checkbox';
        input.checked = get();
        input.addEventListener('change', () => this.commit(() => set(input.checked)));
        row.append(input);
        parent.append(row);
    }

    private button(parent: HTMLElement, label: string, run: () => void, cls = '')
    {
        const b = el('button', cls, label);
        b.addEventListener('click', run);
        parent.append(b);
        return b;
    }

    private section(title: string, body: (e: HTMLElement) => void, label = title)
    {
        const d = el('details');
        d.open = this.open.has(title);
        d.append(el('summary', '', label));
        const inner = el('div', 'body');
        body(inner);
        d.append(inner);
        d.addEventListener('toggle', () =>
        {
            if (d.open) this.open.add(title); else this.open.delete(title);
            localStorage.setItem('shipEditor.open', JSON.stringify([...this.open]));
        });
        this.root.append(d);
    }

    // ---- the selection

    private shape(e: HTMLElement, room: number)
    {
        const data = this.c.doc.data;
        const r = data.rooms[room];
        const s = r.shape as ShapeData;
        const field = (label: string, key: 'rect' | 'chamfer' | 'ngon' | 'dome', k: number, step = 0.1, min?: number) =>
            this.num(e, label, () => (data.rooms[room].shape as never as Record<string, number[]>)[key][k], v => { (data.rooms[room].shape as never as Record<string, number[]>)[key][k] = v; }, step, min);
        if ('rect' in s) { e.append(el('div', 'hint', 'RECTÁNGULO')); ['x0', 'y0', 'x1', 'y1'].forEach((l, k) => field(l, 'rect', k)); }
        else if ('chamfer' in s) { e.append(el('div', 'hint', 'RECTÁNGULO CON ESQUINAS CORTADAS')); ['x0', 'y0', 'x1', 'y1', 'esquina'].forEach((l, k) => field(l, 'chamfer', k, 0.1, k === 4 ? 0 : undefined)); }
        else if ('ngon' in s) { e.append(el('div', 'hint', 'POLÍGONO REGULAR')); ['cx', 'cy', 'apotema', 'lados'].forEach((l, k) => field(l, 'ngon', k, k === 3 ? 4 : 0.1, k === 3 ? 4 : undefined)); }
        else if ('dome' in s) { e.append(el('div', 'hint', 'CÚPULA')); ['cx', 'base y', 'rx', 'ry', 'pasos'].forEach((l, k) => field(l, 'dome', k, k === 4 ? 1 : 0.1, k === 4 ? 2 : undefined)); }
        else
        {
            e.append(el('div', 'hint', 'POLÍGONO (' + s.poly.length + ' VÉRTICES)'));
            s.poly.forEach((p, v) =>
            {
                const row = el('div', 'row pair');
                row.append(el('span', '', String(v)));
                for (const k of [0, 1] as const)
                {
                    const input = el('input');
                    input.type = 'number';
                    input.step = '0.1';
                    input.value = String(p[k]);
                    input.addEventListener('change', () => this.commit(() => { ((data.rooms[room].shape as { poly: V2[] }).poly[v])[k] = Number(input.value); }));
                    row.append(input);
                }
                if (s.poly.length > 3) this.button(row, '✕', () => this.commit(() => { (data.rooms[room].shape as { poly: V2[] }).poly.splice(v, 1); }), 'small');
                e.append(row);
            });
        }
        if (!('poly' in s)) this.button(e, 'CONVERTIR A POLÍGONO', () => this.commit(() => ops.toPoly(data, room)));
    }

    private selection(e: HTMLElement)
    {
        const sel = this.c.sel();
        const data = this.c.doc.data;
        if (!sel) { e.append(el('div', 'hint', 'NADA SELECCIONADO. CLIC EN UN OBJETO, UNA PUERTA, UNA PANTALLA O UNA SALA.')); return; }
        const move = (get: () => V2, set: (x: number, y: number) => void) =>
        {
            this.num(e, 'x', () => get()[0], v => set(v, get()[1]));
            this.num(e, 'y', () => get()[1], v => set(get()[0], v));
        };
        switch (sel.t)
        {
            case 'room':
            {
                const r = data.rooms[sel.i];
                if (!r) break;
                e.append(el('div', 'title', `SALA ${r.id}`));
                this.text(e, 'id', () => r.id, v => { const old = r.id; r.id = v.trim() || old; if (data.stands[old]) { data.stands[r.id] = data.stands[old]; delete data.stands[old]; } if (data.vias[old]) { data.vias[r.id] = data.vias[old]; delete data.vias[old]; } });
                this.text(e, 'nombre', () => r.name, v => { r.name = v; });
                this.pick(e, 'zona', ZONES, () => r.zone, v => { r.zone = v; });
                this.num(e, 'altura', () => r.height, v => { r.height = v; }, 0.1, 1);
                this.shape(e, sel.i);
                e.append(el('div', 'hint', 'ARRASTRA UNA ESQUINA PARA MOVERLA, EL PUNTO MEDIO DE UN LADO PARA PARTIRLO; MAYÚS+CLIC BORRA UNA ESQUINA.'));
                break;
            }
            case 'portal':
            {
                const p = data.portals[sel.i];
                if (!p) break;
                e.append(el('div', 'title', `PUERTA ${sel.i}`));
                move(() => [p.x, p.y], (x, y) => { p.x = x; p.y = y; });
                this.button(e, 'AJUSTAR A LA PARED MÁS CERCANA', () => this.commit(() =>
                {
                    const hit = nearestEdge(this.c.scene().rooms.map(r => r.poly), p.x, p.y);
                    if (hit) { p.x = clean(hit.x); p.y = clean(hit.y); }
                }));
                break;
            }
            case 'prop':
            {
                const p = data.props[sel.i];
                if (!p) break;
                if ('gen' in p)
                {
                    e.append(el('div', 'title', p.gen === 'mess' ? 'MESA, SILLAS Y CORONA (generador)' : 'CÁPSULAS (generador)'));
                    if (p.gen === 'pods')
                    {
                        this.num(e, 'cx', () => p.cx, v => { p.cx = v; });
                        this.num(e, 'cy', () => p.cy, v => { p.cy = v; });
                        this.num(e, 'radio', () => p.radius, v => { p.radius = v; }, 0.1, 0.5);
                    }
                    else e.append(el('div', 'hint', 'SE EDITA EN LA SECCIÓN COMEDOR.'));
                    break;
                }
                if ('prefab' in p)
                {
                    const ids = PREFABS.map(f => f.id);
                    e.append(el('div', 'title', `PREFAB ${p.prefab}`));
                    this.pick(e, 'prefab', ids.includes(p.prefab) ? ids : [p.prefab, ...ids], () => p.prefab, v => { p.prefab = v; });
                    move(() => [p.x, p.y], (x, y) => { p.x = x; p.y = y; });
                    this.num(e, 'giro °', () => deg(p.yaw ?? 0), v => { if (v) p.yaw = rad(v); else delete p.yaw; }, 5);
                    this.button(e, 'DESAGRUPAR EN OBJETOS SUELTOS', () => this.commit(() => { ops.explode(this.c.doc.data, sel.i); this.c.select(null); }));
                    break;
                }
                const q = p as PropData;
                e.append(el('div', 'title', q.kind === 'box' ? 'CAJA' : 'CILINDRO'));
                move(() => [q.x, q.y], (x, y) => { q.x = x; q.y = y; });
                this.num(e, q.kind === 'box' ? 'ancho' : 'diámetro', () => q.w, v => { q.w = v; }, 0.1, 0.05);
                if (q.kind === 'box') this.num(e, 'fondo', () => q.d ?? q.w, v => { q.d = v; }, 0.1, 0.05);
                this.num(e, 'alto', () => q.h, v => { q.h = v; }, 0.1, 0.01);
                this.num(e, 'base z0', () => q.z0 ?? 0, v => { if (v) q.z0 = v; else delete q.z0; }, 0.05, 0);
                if (q.kind === 'box') this.num(e, 'giro °', () => deg(q.yaw ?? 0), v => { if (v) q.yaw = rad(v); else delete q.yaw; }, 5);
                this.num(e, 'brillo', () => q.glow ?? 0, v => { if (v) q.glow = Math.min(1, Math.max(0, v)); else delete q.glow; }, 0.05, 0);
                this.pick(e, 'material', ['(el del tipo)', ...MATERIALS.map(m => m.id)], () => q.material ?? '(el del tipo)', v => { if (v.startsWith('(')) delete q.material; else q.material = v; });
                this.check(e, 'sólido', () => q.solid ?? true, v => { if (v) delete q.solid; else q.solid = false; });
                this.check(e, 'consola del puente', () => q.keyboard ?? false, v => { if (v) q.keyboard = true; else delete q.keyboard; });
                break;
            }
            case 'screen':
            {
                const s = data.screens[sel.i];
                if (!s) break;
                e.append(el('div', 'title', `PANTALLA ${s.id}`));
                this.text(e, 'id', () => s.id, v => { s.id = v.trim() || s.id; });
                this.pick(e, 'zona', [...ROOM_ZONES, 'hub'], () => s.zone, v => { s.zone = v; });
                if (s.on === 'wall')
                {
                    move(() => [s.x, s.y], (x, y) => { s.x = x; s.y = y; });
                    this.pick(e, 'cara', FACES, () => s.face, v => { s.face = v; });
                    this.num(e, 'ancho', () => s.w ?? 2.4, v => { s.w = v; }, 0.1, 0.2);
                    this.num(e, 'alto', () => s.h ?? 1.3, v => { s.h = v; }, 0.1, 0.2);
                    this.num(e, 'altura z', () => s.z ?? 1.7, v => { s.z = v; }, 0.1, 0);
                }
                else if (s.on === 'crown') this.pick(e, 'cara', FACES, () => s.face, v => { s.face = v; });
                else this.num(e, 'lado de la cúpula', () => s.k, v => { s.k = Math.round(v); }, 1, 0);
                e.append(el('div', 'hint', 'LAS PANTALLAS SE PINTAN POR EL ORDEN DE ESTA LISTA (HAY 20 HUECOS EN EL ATLAS).'));
                break;
            }
            case 'light':
            {
                const l = data.extraLights[sel.i];
                if (!l) break;
                e.append(el('div', 'title', `LUZ ${sel.i}`));
                move(() => [l.x, l.y], (x, y) => { l.x = x; l.y = y; });
                this.num(e, 'altura z', () => l.z, v => { l.z = v; }, 0.1, 0);
                this.num(e, 'potencia', () => l.power, v => { l.power = v; }, 0.1, 0);
                e.append(el('div', 'hint', 'A «ALTURA DE LA SALA − 0.3» SE DIBUJA COMO LÁMPARA DE TECHO.'));
                break;
            }
            case 'stand':
            {
                const p = data.stands[sel.room];
                if (!p) break;
                e.append(el('div', 'title', `PARADA ${sel.room}`));
                move(() => data.stands[sel.room], (x, y) => { data.stands[sel.room] = [x, y]; });
                break;
            }
            case 'via':
            {
                const p = data.vias[sel.room]?.[sel.i];
                if (!p) break;
                e.append(el('div', 'title', `PUNTO DE RUTA ${sel.room}`));
                move(() => data.vias[sel.room][sel.i], (x, y) => { data.vias[sel.room][sel.i] = [x, y]; });
                break;
            }
            case 'signal':
            {
                const p = data.signalSlots[sel.i];
                if (!p) break;
                e.append(el('div', 'title', `PUESTO DE SEÑALES ${sel.i}`));
                move(() => [p.x, p.y], (x, y) => { p.x = x; p.y = y; });
                this.num(e, 'mira °', () => deg(p.yaw), v => { p.yaw = rad(v); }, 15);
                break;
            }
        }
        const bar = el('div', 'bar');
        this.button(bar, 'DUPLICAR', () => this.commit(() => { const copy = ops.duplicate(this.c.doc.data, sel); if (copy) this.c.select(copy); }));
        this.button(bar, 'BORRAR', () => this.commit(() => { if (ops.remove(this.c.doc.data, sel)) this.c.select(null); }), 'danger');
        e.append(bar);
    }

    // ---- the whole ship

    private world(e: HTMLElement)
    {
        const d = this.c.doc.data;
        e.append(el('div', 'hint', 'PUERTA'));
        this.num(e, 'ancho', () => d.door.width, v => { d.door.width = v; }, 0.1, 0.5);
        this.num(e, 'alto', () => d.door.height, v => { d.door.height = v; }, 0.1, 1);
        e.append(el('div', 'hint', 'LA ALTURA DE LA PUERTA SE LEE AL CARGAR LA PÁGINA: RECARGA EL EDITOR PARA VERLA.'));
        e.append(el('div', 'hint', 'INICIO'));
        this.num(e, 'x', () => d.start.x, v => { d.start.x = v; });
        this.num(e, 'y', () => d.start.y, v => { d.start.y = v; });
        this.num(e, 'mira °', () => deg(d.start.yaw), v => { d.start.yaw = rad(v); }, 15);
        this.button(e, 'INICIO = CENTRO DE LA VISTA', () => this.commit(() => { const [x, y] = this.c.centre(); d.start.x = clean(x); d.start.y = clean(y); }));
        e.append(el('div', 'hint', 'LÁMPARAS DE TECHO'));
        this.num(e, 'cada (m)', () => d.lamps.step, v => { d.lamps.step = v; }, 0.5, 1);
        this.num(e, 'en pasillos', () => d.lamps.corridorStep, v => { d.lamps.corridorStep = v; }, 0.5, 1);
        this.num(e, 'potencia', () => d.lamps.power, v => { d.lamps.power = v; }, 0.1, 0);
    }

    private mess(e: HTMLElement)
    {
        const m = this.c.doc.data.mess;
        this.num(e, 'radio mesa', () => m.tableR, v => { m.tableR = v; }, 0.1, 0.5);
        this.num(e, 'alto mesa', () => m.tableTop, v => { m.tableTop = v; }, 0.02, 0.2);
        this.num(e, 'radio sillas', () => m.chairR, v => { m.chairR = v; }, 0.05, 1);
        this.num(e, 'sillas', () => m.chairs, v => { m.chairs = Math.max(1, Math.round(v)); }, 1, 1);
        this.num(e, 'radio corona', () => m.crownR, v => { m.crownR = v; }, 0.05, 0.3);
        this.num(e, 'base corona z', () => m.crownZ0, v => { m.crownZ0 = v; }, 0.1, 1);
        this.num(e, 'foso ⌀', () => m.ringD, v => { m.ringD = v; }, 0.1, 1);
        e.append(el('div', 'hint', 'PÁJARO'));
        this.num(e, 'x', () => m.bird.x, v => { m.bird.x = v; });
        this.num(e, 'y', () => m.bird.y, v => { m.bird.y = v; });
        this.num(e, 'mira °', () => deg(m.bird.yaw), v => { m.bird.yaw = rad(v); }, 15);
        this.num(e, 'vaso', () => m.bird.glass, v => { m.bird.glass = v; }, 0.02, 0);
    }

    private hangar(e: HTMLElement)
    {
        const h = this.c.doc.data.hangar;
        this.num(e, 'plazas', () => h.max, v => { h.max = Math.max(0, Math.min(6, Math.round(v))); }, 1, 0);
        const row = el('label', 'row');
        row.append(el('span', '', 'filas y'));
        const input = el('input');
        input.value = h.rows.join(', ');
        input.addEventListener('change', () => this.commit(() => { h.rows = input.value.split(',').map(Number).filter(Number.isFinite); }));
        row.append(input);
        e.append(row);
        this.num(e, 'x (pasillo)', () => h.x, v => { h.x = v; }, 0.1, 1);
        this.num(e, 'ancho', () => h.w, v => { h.w = v; }, 0.1, 0.5);
        this.num(e, 'fondo', () => h.d, v => { h.d = v; }, 0.1, 0.5);
        this.num(e, 'alto', () => h.h, v => { h.h = v; }, 0.1, 0.2);
        this.num(e, 'base z0', () => h.z0, v => { h.z0 = v; }, 0.05, 0);
    }

    private add(e: HTMLElement)
    {
        const d = this.c.doc;
        const at = () => { const [x, y] = this.c.centre(); return [clean(Math.round(x * 2) / 2), clean(Math.round(y * 2) / 2)] as const; };
        const make = (fn: (x: number, y: number) => Sel) => () => this.commit(() => { const [x, y] = at(); this.c.select(fn(x, y)); });
        const bar = el('div', 'bar wrap');
        this.button(bar, '+ CAJA', make((x, y) => ops.addProp(d.data, 'box', x, y)));
        this.button(bar, '+ CILINDRO', make((x, y) => ops.addProp(d.data, 'cyl', x, y)));
        for (const prefab of PREFABS.slice(0, 12)) this.button(bar, `+ ${prefab.name.toUpperCase()}`, make((x, y) => ops.addPrefab(d.data, prefab.id, x, y)));
        this.button(bar, '+ PUERTA', make((x, y) => ops.addPortal(d.data, x, y)));
        this.button(bar, '+ PANTALLA', make((x, y) => ops.addScreen(d.data, x, y)));
        this.button(bar, '+ LUZ', make((x, y) => ops.addLight(d.data, x, y)));
        this.button(bar, '+ SALA', make((x, y) => ops.addRoom(d.data, x, y)));
        this.button(bar, '+ CÁPSULAS', make((x, y) =>
        {
            d.data.props.push({ gen: 'pods', cx: x, cy: y, radius: 3.6 });
            return { t: 'prop', i: d.data.props.length - 1 };
        }));
        e.append(bar);
        e.append(el('div', 'hint', 'LOS OBJETOS NUEVOS APARECEN EN EL CENTRO DE LA VISTA.'));
    }

    private points(e: HTMLElement)
    {
        const d = this.c.doc.data;
        const bar = el('div', 'bar wrap');
        this.button(bar, '+ PUESTO DE SEÑALES', () => this.commit(() => { const [x, y] = this.c.centre(); d.signalSlots.push({ x: clean(x), y: clean(y), yaw: 0 }); this.c.select({ t: 'signal', i: d.signalSlots.length - 1 }); }));
        this.button(bar, '+ PUNTO DE RUTA', () => this.commit(() =>
        {
            const [x, y] = this.c.centre();
            const room = this.c.scene().rooms.find(r => pointInPoly(r.poly, x, y))?.id ?? d.rooms[0].id;
            (d.vias[room] ??= []).push([clean(x), clean(y)]);
            this.c.select({ t: 'via', room, i: d.vias[room].length - 1 });
        }));
        e.append(bar);
        e.append(el('div', 'hint', 'LAS PARADAS (◇), LOS PUNTOS DE RUTA (×) Y LOS PUESTOS DE SEÑALES (○) SE VEN CON LA CAPA «PUNTOS».'));
    }

    private issues(e: HTMLElement, issues: Issue[])
    {
        if (!issues.length) { e.append(el('div', 'hint', 'SIN AVISOS.')); return; }
        for (const i of issues)
        {
            const row = el('div', `issue ${i.level}`, `${i.level === 'error' ? '✖' : '▲'} ${i.text}`);
            row.addEventListener('click', () => { if (i.sel) this.c.select(i.sel); this.c.focus(i.x, i.y); });
            e.append(row);
        }
    }

    render(issues: Issue[])
    {
        this.root.replaceChildren();
        const errors = issues.filter(i => i.level === 'error').length;
        this.section('Selección', e => this.selection(e));
        this.section('Añadir', e => { this.add(e); this.points(e); });
        this.section('Avisos', e => this.issues(e, issues), `Avisos (${errors} errores, ${issues.length - errors} avisos)`);
        this.section('Mundo', e => this.world(e));
        this.section('Comedor', e => this.mess(e));
        this.section('Hangar', e => this.hangar(e));
    }
}
