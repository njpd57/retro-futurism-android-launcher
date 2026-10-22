/**
 * The shape of `prefabs.json`: objects made of boxes and cylinders that the map places by name. The map editor edits
 * this file; `world.ts` expands an instance into ordinary props (so collision, light and mesh need nothing new).
 */

/** One box or cylinder of a prefab, in the prefab's own frame: `(x, y)` on the floor plan, `z0` its base. */
export interface PrefabPart
{
    kind: 'box' | 'cyl';
    x: number;
    y: number;
    z0?: number;
    /** box: across; cylinder: diameter */
    w: number;
    /** box only: deep */
    d?: number;
    h: number;
    /** box only: plan rotation */
    yaw?: number;
    /** id of a material in `materials.json`; the kind's own when left out */
    material?: string;
    /** 0..1 how much it shines by itself */
    glow?: number;
    solid?: boolean;
}

export interface Prefab
{
    id: string;
    name: string;
    parts: PrefabPart[];
}

export interface PrefabsFile { prefabs: Prefab[] }
