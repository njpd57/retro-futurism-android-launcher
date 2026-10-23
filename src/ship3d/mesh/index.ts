import { ASSET_PLACEMENTS, PROPS, ROOMS } from '../world';
import { STRIDE, Builder } from './builder';
import type { Mesh } from './builder';
import { addRoom, addProp } from './room';
import { buildAssets } from '../assets';

export { propMaterial } from './room';
export { STRIDE, MAT, STYLE, MAT_STYLE, MAT_SURFACE, Builder, extrude, type Mesh } from './builder';
export { CELL, tessellate } from './room';
export { plate } from './plate';
export { stencilSpot } from '../assets/stencil/mesh';
export { screenFrame } from '../assets/screen/mesh';
export { made, QUIET_CELLS } from './doorway';
import { QUIET_CELLS } from './doorway';
export { CONTROL_PLATE_W, facePatch, onPanel, panelFrame, panelOf, PLATE_DROP, type PanelFrame } from '../assets/control-panel/mesh';

/**
 * The ship baked into one triangle list: rooms and props from the plan, and every asset it places (`assets/<kind>/`,
 * see `docs/SHIP_ASSETS.md`), the ones marked `pre` before the props and the rest after.
 */

export function buildMesh(): Mesh
{
    const b = new Builder();
    QUIET_CELLS.length = 0;
    for (const room of ROOMS) addRoom(b, room);
    buildAssets(b, ASSET_PLACEMENTS, 'pre');
    for (const p of PROPS) addProp(b, p);
    buildAssets(b, ASSET_PLACEMENTS, 'post');
    return { data: new Float32Array(b.data), vertices: b.data.length / STRIDE };
}
