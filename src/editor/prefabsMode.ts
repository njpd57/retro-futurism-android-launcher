import { MATERIALS } from '@/ship3d/materials';
import { rayBox, type V3 } from '@/ship3d/math';
import { rayCylinder } from '@/ship3d/math';
import type { Prefab, PrefabPart, PrefabsFile } from '@/ship3d/prefabData';
import { applyPrefabs } from '@/ship3d/prefabs';
import { prefabProps } from '@/ship3d/world';
import { clean } from './geometry';
import { lineDiff } from './diff';
import { Doc } from './doc';
import { loadFile, saveFile } from './files';
import { button, checkInput, field, h, numberInput, selectInput, textInput, type Host, type Mode } from './modes';
import { Orbit, prefabMesh, renderPreview } from './preview';

const AXES: { name: string; dir: V3; color: string }[] = [
    { name: 'x', dir: [1, 0, 0], color: '#ff6a5a' },
    { name: 'y', dir: [0, 0, 1], color: '#7dff7d' },
    { name: 'z', dir: [0, 1, 0], color: '#7de0ff' },
];

const NONE = '(el del tipo)';

/** A rough count of the vertices one part adds to the mesh. */
const vertsOf = (p: PrefabPart) => (p.kind === 'cyl' ? 16 * 6 + 14 * 3 : 36) + ((p.z0 ?? 0) > 0 ? (p.kind === 'cyl' ? 42 : 6) : 0);

