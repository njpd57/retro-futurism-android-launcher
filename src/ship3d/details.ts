import type { ShipGL } from './gl';
import { packMaterialUniforms, TEXTURES } from './materials';

/**
 * Loads the detail textures the materials name (`public/ship/<name>.png`, one layer each) into the engine and hands it
 * the materials' parameters. Surfaces are flat until their picture arrives. Resolves once every picture has loaded or
 * failed; a missing one just stays flat.
 */
export function loadMaterialTextures(gl: ShipGL, base: string, onLoad?: (layer: number) => void, version = ''): Promise<void>
{
    gl.setMaterials(packMaterialUniforms());
    return Promise.all(TEXTURES.map((name, layer) => new Promise<void>(done =>
    {
        const img = new Image();
        img.onload = () => { gl.setMaterialTexture(layer, img); onLoad?.(layer); done(); };
        img.onerror = () => done();
        img.src = `${base}ship/${name}.png${version ? `?v=${version}` : ''}`;
    }))).then(() => undefined);
}
