import type { Builder } from './mesh/builder';

/**
 * Assets: self-contained pieces of the ship, one folder each in `assets/<kind>/` with a manifest (`asset.json`: its
 * `kind` and the default value of every parameter) and a builder (`mesh.ts`: `export function build`). A piece of the
 * plan (`ship.json` -> `assets`) only says which kind goes where and overrides some parameters; the asset knows
 * nothing about the room it stands in. Adding one is a new folder, nothing else (see `docs/SHIP_ASSETS.md`).
 */

/** One placement in the plan: the asset's `kind` and the parameters it overrides, whatever its manifest declares. */
export interface AssetPlacement { kind: string; [param: string]: unknown }

export interface AssetManifest
{
    kind: string;
    /** parameters and their defaults */
    params: Record<string, unknown>;
    /** `shader.glsl` next to it defines `vec3 shade_<kind>()` for the surfaces of this asset (`assetMaterial(kind)`) */
    shader?: boolean;
    /** `pre`: built before the props, `post` (the default): after them; it only matters for what hides what in the draw order */
    stage?: 'pre' | 'post';
    /** GLSL uniform name -> the parameter (a number or an array of 2 to 4) that feeds it, read from the first placement of the kind */
    uniforms?: Record<string, string>;
}

/** What an asset's `build` receives: the builder and its parameters, defaults filled in. */
export type AssetBuild = (b: Builder, params: Record<string, unknown>) => void;

const manifests = import.meta.glob<AssetManifest>('./assets/*/asset.json', { eager: true, import: 'default' });
const builders = import.meta.glob<{ build: AssetBuild }>('./assets/*/mesh.ts', { eager: true });

export const ASSETS: Readonly<Record<string, { manifest: AssetManifest; build: AssetBuild }>> = Object.fromEntries(
    Object.entries(manifests).map(([path, manifest]) =>
    {
        const mesh = builders[path.replace('asset.json', 'mesh.ts')];
        if (!mesh) throw new Error(`asset ${manifest.kind}: no mesh.ts next to ${path}`);
        return [manifest.kind, { manifest, build: mesh.build }];
    }));

const sources = import.meta.glob<string>('./assets/*/shader.glsl', { eager: true, as: 'raw' });

/** First material number free for assets: the kinds of surface the fragment shader knows by name come before it. */
const FIRST_ASSET_MAT = 11;
/** `mat + 16 * style` rides in one number, so a material number must stay under 16. */
const MAX_MAT = 16;

/** The assets that paint their own surfaces, each with the material number its vertices carry (sorted by kind, so stable). */
export const ASSET_SHADERS: readonly { kind: string; mat: number; source: string; uniforms: Record<string, string> }[] = Object.values(ASSETS)
    .filter(a => a.manifest.shader)
    .sort((a, b) => (a.manifest.kind < b.manifest.kind ? -1 : 1))
    .map((a, i) =>
    {
        const source = sources[`./assets/${a.manifest.kind}/shader.glsl`];
        if (source === undefined) throw new Error(`asset ${a.manifest.kind}: "shader": true but no shader.glsl`);
        if (FIRST_ASSET_MAT + i >= MAX_MAT) throw new Error(`asset ${a.manifest.kind}: no material number left for its shader`);
        return { kind: a.manifest.kind, mat: FIRST_ASSET_MAT + i, source, uniforms: a.manifest.uniforms ?? {} };
    });

/** The material number of an asset with a shader, for its mesh builder (`MAT` has the built-in ones). */
export const assetMaterial = (kind: string): number =>
{
    const a = ASSET_SHADERS.find(s => s.kind === kind);
    if (!a) throw new Error(`asset ${kind} has no shader`);
    return a.mat;
};

/** The parameters of a placement: the asset's defaults with what the plan overrides. */
export const paramsOf = (p: AssetPlacement): Record<string, unknown> => ({ ...ASSETS[p.kind]?.manifest.params, ...p });

/** Builds the placements of the plan that belong to `stage`, in order; a kind nobody provides is reported, not skipped silently. */
export function buildAssets(b: Builder, placements: readonly AssetPlacement[], stage: 'pre' | 'post')
{
    for (const p of placements)
    {
        const asset = ASSETS[p.kind];
        if (!asset) { console.warn(`ship: no asset of kind "${p.kind}"`); continue; }
        if ((asset.manifest.stage ?? 'post') !== stage) continue;
        asset.build(b, paramsOf(p));
    }
}

/** The uniforms every asset shader gets this frame: name and value (1 to 4 numbers), from the first placement of each kind. */
export function assetUniforms(placements: readonly AssetPlacement[]): { name: string; value: number[] }[]
{
    const out: { name: string; value: number[] }[] = [];
    for (const a of ASSET_SHADERS)
    {
        const placed = placements.find(p => p.kind === a.kind);
        const params = placed ? paramsOf(placed) : ASSETS[a.kind].manifest.params;
        for (const [name, param] of Object.entries(a.uniforms))
        {
            const v = params[param];
            out.push({ name, value: Array.isArray(v) ? v.map(Number) : [Number(v)] });
        }
    }
    return out;
}
