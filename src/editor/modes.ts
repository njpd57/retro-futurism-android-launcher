import type { ShipGL } from '@/ship3d/gl';
import type { PropData } from '@/ship3d/shipData';

/** What the tabs of the editor share. */
export interface Host
{
    gl: ShipGL;
    canvas: HTMLCanvasElement;
    /** the area the canvas and the overlays fill */
    stage: HTMLElement;
    /** text over the corner of the view */
    hud(text: string): void;
    /** a tab's document changed or was saved: the tab bar shows which have unsaved work */
    changed(): void;
    /** the prop selected in the map, if it is a plain box or cylinder */
    mapProp(): PropData | null;
    /** how many instances of a prefab the map holds */
    prefabUses(id: string): number;
    /** the map's instances follow a prefab whose id changed */
    renamePrefab(from: string, to: string): void;
}

/** A tab: what is shown while it is the current one. */
export interface Mode
{
    readonly dirty: boolean;
    activate(): void;
    deactivate(): void;
    /** draw again (the view was resized) */
    render(): void;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K]
{
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

export function button(label: string, run: () => void, cls = '', disabled = false)
{
    const b = h('button', cls, label);
    b.disabled = disabled;
    b.addEventListener('click', run);
    return b;
}

/** A labelled field of a form; `input` is what the user touches. */
export function field(label: string, input: HTMLElement): HTMLLabelElement
{
    const row = h('label', 'row');
    row.append(h('span', '', label), input);
    return row;
}

export function numberInput(value: number, set: (v: number) => void, step = 0.1, min?: number, max?: number): HTMLInputElement
{
    const i = h('input');
    i.type = 'number';
    i.step = String(step);
    if (min !== undefined) i.min = String(min);
    if (max !== undefined) i.max = String(max);
    i.value = String(Math.round(value * 1e4) / 1e4);
    i.addEventListener('change', () =>
    {
        const v = Number(i.value);
        if (Number.isFinite(v)) set(min !== undefined ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : v);
    });
    return i;
}

export function textInput(value: string, set: (v: string) => void): HTMLInputElement
{
    const i = h('input');
    i.type = 'text';
    i.value = value;
    i.addEventListener('change', () => set(i.value));
    return i;
}

export function selectInput<T extends string>(options: readonly T[], value: T, set: (v: T) => void): HTMLSelectElement
{
    const s = h('select');
    for (const o of options) s.append(new Option(o, o, false, o === value));
    s.addEventListener('change', () => set(s.value as T));
    return s;
}

export function checkInput(value: boolean, set: (v: boolean) => void): HTMLInputElement
{
    const i = h('input');
    i.type = 'checkbox';
    i.checked = value;
    i.addEventListener('change', () => set(i.checked));
    return i;
}