export function createPrefabsMode(host: Host, saved: PrefabsFile): Mode
{
    const doc = new Doc<PrefabsFile>(saved);
    const side = document.getElementById('side-prefabs')!;
    const tools = document.getElementById('tools-prefabs')!;
    const svg = document.getElementById('ov-prefabs') as unknown as SVGSVGElement;
    const orbit = new Orbit();
    orbit.target = [0, 0.9, 0];
    orbit.dist = 5;
    let pi = 0;
    let part = -1;
    let message = '';
    let active = false;

    const prefab = (): Prefab | undefined => doc.data.prefabs[pi];
    const current = (): PrefabPart | undefined => prefab()?.parts[part];

    function apply() { applyPrefabs(doc.data); }

    function commit(fn: () => void)
    {
        doc.checkpoint();
        fn();
        apply();
        doc.touch();
    }

    // ---- the view

    const size = () => { const r = svg.getBoundingClientRect(); return { w: Math.max(1, r.width), h: Math.max(1, r.height) }; };

    function centreOf(p: PrefabPart): V3 { return [p.x, (p.z0 ?? 0) + p.h / 2, p.y]; }

    /** The gizmo's handles in pixels: where each axis starts, ends and how many pixels a metre is along it. */
    function gizmo(p: PrefabPart)
    {
        const { w, h: hh } = size();
        const c = centreOf(p);
        const len = orbit.dist * 0.16;
        const a = orbit.project(c, w, hh);
        if (!a) return null;
        return AXES.map(ax =>
        {
            const tip = orbit.project([c[0] + ax.dir[0] * len, c[1] + ax.dir[1] * len, c[2] + ax.dir[2] * len], w, hh);
            if (!tip) return null;
            const d = [tip[0] - a[0], tip[1] - a[1]];
            return { ...ax, from: a, to: tip, pxPerMetre: Math.hypot(d[0], d[1]) / len, unit: [d[0] / (Math.hypot(d[0], d[1]) || 1), d[1] / (Math.hypot(d[0], d[1]) || 1)] };
        });
    }

    /** The outline of a part, as segments of its box (or its two circles), in pixels. */
    function outline(p: PrefabPart): string
    {
        const { w, h: hh } = size();
        const z0 = p.z0 ?? 0;
        const path = (pts: V3[], close = true) =>
        {
            const q = pts.map(v => orbit.project(v, w, hh));
            if (q.some(v => !v)) return '';
            return `M${(q as number[][]).map(v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join('L')}${close ? 'Z' : ''}`;
        };
        if (p.kind === 'cyl')
        {
            const ring = (z: number) => Array.from({ length: 20 }, (_, k): V3 => [p.x + (p.w / 2) * Math.cos((k * Math.PI * 2) / 20), z, p.y + (p.w / 2) * Math.sin((k * Math.PI * 2) / 20)]);
            return path(ring(z0)) + path(ring(z0 + p.h));
        }
        const c = Math.cos(p.yaw ?? 0);
        const s = Math.sin(p.yaw ?? 0);
        const d = p.d ?? p.w;
        const at = (u: number, v: number, z: number): V3 => [p.x + u * c - v * s, z, p.y + u * s + v * c];
        const lo = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at((u * p.w) / 2, (v * d) / 2, z0));
        const hi = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => at((u * p.w) / 2, (v * d) / 2, z0 + p.h));
        return path(lo) + path(hi) + lo.map((q, k) => path([q, hi[k]], false)).join('');
    }

    function overlay()
    {
        const { w, h: hh } = size();
        svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
        const p = current();
        let out = '';
        if (p)
        {
            out += `<path d="${outline(p)}" fill="none" stroke="#fff" stroke-width="2"/>`;
            for (const g of gizmo(p) ?? [])
                if (g) out += `<line x1="${g.from[0]}" y1="${g.from[1]}" x2="${g.to[0]}" y2="${g.to[1]}" stroke="${g.color}" class="axis" data-axis="${g.name}"/><circle cx="${g.to[0]}" cy="${g.to[1]}" r="7" fill="${g.color}" class="tip" data-axis="${g.name}"/>`;
        }
        svg.innerHTML = out;
    }

    function rebuildMesh()
    {
        const f = prefab();
        host.gl.setMesh(prefabMesh(f ? prefabProps(f, 0, 0, 0) : []));
    }

    function draw()
    {
        if (!active) return;
        renderPreview(host.gl, orbit);
        overlay();
    }

    // ---- picking and dragging

    let down: { x: number; y: number; moved: boolean } | null = null;
    type Handle = { name: string; unit: number[]; pxPerMetre: number };
    let drag: { axis: number; start: number; from: [number, number]; g: Handle; first: boolean } | null = null;

    function pick(px: number, py: number)
    {
        const f = prefab();
        if (!f) return;
        const { w, h: hh } = size();
        const ray = orbit.ray(w, hh, px, py);
        let best = Infinity;
        let found = -1;
        f.parts.forEach((p, i) =>
        {
            const z0 = p.z0 ?? 0;
            const t = p.kind === 'cyl'
                ? rayCylinder(ray, p.x, p.y, p.w / 2, z0, z0 + p.h)
                : rayBox(ray, centreOf(p), [p.w / 2, p.h / 2, (p.d ?? p.w) / 2], p.yaw ?? 0);
            if (t !== null && t < best) { best = t; found = i; }
        });
        part = found;
        render();
        draw();
    }

    svg.addEventListener('pointerdown', e =>
    {
        const r = svg.getBoundingClientRect();
        const [px, py] = [e.clientX - r.left, e.clientY - r.top];
        const axisName = (e.target as Element).getAttribute('data-axis');
        const p = current();
        if (axisName && p)
        {
            const g = (gizmo(p) ?? []).find((a): a is NonNullable<typeof a> => a?.name === axisName);
            if (g)
            {
                const axis = AXES.findIndex(a => a.name === axisName);
                drag = { axis, start: axis === 0 ? p.x : axis === 1 ? p.y : p.z0 ?? 0, from: [px, py], g, first: true };
                svg.setPointerCapture(e.pointerId);
                e.stopPropagation();
                return;
            }
        }
        down = { x: px, y: py, moved: false };
    });
    svg.addEventListener('pointermove', e =>
    {
        const r = svg.getBoundingClientRect();
        const [px, py] = [e.clientX - r.left, e.clientY - r.top];
        if (down && Math.hypot(px - down.x, py - down.y) > 4) down.moved = true;
        if (!drag) return;
        const p = current();
        if (!p) return;
        const along = ((px - drag.from[0]) * drag.g.unit[0] + (py - drag.from[1]) * drag.g.unit[1]) / drag.g.pxPerMetre;
        const step = e.shiftKey ? 0.01 : 0.05;
        const v = clean(Math.round((drag.start + along) / step) * step);
        if (drag.first) { doc.checkpoint(); drag.first = false; }
        if (drag.axis === 0) p.x = v;
        else if (drag.axis === 1) p.y = v;
        else if (v > 0) p.z0 = v; else delete p.z0;
        apply();
        doc.touch();
    });
    const end = (e: PointerEvent) =>
    {
        if (drag) { drag = null; if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); return; }
        if (down && !down.moved) pick(down.x, down.y);
        down = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', () => { down = null; drag = null; });
    orbit.attach(svg, draw, e => !(e.target as Element).closest('[data-axis]'));

    window.addEventListener('keydown', e =>
    {
        if (!active || (e.target as HTMLElement).closest('input, select, textarea')) return;
        const mod = e.metaKey || e.ctrlKey;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); apply(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePart(); }
        else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicatePart(); }
    });

    // ---- the side panel

    function section(title: string, body: (e: HTMLElement) => void, open = true)
    {
        const d = h('details');
        d.open = open;
        d.append(h('summary', '', title));
        const inner = h('div', 'stack');
        body(inner);
        d.append(inner);
        side.append(d);
    }

    function issues(): { level: 'error' | 'warn'; text: string }[]
    {
        const out: { level: 'error' | 'warn'; text: string }[] = [];
        const ids = new Set<string>();
        for (const f of doc.data.prefabs)
        {
            if (!f.id) out.push({ level: 'error', text: 'UN PREFAB SIN ID' });
            if (ids.has(f.id)) out.push({ level: 'error', text: `ID DE PREFAB REPETIDO: ${f.id}` });
            ids.add(f.id);
            if (!f.parts.length) out.push({ level: 'warn', text: `${f.id}: NO TIENE PARTES` });
            const verts = f.parts.reduce((s, p) => s + vertsOf(p), 0);
            if (verts > 1500) out.push({ level: 'warn', text: `${f.id}: ~${verts} VÉRTICES POR INSTANCIA (LA NAVE TIENE ~68000)` });
            for (const p of f.parts)
                if (p.material && !MATERIALS.some(m => m.id === p.material)) out.push({ level: 'error', text: `${f.id}: MATERIAL QUE NO EXISTE: ${p.material}` });
        }
        return out;
    }

    function render()
    {
        const keepScroll = side.scrollTop;
        side.replaceChildren();
        side.append(h('div', 'title', `PREFABS${doc.dirty ? '  ● SIN GUARDAR' : ''}`));
        const bar = h('div', 'tabbar');
        bar.append(
            button('GUARDAR', () => void save(), '', !doc.dirty),
            button('DESHACER', () => { doc.undo(); apply(); }, '', !doc.canUndo),
            button('REHACER', () => { doc.redo(); apply(); }, '', !doc.canRedo),
            button('CAMBIOS', diff, '', !doc.dirty),
        );
        side.append(bar);
        if (message) side.append(h('div', 'hint', message));

        section('Prefabs', e =>
        {
            const list = h('div', 'listing');
            doc.data.prefabs.forEach((f, i) =>
            {
                const item = h('div', `item${i === pi ? ' on' : ''}`);
                item.append(h('span', '', f.name || f.id), h('span', 'dim', `${f.parts.length} partes · ${host.prefabUses(f.id)} en el mapa`));
                item.addEventListener('click', () => { pi = i; part = -1; render(); rebuildMesh(); draw(); });
                list.append(item);
            });
            if (!doc.data.prefabs.length) list.append(h('div', 'hint', 'NO HAY PREFABS. CREA UNO, O CONVIERTE UN OBJETO DEL MAPA.'));
            e.append(list);
            const row = h('div', 'bar wrap');
            row.append(
                button('+ PREFAB', () => commit(() =>
                {
                    let n = 1;
                    while (doc.data.prefabs.some(f => f.id === `prefab-${n}`)) n++;
                    doc.data.prefabs.push({ id: `prefab-${n}`, name: `Prefab ${n}`, parts: [{ kind: 'box', x: 0, y: 0, w: 1, d: 1, h: 1 }] });
                    pi = doc.data.prefabs.length - 1;
                    part = 0;
                })),
                button('DUPLICAR', () => commit(() =>
                {
                    const f = prefab();
                    if (!f) return;
                    let n = 1;
                    while (doc.data.prefabs.some(q => q.id === `${f.id}-${n}`)) n++;
                    doc.data.prefabs.push({ ...structuredClone(f), id: `${f.id}-${n}`, name: `${f.name} ${n}` });
                    pi = doc.data.prefabs.length - 1;
                }), '', !prefab()),
                button('DESDE OBJETO DEL MAPA', fromMap),
                button('BORRAR', removePrefab, 'danger', !prefab()),
            );
            e.append(row);
        });

        const f = prefab();
        if (f)
        {
            section(`Prefab ${f.id}`, e =>
            {
                e.append(
                    field('id', textInput(f.id, v => commit(() =>
                    {
                        const id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                        if (!id || doc.data.prefabs.some(q => q !== f && q.id === id)) return;
                        host.renamePrefab(f.id, id);
                        f.id = id;
                    }))),
                    field('nombre', textInput(f.name, v => commit(() => { f.name = v; }))),
                );
                e.append(h('div', 'hint', `~${f.parts.reduce((s, p) => s + vertsOf(p), 0)} VÉRTICES POR INSTANCIA. EN EL MAPA SE COLOCA CON «+ ${f.name.toUpperCase()}».`));
            });

            section('Partes', e =>
            {
                const list = h('div', 'listing');
                f.parts.forEach((p, i) =>
                {
                    const item = h('div', `item${i === part ? ' on' : ''}`);
                    item.append(h('span', '', `${i} ${p.kind === 'box' ? 'caja' : 'cilindro'}`), h('span', 'dim', p.kind === 'box' ? `${p.w}×${p.d ?? p.w}×${p.h}` : `⌀${p.w}×${p.h}`));
                    item.addEventListener('click', () => { part = i; render(); draw(); });
                    list.append(item);
                });
                e.append(list);
                const row = h('div', 'bar wrap');
                row.append(
                    button('+ CAJA', () => addPart('box')),
                    button('+ CILINDRO', () => addPart('cyl')),
                    button('DUPLICAR', duplicatePart, '', !current()),
                    button('BORRAR', removePart, 'danger', !current()),
                );
                e.append(row);
            });

            const p = current();
            if (p)
                section(`Parte ${part}`, e =>
                {
                    const num = (label: string, get: () => number, set: (v: number) => void, step = 0.05, min?: number) =>
                        e.append(field(label, numberInput(get(), v => commit(() => set(v)), step, min)));
                    num('x', () => p.x, v => { p.x = v; });
                    num('y', () => p.y, v => { p.y = v; });
                    num('base z0', () => p.z0 ?? 0, v => { if (v) p.z0 = v; else delete p.z0; }, 0.05, 0);
                    num(p.kind === 'box' ? 'ancho' : 'diámetro', () => p.w, v => { p.w = v; }, 0.05, 0.02);
                    if (p.kind === 'box') num('fondo', () => p.d ?? p.w, v => { p.d = v; }, 0.05, 0.02);
                    num('alto', () => p.h, v => { p.h = v; }, 0.05, 0.02);
                    if (p.kind === 'box') num('giro °', () => clean(((p.yaw ?? 0) * 180) / Math.PI), v => { if (v) p.yaw = (v * Math.PI) / 180; else delete p.yaw; }, 5);
                    num('brillo', () => p.glow ?? 0, v => { if (v) p.glow = Math.min(1, Math.max(0, v)); else delete p.glow; }, 0.05, 0);
                    e.append(
                        field('material', selectInput([NONE, ...MATERIALS.map(m => m.id)], p.material ?? NONE, v => commit(() => { if (v === NONE) delete p.material; else p.material = v; }))),
                        field('sólido', checkInput(p.solid ?? true, v => commit(() => { if (v) delete p.solid; else p.solid = false; }))),
                    );
                    e.append(h('div', 'hint', 'ARRASTRA LAS FLECHAS DEL VISOR PARA MOVER (MAYÚS = FINO). CLIC EN UNA PARTE PARA ELEGIRLA.'));
                });
        }

        const list = issues();
        const errors = list.filter(i => i.level === 'error').length;
        section(`Avisos (${errors} errores, ${list.length - errors} avisos)`, e =>
        {
            if (!list.length) e.append(h('div', 'hint', 'SIN AVISOS.'));
            for (const i of list) e.append(h('div', `issue ${i.level}`, `${i.level === 'error' ? '✖' : '▲'} ${i.text}`));
        }, false);
        side.scrollTop = keepScroll;
    }

    // ---- actions

    function addPart(kind: 'box' | 'cyl')
    {
        commit(() =>
        {
            const f = prefab();
            if (!f) return;
            f.parts.push(kind === 'box' ? { kind, x: 0, y: 0, w: 0.6, d: 0.6, h: 0.6 } : { kind, x: 0, y: 0, w: 0.6, h: 0.6 });
            part = f.parts.length - 1;
        });
    }

    function duplicatePart()
    {
        const f = prefab();
        const p = current();
        if (!f || !p) return;
        commit(() => { f.parts.splice(part + 1, 0, { ...structuredClone(p), x: clean(p.x + 0.2), y: clean(p.y + 0.2) }); part += 1; });
    }

    function removePart()
    {
        const f = prefab();
        if (!f || !current()) return;
        commit(() => { f.parts.splice(part, 1); part = Math.min(part, f.parts.length - 1); });
    }

    function removePrefab()
    {
        const f = prefab();
        if (!f) return;
        const uses = host.prefabUses(f.id);
        if (uses) { message = `NO SE PUEDE BORRAR «${f.id}»: HAY ${uses} INSTANCIA(S) EN EL MAPA. DESAGRÚPALAS O BÓRRALAS ANTES.`; render(); return; }
        message = '';
        commit(() => { doc.data.prefabs.splice(pi, 1); pi = Math.max(0, pi - 1); part = -1; });
    }

    function fromMap()
    {
        const src = host.mapProp();
        if (!src) { message = 'SELECCIONA UNA CAJA O UN CILINDRO EN LA PESTAÑA MAPA.'; render(); return; }
        message = '';
        commit(() =>
        {
            let n = 1;
            while (doc.data.prefabs.some(f => f.id === `objeto-${n}`)) n++;
            const { x: _x, y: _y, keyboard: _k, ...rest } = src;
            doc.data.prefabs.push({ id: `objeto-${n}`, name: `Objeto ${n}`, parts: [{ ...rest, x: 0, y: 0 }] });
            pi = doc.data.prefabs.length - 1;
            part = 0;
        });
    }

    async function save()
    {
        const problem = await saveFile('prefabs', doc.text);
        if (problem) { message = `NO SE PUDO GUARDAR: ${problem}`; render(); return; }
        doc.markSaved();
        message = 'GUARDADO EN src/ship3d/prefabs.json. RECARGA EL LAUNCHER PARA VERLO ALLÍ.';
        render();
    }

    function diff()
    {
        const dialog = document.getElementById('diff') as HTMLDialogElement;
        const pre = dialog.querySelector('pre')!;
        pre.replaceChildren();
        const lines = lineDiff(doc.savedText, doc.text);
        for (const l of lines) pre.append(h('div', l.kind === '+' ? 'add' : l.kind === '-' ? 'del' : 'ctx', `${l.kind} ${l.text}`));
        if (!lines.length) pre.textContent = 'SIN CAMBIOS';
        dialog.showModal();
    }

    doc.onChange(() =>
    {
        pi = Math.min(pi, Math.max(0, doc.data.prefabs.length - 1));
        if (part >= (prefab()?.parts.length ?? 0)) part = -1;
        host.changed();
        if (!active) return;
        if (!drag && !(document.activeElement instanceof HTMLInputElement && side.contains(document.activeElement))) render();
        rebuildMesh();
        draw();
    });
    window.addEventListener('beforeunload', e => { if (doc.dirty) e.preventDefault(); });

    tools.append(h('span', '', 'ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR · CLIC EN UNA PARTE PARA ELEGIRLA'), button('REINICIAR CÁMARA', () => { orbit.azimuth = 0.6; orbit.elevation = 0.45; orbit.dist = 5; draw(); }));

    return {
        get dirty() { return doc.dirty; },
        activate()
        {
            active = true;
            side.hidden = false;
            tools.hidden = false;
            svg.style.display = '';
            apply();
            render();
            rebuildMesh();
            draw();
        },
        deactivate()
        {
            active = false;
            side.hidden = true;
            tools.hidden = true;
            svg.style.display = 'none';
        },
        render: draw,
    };
}

export async function loadPrefabsFile(): Promise<PrefabsFile>
{
    return loadFile<PrefabsFile>('prefabs');
}
