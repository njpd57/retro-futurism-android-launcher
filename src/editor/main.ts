// Dev-only map editor (`editor.html`): draws the ship with the real engine from above and edits `ship.json`.
import { ATLAS_H, ATLAS_W, drawAtlas } from '@/ship3d/atlas';
import { loadMaterialTextures } from '@/ship3d/details';
import { createShipGL, type Palette } from '@/ship3d/gl';
import { openBottoms } from '@/ship3d/meshCheck';
import { nearestLights, packLights } from '@/ship3d/lights';
import { buildMesh } from '@/ship3d/mesh';
import { bundledPlan as bundled } from '@/ship3d/plan';
import type { ShipData } from '@/ship3d/shipData';
import { applyMaterials, packMaterialUniforms } from '@/ship3d/materials';
import type { MaterialsFile } from '@/ship3d/materialData';
import type { PrefabsFile } from '@/ship3d/prefabData';
import { applyPrefabs } from '@/ship3d/prefabs';
import { applyWorld, collisionSegments, LIGHTS, PROPS, ROOMS, roomAt, SCREENS } from '@/ship3d/world';
import { lineDiff } from './diff';
import { loadFile } from './files';
import { createMaterialsMode } from './materialsMode';
import type { Host, Mode } from './modes';
import { createPrefabsMode } from './prefabsMode';
import { Doc } from './doc';
import { overlaySvg, type Layers } from './overlay';
import { Panel } from './panel';
import { sceneOf, type Scene } from './scene';
import type { Sel } from './selection';
import { attachTools } from './tools';
import { validateWorld, type Issue } from './validate';
import { PlanView } from './view';
import { WalkMode } from './walk';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('gl');
const svg = document.getElementById('ov') as unknown as SVGSVGElement;
const stage = $('view');

// ---- what is on disk

async function loadPlan(name: string): Promise<ShipData>
{
    const res = await fetch(`/__ship/load?name=${name}`);
    if (!res.ok) throw new Error(`no se pudo abrir «${name}»`);
    return res.json();
}

async function listPlans(): Promise<string[]>
{
    try { return await (await fetch('/__ship/list')).json(); }
    catch { return ['ship']; }
}

let active = localStorage.getItem('shipEditor.active') ?? 'ship';
let initial: ShipData;
try { initial = await loadPlan(active); }
catch { active = 'ship'; initial = await loadPlan('ship').catch(() => bundled as unknown as ShipData); }

// the other two documents: what is on disk, else what was bundled
const bundledMaterials = (await import('@/ship3d/materials.json')).default as unknown as MaterialsFile;
const bundledPrefabs = (await import('@/ship3d/prefabs.json')).default as unknown as PrefabsFile;
const materialsFile = await loadFile<MaterialsFile>('materials').catch(() => bundledMaterials);
const prefabsFile = await loadFile<PrefabsFile>('prefabs').catch(() => bundledPrefabs);
applyMaterials(materialsFile);
applyPrefabs(prefabsFile);

const doc = new Doc(initial);

type Tab = 'map' | 'materials' | 'prefabs';
let tab: Tab = 'map';
const view = new PlanView();

// ---- options

const saved = (() => { try { return JSON.parse(localStorage.getItem('shipEditor.opts') ?? '{}'); } catch { return {}; } })();
const opts = { grid: 0.5, carry: true, doors: false, cut: 1.4, palette: 'amber', ...saved };
const layers: Layers = { grid: true, names: true, lamps: false, points: true, issues: true, ...(saved.layers ?? {}) };
const keep = () => { try { localStorage.setItem('shipEditor.opts', JSON.stringify({ ...opts, layers })); } catch { /* private window */ } };

// ---- the engine

const gl = createShipGL(canvas, buildMesh());
if (!gl) throw new Error('este navegador no tiene WebGL2');
const PALETTES: Record<string, Palette> = {
    amber: { ph: [1, 0.69, 0], bg: [0.02, 0.015, 0] },
    green: { ph: [0.2, 1, 0.4], bg: [0, 0.02, 0.005] },
};
const atlas = document.createElement('canvas');
atlas.width = ATLAS_W;
atlas.height = ATLAS_H;

