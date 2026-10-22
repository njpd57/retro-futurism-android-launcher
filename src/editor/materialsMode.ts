import { loadMaterialTextures } from '@/ship3d/details';
import { applyMaterials, MATERIALS, MAX_MATERIALS, MAX_STYLES, MAX_TEXTURES, packMaterialUniforms } from '@/ship3d/materials';
import { KINDS, type MaterialData, type MaterialsFile } from '@/ship3d/materialData';
import { DETAIL_SIZE } from '@/ship3d/materials';
import { packDetail } from '@/ship3d/texturePack';
import { PREFABS } from '@/ship3d/prefabs';
import { PROPS } from '@/ship3d/world';
import { lineDiff } from './diff';
import { Doc } from './doc';
import { listTextures, loadFile, saveFile, uploadTexture, type TextureInfo } from './files';
import { button, checkInput, field, h, numberInput, selectInput, textInput, type Host, type Mode } from './modes';
import { materialSampleMesh, Orbit, renderPreview } from './preview';

const NAME = /^[a-z0-9_-]{1,40}$/;

/** Problems with the materials, worst first. */
export function materialIssues(data: MaterialsFile, textures: readonly TextureInfo[]): { level: 'error' | 'warn'; text: string }[]
{
    const out: { level: 'error' | 'warn'; text: string }[] = [];
    const err = (text: string) => out.push({ level: 'error', text });
    const warn = (text: string) => out.push({ level: 'warn', text });
    if (data.materials.length > MAX_MATERIALS) err(`HAY ${data.materials.length} MATERIALES Y EL SHADER ADMITE ${MAX_MATERIALS}`);
    if (data.textures.length > MAX_TEXTURES) err(`HAY ${data.textures.length} TEXTURAS Y EL MÁXIMO ES ${MAX_TEXTURES}`);
    if (data.styles.length > MAX_STYLES) err(`HAY ${data.styles.length} ESTILOS Y EL MÁXIMO ES ${MAX_STYLES}`);
    const ids = new Set<string>();
    for (const m of data.materials)
    {
        if (ids.has(m.id)) err(`ID DE MATERIAL REPETIDO: ${m.id}`);
        ids.add(m.id);
        if (!data.textures.includes(m.texture)) err(`${m.id}: USA LA TEXTURA «${m.texture}», QUE NO ESTÁ EN LA LISTA`);
        if (m.tile <= 0) err(`${m.id}: EL TILE DEBE SER MAYOR QUE 0`);
    }
    for (const k of KINDS) if (!ids.has(data.kinds[k])) err(`EL TIPO «${k}» USA UN MATERIAL QUE NO EXISTE: ${data.kinds[k]}`);
    for (const t of data.textures) if (!textures.some(f => f.name === t)) warn(`FALTA EL ARCHIVO public/ship/${t}.png (SE VE LISO)`);
    const total = textures.filter(f => data.textures.includes(f.name)).reduce((s, f) => s + f.bytes, 0);
    if (total > 3 * 1024 * 1024) warn(`LAS TEXTURAS PESAN ${(total / 1048576).toFixed(1)} MB (EN EL TELÉFONO PESAN)`);
    for (const [zone, st] of Object.entries(data.zoneStyle)) if (st < 0 || st >= data.styles.length) warn(`LA ZONA ${zone} USA EL ESTILO ${st}, QUE NO EXISTE`);
    const used = new Set<string>([...Object.values(data.kinds), ...PREFABS.flatMap(p => p.parts.map(q => q.material ?? ''))]);
    const live = new Set(PROPS.map(p => (p.material === undefined ? '' : MATERIALS[p.material]?.id ?? '')));
    for (const m of data.materials) if (!used.has(m.id) && !live.has(m.id)) warn(`${m.id}: NINGÚN TIPO, OBJETO NI PREFAB LO USA`);
    return out;
}

