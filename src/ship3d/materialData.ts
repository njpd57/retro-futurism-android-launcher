/**
 * The shape of `materials.json`: the detail textures of the surfaces and how each material uses them. The map editor
 * edits this file; `materials.ts` holds it at run time and `gl.ts` feeds it to the shader as uniforms.
 */

/** The engine's kinds of surface that take a material (the rest, monitors, lamps, people, are code). */
export const KINDS = ['wall', 'floor', 'ceiling', 'prop', 'frame', 'door'] as const;
export type KindName = (typeof KINDS)[number];

export interface MaterialData
{
    id: string;
    /** a name in `textures`: `public/ship/<texture>.png` */
    texture: string;
    /** metres one repeat of the texture covers */
    tile: number;
    /** how strongly the texture's normal bends the light, 1 = as it is */
    strength: number;
    albedo: number;
    /** sharpness of the highlight */
    shin: number;
    /** strength of the highlight */
    ks: number;
    /** the brightness comes from the room's style (`styles`) instead of `albedo` */
    styled?: boolean;
    /** where the texture comes from and its licence */
    source?: string;
}

export interface MaterialsFile
{
    /** one layer of the texture array each, 512x512 RGB: red brightness, green and blue the normal's x and y */
    textures: string[];
    materials: MaterialData[];
    /** which material each kind of surface uses */
    kinds: Record<KindName, string>;
    /** the brightness of a `styled` material in each style */
    styles: number[];
    /** the style of each zone's surfaces */
    zoneStyle: Record<string, number>;
}