function paintAtlas()
{
    const ctx = atlas.getContext('2d')!;
    const p = PALETTES[opts.palette] ?? PALETTES.amber;
    const css = (c: readonly number[]) => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
    drawAtlas(ctx, SCREENS.map(s => ({ id: s.id, lines: s.id.toUpperCase().split('.'), level: 'idle' as const })), css(p.ph), css(p.bg), 'monospace', false);
    gl!.setAtlas(atlas);
}

void loadMaterialTextures(gl, '/', () => requestRender());

// ---- state

let scene: Scene = sceneOf(doc.data);
let issues: Issue[] = [];
let sel: Sel | null = null;
let rebuildTimer = 0;
let queued = false;
let meshInfo = '';
/** what the built mesh says is wrong, beside what the data says */
let meshIssues: Issue[] = [];
// defined further down; the textures can load before that
let walkMode: WalkMode | undefined;

function setPalette()
{
    gl!.setPalette(PALETTES[opts.palette] ?? PALETTES.amber);
    paintAtlas();
}

function requestRender()
{
    if (queued || walkMode?.active || tab !== 'map') return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderGL(); });
}

function renderGL()
{
    if (!gl) return;
    const idx = nearestLights(LIGHTS, view.x, view.y, opts.cut);
    gl.render({
        eye: [view.x, opts.cut, view.y], yaw: 0, pitch: 0, lights: packLights(LIGHTS, idx), time: 0,
        doors: Array.from({ length: 16 }, () => (opts.doors ? 1 : 0)), sweep: -1000, holo: 0, grain: 0, edge: 0.5,
        top: { x: view.x, y: view.y, half: view.half, cut: opts.cut },
    });
}

function drawOverlay()
{
    if (tab !== 'map') return;
    svg.setAttribute('viewBox', `0 0 ${view.width} ${view.height}`);
    svg.innerHTML = overlaySvg(scene, doc.data, view, sel, layers, issues);
}

/** The data is final for now: rebuild the 3D at once instead of waiting. */
function settle()
{
    clearTimeout(rebuildTimer);
    rebuild();
}

function rebuild()
{
    // the ship's mesh is not on the screen while another tab holds the engine; it is rebuilt when the tab comes back
    if (tab !== 'map') return;
    try
    {
        const t = performance.now();
        applyWorld(structuredClone(doc.data));
        const mesh = buildMesh();
        gl!.setMesh(mesh);
        paintAtlas();
        meshInfo = `${mesh.vertices} vértices · ${(performance.now() - t).toFixed(0)} ms`;
        meshIssues = [...openBottoms(mesh).byMaterial].map(([mat, o]): Issue => ({
            level: 'error', text: `SÓLIDO ABIERTO POR DEBAJO (${mat} ×${o.n}); SE VE A TRAVÉS DESDE ABAJO`, x: o.at[0], y: o.at[2],
        }));
        issues = [...validateWorld(doc.data, scene), ...meshIssues];
        if (!panel.busy) panel.render(issues);
        drawOverlay();
        requestRender();
    }
    catch (e)
    {
        meshInfo = `ERROR AL CONSTRUIR: ${e instanceof Error ? e.message : String(e)}`;
    }
    updateHud();
}

function refresh()
{
    if (walkMode?.active) return;
    drawOverlay();
    requestRender();
}

let coords = '';
function updateHud() { $('hud').textContent = `${coords}\n${meshInfo}`; }

function select(next: Sel | null)
{
    sel = next;
    panel.render(issues);
    drawOverlay();
}

// ---- panel and tools

const panel = new Panel($('panel'), {
    doc,
    sel: () => sel,
    select,
    scene: () => scene,
    settle,
    centre: () => [view.x, view.y],
    focus: (x, y) => { view.x = x; view.y = y; view.half = Math.min(view.half, 14); refresh(); },
});

attachTools({
    doc, view, svg,
    enabled: () => tab === 'map',
    sel: () => sel,
    select,
    scene: () => scene,
    grid: () => opts.grid,
    carry: () => opts.carry,
    settle,
    refresh,
    status: t => { coords = t; updateHud(); },
});