/** The tab of the materials and their textures. */
export function createMaterialsMode(host: Host, saved: MaterialsFile): Mode
{
    const doc = new Doc<MaterialsFile>(saved);
    const side = document.getElementById('side-materials')!;
    const tools = document.getElementById('tools-materials')!;
    const orbit = new Orbit();
    let selected = 0;
    let textures: TextureInfo[] = [];
    let message = '';
    let active = false;
    const version = () => String(Date.now());

    const mat = (): MaterialData | undefined => doc.data.materials[selected];

    /** The tables the engine and the other tabs read, from the document. */
    function apply(reload = false)
    {
        applyMaterials(doc.data);
        host.gl.setMaterials(packMaterialUniforms());
        if (reload) void loadMaterialTextures(host.gl, '/', () => draw(), version());
    }

    function draw()
    {
        if (!active) return;
        renderPreview(host.gl, orbit);
    }

    function sample()
    {
        host.gl.setMesh(materialSampleMesh(Math.max(0, Math.min(selected, doc.data.materials.length - 1))));
        draw();
    }

    function commit(fn: () => void, reload = false)
    {
        doc.checkpoint();
        fn();
        apply(reload);
        doc.touch();
    }

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

    function render()
    {
        const keepScroll = side.scrollTop;
        side.replaceChildren();
        const issues = materialIssues(doc.data, textures);
        const errors = issues.filter(i => i.level === 'error').length;

        const bar = h('div', 'tabbar');
        bar.append(
            button('GUARDAR', () => void save(), '', !doc.dirty),
            button('DESHACER', () => { doc.undo(); apply(true); }, '', !doc.canUndo),
            button('REHACER', () => { doc.redo(); apply(true); }, '', !doc.canRedo),
            button('CAMBIOS', diff, '', !doc.dirty),
        );
        const title = h('div', 'title', `MATERIALES${doc.dirty ? '  ● SIN GUARDAR' : ''}`);
        side.append(title, bar);
        if (message) side.append(h('div', 'hint', message));

        section('Materiales', e =>
        {
            const list = h('div', 'listing');
            doc.data.materials.forEach((m, i) =>
            {
                const item = h('div', `item${i === selected ? ' on' : ''}`);
                item.append(h('span', '', m.id), h('span', 'dim', m.texture));
                item.addEventListener('click', () => { selected = i; render(); sample(); });
                list.append(item);
            });
            e.append(list);
            const row = h('div', 'bar wrap');
            row.append(
                button('+ MATERIAL', () => commit(() =>
                {
                    let n = 1;
                    while (doc.data.materials.some(m => m.id === `material-${n}`)) n++;
                    doc.data.materials.push({ id: `material-${n}`, texture: doc.data.textures[0] ?? 'prop', tile: 1.5, strength: 1, albedo: 0.14, shin: 10, ks: 0.3 });
                    selected = doc.data.materials.length - 1;
                })),
                button('DUPLICAR', () => commit(() =>
                {
                    const m = mat();
                    if (!m) return;
                    let n = 1;
                    while (doc.data.materials.some(q => q.id === `${m.id}-${n}`)) n++;
                    doc.data.materials.push({ ...m, id: `${m.id}-${n}` });
                    selected = doc.data.materials.length - 1;
                }), '', !mat()),
                button('BORRAR', remove, 'danger', !mat()),
            );
            e.append(row);
        });

        const m = mat();
        if (m)
            section(`Material ${m.id}`, e =>
            {
                e.append(
                    field('id', textInput(m.id, v => commit(() =>
                    {
                        const id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || m.id;
                        if (doc.data.materials.some(q => q !== m && q.id === id)) return;
                        for (const k of KINDS) if (doc.data.kinds[k] === m.id) doc.data.kinds[k] = id;
                        for (const p of PREFABS) for (const part of p.parts) if (part.material === m.id) part.material = id;
                        m.id = id;
                    }))),
                    field('textura', selectInput(doc.data.textures as readonly string[], m.texture, v => commit(() => { m.texture = v; }))),
                    field('tile (m)', numberInput(m.tile, v => commit(() => { m.tile = v; }), 0.1, 0.05)),
                    field('relieve', numberInput(m.strength, v => commit(() => { m.strength = v; }), 0.1, 0, 3)),
                    field('brillo', numberInput(m.albedo, v => commit(() => { m.albedo = v; }), 0.01, 0, 1)),
                    field('reflejo (nitidez)', numberInput(m.shin, v => commit(() => { m.shin = v; }), 1, 1, 64)),
                    field('reflejo (fuerza)', numberInput(m.ks, v => commit(() => { m.ks = v; }), 0.05, 0, 2)),
                    field('según el estilo', checkInput(!!m.styled, v => commit(() => { if (v) m.styled = true; else delete m.styled; }))),
                    field('origen', textInput(m.source ?? '', v => commit(() => { if (v.trim()) m.source = v.trim(); else delete m.source; }))),
                );
                if (m.styled) e.append(h('div', 'hint', 'CON «SEGÚN EL ESTILO» EL BRILLO LO DA LA TABLA DE ESTILOS Y NO EL CAMPO «BRILLO».'));
            });

        section('Texturas', e =>
        {
            for (const name of doc.data.textures)
            {
                const info = textures.find(t => t.name === name);
                const row = h('div', 'stack');
                const img = h('img', 'thumb');
                img.src = `/ship/${name}.png?v=${info?.bytes ?? 0}`;
                img.alt = name;
                row.append(h('div', 'item', ''), img);
                (row.firstChild as HTMLElement).append(h('span', '', name), h('span', 'dim', info ? `${Math.round(info.bytes / 1024)} KB` : 'SIN ARCHIVO'));
                e.append(row);
            }
            uploadForm(e);
        });

        section('Tipos de superficie', e =>
        {
            const ids = doc.data.materials.map(q => q.id);
            for (const k of KINDS) e.append(field(k, selectInput(ids, doc.data.kinds[k], v => commit(() => { doc.data.kinds[k] = v; }))));
            e.append(h('div', 'hint', 'LOS TIPOS SON LAS SUPERFICIES QUE EL MOTOR CONOCE; LOS OBJETOS PUEDEN ELEGIR OTRO MATERIAL.'));
        }, false);

        section('Estilos de sala', e =>
        {
            doc.data.styles.forEach((s, i) =>
                e.append(field(`estilo ${i}`, numberInput(s, v => commit(() => { doc.data.styles[i] = v; }), 0.01, 0, 1))));
            const nums = doc.data.styles.map((_, i) => String(i));
            for (const zone of Object.keys(doc.data.zoneStyle))
                e.append(field(zone, selectInput(nums, String(doc.data.zoneStyle[zone]), v => commit(() => { doc.data.zoneStyle[zone] = Number(v); }))));
            e.append(h('div', 'hint', 'EL ESTILO DE UNA ZONA SE APLICA AL RECONSTRUIR EL MAPA (PESTAÑA MAPA).'));
        }, false);

        section(`Avisos (${errors} errores, ${issues.length - errors} avisos)`, e =>
        {
            if (!issues.length) e.append(h('div', 'hint', 'SIN AVISOS.'));
            for (const i of issues) e.append(h('div', `issue ${i.level}`, `${i.level === 'error' ? '✖' : '▲'} ${i.text}`));
        });
        side.scrollTop = keepScroll;
    }

    function remove()
    {
        const m = mat();
        if (!m) return;
        const by = [
            ...KINDS.filter(k => doc.data.kinds[k] === m.id).map(k => `el tipo «${k}»`),
            ...PREFABS.filter(p => p.parts.some(q => q.material === m.id)).map(p => `el prefab «${p.id}»`),
            ...(PROPS.some(p => p.material !== undefined && MATERIALS[p.material]?.id === m.id) ? ['objetos del mapa'] : []),
        ];
        if (by.length) { message = `NO SE PUEDE BORRAR «${m.id}»: LO USAN ${by.join(', ').toUpperCase()}.`; render(); return; }
        message = '';
        commit(() => { doc.data.materials.splice(selected, 1); selected = Math.max(0, selected - 1); });
    }

    // ---- uploading a texture

    function uploadForm(e: HTMLElement)
    {
        const form = h('div', 'stack');
        form.append(h('div', 'hint', 'SUBIR: O BIEN LOS MAPAS (COLOR + NORMAL OPENGL, AO OPCIONAL), O BIEN UNA IMAGEN YA EMPAQUETADA (R = BRILLO, G Y B = NORMAL). SE REESCALA A 512×512.'));
        const name = h('input');
        name.type = 'text';
        name.placeholder = 'nombre (a-z, 0-9, - y _)';
        const files: Record<string, HTMLInputElement> = {};
        const pick = (label: string, key: string) =>
        {
            const i = h('input');
            i.type = 'file';
            i.accept = 'image/*';
            files[key] = i;
            return field(label, i);
        };
        const status = h('div', 'hint');
        form.append(
            field('nombre', name), pick('color', 'color'), pick('normal (GL)', 'normal'), pick('AO (opcional)', 'ao'), pick('ya empaquetada', 'packed'),
            button('EMPAQUETAR Y SUBIR', () => void upload(name.value.trim(), files, status)),
            status,
        );
        e.append(form);
    }

    async function pixels(file: File): Promise<Uint8ClampedArray>
    {
        const bmp = await createImageBitmap(file, { colorSpaceConversion: 'none' });
        const c = document.createElement('canvas');
        c.width = c.height = DETAIL_SIZE;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, DETAIL_SIZE, DETAIL_SIZE);
        return ctx.getImageData(0, 0, DETAIL_SIZE, DETAIL_SIZE).data;
    }

    async function upload(name: string, files: Record<string, HTMLInputElement>, status: HTMLElement)
    {
        try
        {
            if (!NAME.test(name)) throw new Error('el nombre solo puede llevar a-z, 0-9, - y _');
            const [color, normal, ao, packed] = ['color', 'normal', 'ao', 'packed'].map(k => files[k].files?.[0]);
            let out: Uint8ClampedArray;
            if (packed) out = await pixels(packed);
            else if (color && normal) out = packDetail(await pixels(color), await pixels(normal), ao ? await pixels(ao) : null);
            else throw new Error('hacen falta color y normal, o una imagen ya empaquetada');
            if (textures.some(t => t.name === name) && !confirm(`Ya existe la textura «${name}». ¿Reemplazarla?`)) return;
            status.textContent = 'SUBIENDO…';
            const c = document.createElement('canvas');
            c.width = c.height = DETAIL_SIZE;
            c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out), DETAIL_SIZE, DETAIL_SIZE), 0, 0);
            const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('no se pudo codificar el PNG'))), 'image/png'));
            const problem = await uploadTexture(name, blob);
            if (problem) throw new Error(problem);
            textures = await listTextures();
            if (!doc.data.textures.includes(name)) commit(() => { doc.data.textures.push(name); }, true);
            else apply(true);
            message = `TEXTURA «${name}» SUBIDA A public/ship/${name}.png.`;
            render();
        }
        catch (e)
        {
            status.textContent = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
        }
    }

    // ---- file

    async function save()
    {
        const problem = await saveFile('materials', doc.text);
        if (problem) { message = `NO SE PUDO GUARDAR: ${problem}`; render(); return; }
        doc.markSaved();
        message = 'GUARDADO EN src/ship3d/materials.json. RECARGA EL LAUNCHER PARA VERLO ALLÍ.';
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
        if (selected >= doc.data.materials.length) selected = Math.max(0, doc.data.materials.length - 1);
        host.changed();
        if (!active) return;
        render();
        sample();
    });
    window.addEventListener('beforeunload', e => { if (doc.dirty) e.preventDefault(); });

    // the preview's camera
    orbit.attach(host.canvas, draw, () => active);
    const reset = button('REINICIAR CÁMARA', () => { Object.assign(orbit, new Orbit()); draw(); });
    tools.append(h('span', '', 'ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR'), reset);

    return {
        get dirty() { return doc.dirty; },
        activate()
        {
            active = true;
            side.hidden = false;
            tools.hidden = false;
            apply();
            void listTextures().then(t => { textures = t; render(); });
            render();
            sample();
        },
        deactivate()
        {
            active = false;
            side.hidden = true;
            tools.hidden = true;
        },
        render: draw,
    };
}

export async function loadMaterialsFile(): Promise<MaterialsFile>
{
    return loadFile<MaterialsFile>('materials');
}
