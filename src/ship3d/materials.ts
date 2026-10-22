import json from './materials.json';
import { KINDS, type MaterialData, type MaterialsFile } from './materialData';
import type { Zone } from './world';

/**
 * The materials of the ship at run time, filled from `materials.json` (and by the map editor when it changes them).
 * Like `world.ts`, the arrays are emptied and refilled in place, so what other modules imported stays valid.
 */

/** The shader has this many of each, and a vertex carries its material in a few bits. */
export const MAX_MATERIALS = 16;
export const MAX_TEXTURES = 16;
export const MAX_STYLES = 8;
/** Side of every detail texture, in texels. */
export const DETAIL_SIZE = 512;

/** The material number (`MAT` in `mesh/builder.ts`) of each kind of surface. */
export const KIND_MAT = { wall: 0, floor: 1, ceiling: 2, prop: 3, frame: 6, door: 8 } as const;

export const TEXTURES: string[] = [];
export const MATERIALS: MaterialData[] = [];
/** index into `MATERIALS` of each kind */
export const KIND_INDEX: Record<string, number> = {};
export const STYLES: number[] = [];
export const STYLE_COLORS: string[] = [];
export const STYLE_LAMPS: string[] = [];
/** The style number of each zone's walls, floors and ceilings (rides in the material number, see `Builder`). */
export const STYLE: Record<Zone, number> = {} as Record<Zone, number>;

const listeners = new Set<() => void>();

/** Calls `fn` after every `applyMaterials`. Returns the way to stop. */
export function onMaterialsChange(fn: () => void): () => void
{
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function applyMaterials(data: MaterialsFile): void
{
    TEXTURES.length = 0;
    TEXTURES.push(...data.textures);
    MATERIALS.length = 0;
    MATERIALS.push(...data.materials.map(m => ({ ...m })));
    for (const k of Object.keys(KIND_INDEX)) delete KIND_INDEX[k];
    for (const k of KINDS) KIND_INDEX[k] = Math.max(0, MATERIALS.findIndex(m => m.id === data.kinds[k]));
    STYLES.length = 0;
    STYLES.push(...data.styles);
    STYLE_COLORS.length = 0;
    STYLE_COLORS.push(...(data.styleColors ?? []));
    STYLE_LAMPS.length = 0;
    STYLE_LAMPS.push(...(data.styleLamps ?? []));
    for (const k of Object.keys(STYLE)) delete STYLE[k as Zone];
    Object.assign(STYLE, data.zoneStyle);
    for (const fn of listeners) fn();
}

/** The index of a material by id, -1 if there is none. */
export const materialIndex = (id: string) => MATERIALS.findIndex(m => m.id === id);

/** The lamps' light where a style says nothing: warm white. */
const WARM: [number, number, number] = [1, 0.9, 0.78];

/** `#rrggbb` as three numbers 0..1; white for anything else. */
export function hexColor(hex: string | undefined): [number, number, number]
{
    const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
    if (!m) return [1, 1, 1];
    const n = parseInt(m[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** What the shader reads: one value per material, a layer of the texture array each. */
export interface MaterialUniforms
{
    /** how many layers the texture array needs */
    layers: number;
    layer: Float32Array;
    tile: Float32Array;
    strength: Float32Array;
    albedo: Float32Array;
    shin: Float32Array;
    ks: Float32Array;
    styled: Float32Array;
    /** red, green and blue of each material, 0..1 */
    color: Float32Array;
    /** material of each kind of surface, indexed by the material number of the kind */
    kind: Float32Array;
    style: Float32Array;
    /** red, green and blue of a styled surface and of the lamps' light, per style */
    styleColor: Float32Array;
    styleLamp: Float32Array;
}

export function packMaterialUniforms(materials: readonly MaterialData[] = MATERIALS, textures: readonly string[] = TEXTURES, kinds: Record<string, number> = KIND_INDEX, styles: readonly number[] = STYLES): MaterialUniforms
{
    const u: MaterialUniforms = {
        layers: Math.max(1, textures.length),
        layer: new Float32Array(MAX_MATERIALS), tile: new Float32Array(MAX_MATERIALS).fill(1), strength: new Float32Array(MAX_MATERIALS).fill(1),
        albedo: new Float32Array(MAX_MATERIALS).fill(0.1), shin: new Float32Array(MAX_MATERIALS).fill(8), ks: new Float32Array(MAX_MATERIALS),
        styled: new Float32Array(MAX_MATERIALS), color: new Float32Array(MAX_MATERIALS * 3).fill(1), kind: new Float32Array(16), style: new Float32Array(MAX_STYLES).fill(0.12),
        styleColor: new Float32Array(MAX_STYLES * 3).fill(1), styleLamp: new Float32Array(MAX_STYLES * 3),
    };
    materials.slice(0, MAX_MATERIALS).forEach((m, i) =>
    {
        u.layer[i] = Math.max(0, textures.indexOf(m.texture));
        u.tile[i] = Math.max(0.05, m.tile);
        u.strength[i] = m.strength;
        u.albedo[i] = m.albedo;
        u.shin[i] = m.shin;
        u.ks[i] = m.ks;
        u.styled[i] = m.styled ? 1 : 0;
        u.color.set(hexColor(m.color), i * 3);
    });
    for (const [k, mat] of Object.entries(KIND_MAT)) u.kind[mat] = kinds[k] ?? 0;
    styles.slice(0, MAX_STYLES).forEach((s, i) => { u.style[i] = s; });
    for (let i = 0; i < MAX_STYLES; i++)
    {
        u.styleColor.set(hexColor(STYLE_COLORS[i]), i * 3);
        u.styleLamp.set(STYLE_LAMPS[i] ? hexColor(STYLE_LAMPS[i]) : WARM, i * 3);
    }
    return u;
}

applyMaterials(json as unknown as MaterialsFile);