doc.onChange(() =>
{
    scene = sceneOf(doc.data);
    issues = [...validateWorld(doc.data, scene), ...meshIssues];
    // an index may point past the end after an undo
    if (sel && !exists(sel)) sel = null;
    drawOverlay();
    requestRender();
    clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(rebuild, 450);
    if (!panel.busy) panel.render(issues);
    renderFile();
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 600);
});

function exists(s: Sel): boolean
{
    const d = doc.data;
    switch (s.t)
    {
        case 'room': return !!d.rooms[s.i];
        case 'portal': return !!d.portals[s.i];
        case 'prop': return !!d.props[s.i];
        case 'screen': return !!d.screens[s.i];
        case 'light': return !!d.extraLights[s.i];
        case 'stand': return !!d.stands[s.room];
        case 'via': return !!d.vias[s.room]?.[s.i];
        case 'signal': return !!d.signalSlots[s.i];
    }
}

// ---- drafts, so a closed tab loses nothing

let draftTimer = 0;
const draftKey = () => `shipEditor.draft.${active}`;
function saveDraft()
{
    try { if (doc.dirty) localStorage.setItem(draftKey(), doc.text); else localStorage.removeItem(draftKey()); } catch { /* full or private */ }
}

window.addEventListener('beforeunload', e => { if (doc.dirty) { saveDraft(); e.preventDefault(); } });

// ---- the file bar

const file = $('file');
let plans = await listPlans();
let message = '';

function renderFile()
{
    file.replaceChildren();
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = `PLAN: ${active}${doc.dirty ? '  ● SIN GUARDAR' : ''}`;
    file.append(title);

    const bar = (...items: HTMLElement[]) => { const b = document.createElement('div'); b.className = 'bar'; b.append(...items); file.append(b); };
    const btn = (label: string, run: () => void, disabled = false) =>
    {
        const b = document.createElement('button');
        b.textContent = label;
        b.disabled = disabled;
        b.addEventListener('click', run);
        return b;
    };

    bar(
        btn('GUARDAR', () => void save(active), !doc.dirty),
        btn('DESHACER', () => { doc.undo(); settle(); }, !doc.canUndo),
        btn('REHACER', () => { doc.redo(); settle(); }, !doc.canRedo),
        btn('CAMBIOS', showDiff, !doc.dirty),
    );

    const select = document.createElement('select');
    for (const p of plans) select.append(new Option(p, p, false, p === active));
    bar(
        select,
        btn('ABRIR', () => void open(select.value)),
        btn('GUARDAR COMO…', () =>
        {
            const name = prompt('Nombre de la variante (a-z, 0-9, - y _):', active === 'ship' ? '' : active)?.trim();
            if (name) void saveAs(name);
        }),
    );
    bar(
        btn('DESCARGAR', download),
        btn('CARGAR ARCHIVO', () => $<HTMLInputElement>('upload').click()),
    );
    if (message)
    {
        const m = document.createElement('div');
        m.className = 'hint';
        m.textContent = message;
        file.append(m);
    }
}

async function save(name: string)
{
    const res = await fetch(`/__ship/save?name=${name}`, { method: 'POST', body: doc.text });
    if (!res.ok) { message = `NO SE PUDO GUARDAR: ${await res.text()}`; renderFile(); return; }
    doc.markSaved();
    saveDraft();
    message = name === 'ship'
        ? 'GUARDADO EN src/ship3d/plan/. RECARGA EL LAUNCHER PARA VERLO ALLÍ.'
        : `GUARDADO EN src/ship3d/variants/${name}.json (EL LAUNCHER SOLO CARGA plan/).`;
    renderFile();
}

async function saveAs(name: string)
{
    if (!/^[a-z0-9_-]{1,40}$/.test(name)) { message = 'NOMBRE NO VÁLIDO'; renderFile(); return; }
    active = name;
    localStorage.setItem('shipEditor.active', name);
    await save(name);
    plans = await listPlans();
    renderFile();
}

async function open(name: string)
{
    if (doc.dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    try
    {
        const data = await loadPlan(name);
        active = name;
        localStorage.setItem('shipEditor.active', name);
        sel = null;
        doc.replace(data);
        message = '';
        settle();
    }
    catch (e) { message = String(e); renderFile(); }
}

function download()
{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([doc.text], { type: 'application/json' }));
    a.download = `${active}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

const upload = document.createElement('input');
upload.type = 'file';
upload.accept = 'application/json,.json';
upload.id = 'upload';
upload.hidden = true;
upload.addEventListener('change', async () =>
{
    const f = upload.files?.[0];
    upload.value = '';
    if (!f) return;
    try
    {
        const data = JSON.parse(await f.text());
        if (!Array.isArray(data.rooms) || !Array.isArray(data.props)) throw new Error('no parece un plan de la nave');
        doc.checkpoint();
        doc.data = data;
        sel = null;
        doc.touch();
        settle();
    }
    catch (e) { message = `NO SE PUDO CARGAR: ${e}`; renderFile(); }
});
document.body.append(upload);

function showDiff()
{
    const dialog = $<HTMLDialogElement>('diff');
    const pre = dialog.querySelector('pre')!;
    pre.replaceChildren();
    const lines = lineDiff(doc.savedText, doc.text);
    for (const l of lines)
    {
        const span = document.createElement('div');
        span.className = l.kind === '+' ? 'add' : l.kind === '-' ? 'del' : 'ctx';
        span.textContent = `${l.kind} ${l.text}`;
        pre.append(span);
    }
    if (!lines.length) pre.textContent = 'SIN CAMBIOS';
    dialog.showModal();
}

// ---- first person

let segs = collisionSegments(ROOMS, PROPS);
const walk = (walkMode = new WalkMode({
    canvas,
    gl,
    segs: () => segs,
    hud: t => { $('hud').textContent = t; },
    onExit: (x, y) =>
    {
        svg.style.display = '';
        $('walk-hint').style.display = 'none';
        view.x = x;
        view.y = y;
        updateHud();
        refresh();
        requestRender();
    },
}));

function startWalk()
{
    settle();
    segs = collisionSegments(ROOMS, PROPS);
    const free = roomAt(view.x, view.y) && !segs.some(s => Math.hypot(s.ax - view.x, s.ay - view.y) < 0.3);
    const s = doc.data.start;
    svg.style.display = 'none';
    $('walk-hint').style.display = 'block';
    if (free) walk.start(view.x, view.y, s.yaw);
    else walk.start(s.x, s.y, s.yaw);
}

window.addEventListener('keydown', e =>
{
    if (tab !== 'map' || walk.active || (e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Tab') { e.preventDefault(); startWalk(); }
});

// ---- the toolbar over the view

const tools = $('tools');
function toolbar()
{
    const check = (label: string, get: () => boolean, set: (v: boolean) => void) =>
    {
        const l = document.createElement('label');
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.checked = get();
        i.addEventListener('change', () => { set(i.checked); keep(); refresh(); });
        l.append(i, label);
        tools.append(l);
    };
    const gridSel = document.createElement('select');
    for (const g of [0, 0.1, 0.25, 0.5, 1]) gridSel.append(new Option(g ? `imán ${g} m` : 'sin imán', String(g), false, g === opts.grid));
    gridSel.addEventListener('change', () => { opts.grid = Number(gridSel.value); keep(); });
    tools.append(gridSel);
    check('rejilla', () => layers.grid, v => { layers.grid = v; });
    check('nombres', () => layers.names, v => { layers.names = v; });
    check('lámparas', () => layers.lamps, v => { layers.lamps = v; });
    check('puntos', () => layers.points, v => { layers.points = v; });
    check('avisos', () => layers.issues, v => { layers.issues = v; });
    check('mover sala con su contenido', () => opts.carry, v => { opts.carry = v; });
    check('puertas abiertas', () => opts.doors, v => { opts.doors = v; });

    const cut = document.createElement('label');
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0.3';
    range.max = '8';
    range.step = '0.1';
    range.value = String(opts.cut);
    const cutText = document.createElement('span');
    cutText.textContent = `corte ${opts.cut} m`;
    range.addEventListener('input', () => { opts.cut = Number(range.value); cutText.textContent = `corte ${opts.cut} m`; keep(); requestRender(); });
    cut.append(cutText, range);
    tools.append(cut);

    const pal = document.createElement('select');
    for (const p of Object.keys(PALETTES)) pal.append(new Option(p, p, false, p === opts.palette));
    pal.addEventListener('change', () => { opts.palette = pal.value; keep(); setPalette(); requestRender(); });
    tools.append(pal);

    const go = document.createElement('button');
    go.textContent = 'RECORRER (TAB)';
    go.addEventListener('click', startWalk);
    tools.append(go);

    const fit = document.createElement('button');
    fit.textContent = 'ENCUADRAR';
    fit.addEventListener('click', frame);
    tools.append(fit);
}

function frame()
{
    const xs = scene.rooms.flatMap(r => r.poly.map(p => p[0]));
    const ys = scene.rooms.flatMap(r => r.poly.map(p => p[1]));
    view.fit(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    refresh();
}

// ---- go

new ResizeObserver(() =>
{
    const r = stage.getBoundingClientRect();
    view.resize(r.width, r.height);
    gl.resize(Math.min(window.devicePixelRatio || 1, 2));
    if (tab === 'map') refresh();
    else modes[tab].render();
}).observe(stage);

toolbar();
setPalette();
issues = validateWorld(doc.data, scene);
const draft = (() => { try { return localStorage.getItem(draftKey()); } catch { return null; } })();
if (draft && draft !== doc.text && confirm('Hay un borrador sin guardar de este plan. ¿Recuperarlo?'))
{
    try { doc.replace(JSON.parse(draft), false); } catch { /* a broken draft is ignored */ }
}
// ---- the tabs

const host: Host = {
    gl,
    canvas,
    stage,
    hud: t => { $('hud').textContent = t; },
    changed: () => updateTabs(),
    mapProp: () =>
    {
        const e = sel?.t === 'prop' ? doc.data.props[sel.i] : undefined;
        return e && 'kind' in e ? structuredClone(e) : null;
    },
    prefabUses: id => doc.data.props.filter(e => 'prefab' in e && e.prefab === id).length,
    renamePrefab: (from, to) =>
    {
        if (!doc.data.props.some(e => 'prefab' in e && e.prefab === from)) return;
        doc.checkpoint();
        for (const e of doc.data.props) if ('prefab' in e && e.prefab === from) e.prefab = to;
        doc.touch();
    },
};

const modes: Record<'materials' | 'prefabs', Mode> = {
    materials: createMaterialsMode(host, materialsFile),
    prefabs: createPrefabsMode(host, prefabsFile),
};

const TAB_NAMES: Record<Tab, string> = { map: 'MAPA', materials: 'MATERIALES', prefabs: 'PREFABS' };
const tabsBar = $('tabs');

function updateTabs()
{
    tabsBar.replaceChildren();
    for (const t of Object.keys(TAB_NAMES) as Tab[])
    {
        const b = document.createElement('button');
        const dirty = t === 'map' ? doc.dirty : modes[t].dirty;
        b.textContent = `${TAB_NAMES[t]}${dirty ? ' ●' : ''}`;
        if (t === tab) b.className = 'on';
        b.addEventListener('click', () => setTab(t));
        tabsBar.append(b);
    }
}

function setTab(next: Tab)
{
    if (next === tab) return;
    if (tab === 'map') walk.stop();
    else modes[tab].deactivate();
    tab = next;
    $('hud').textContent = '';
    $('tools').hidden = next !== 'map';
    $('side-map').hidden = next !== 'map';
    svg.style.display = next === 'map' ? '' : 'none';
    if (next === 'map')
    {
        // the materials, prefabs and styles may have changed: expand the plan again and rebuild the ship
        scene = sceneOf(doc.data);
        issues = [...validateWorld(doc.data, scene), ...meshIssues];
        gl!.setMaterials(packMaterialUniforms());
        settle();
        panel.render(issues);
        refresh();
    }
    else modes[next].activate();
    updateTabs();
}

doc.onChange(updateTabs);

rebuild();
frame();
panel.render(issues);
renderFile();
updateTabs();
(window as unknown as { editor: object }).editor = { setTab, modes, doc, view, get scene() { return scene; }, get issues() { return issues; }, get sel() { return sel; } };
