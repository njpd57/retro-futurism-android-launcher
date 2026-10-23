import { LIGHTS, PROPS, roomAt, ROOMS, SCREENS } from '../world';
import { STRIDE, Builder } from './builder';
import type { Mesh } from './builder';
import { addRoom, addProp, addLamp } from './room';
import { addDoors } from './doors';
import { addCorridor } from './corridor';
import { addHazard, addStencils, addKeyboards, addSigns } from './decor';
import { addScreen } from './screens';
import { addPanels } from './controls';
import { addWindow } from './window';

export { propMaterial } from './room';
export { STRIDE, MAT, STYLE, MAT_STYLE, MAT_SURFACE, Builder, extrude, type Mesh } from './builder';
export { CELL, tessellate } from './room';
export { plate, stencilSpot } from './decor';
export { screenFrame } from './screens';
export { made, QUIET_CELLS } from './doorway';
import { QUIET_CELLS } from './doorway';
export { CONTROL_PLATE_W, facePatch, onPanel, panelFrame, panelOf, PLATE_DROP, type PanelFrame } from './controls';

/** The ship baked into one triangle list: each piece of it is built in its own file here (see `docs/SHIP_MODELS.md`). */

export function buildMesh(): Mesh
{
    const b = new Builder();
    QUIET_CELLS.length = 0;
    for (const room of ROOMS)
    {
        addRoom(b, room);
        if (room.zone === 'pasillo') addCorridor(b, room);
    }
    addHazard(b);
    addStencils(b);
    addSigns(b);
    addKeyboards(b);
    addPanels(b);
    for (const p of PROPS) addProp(b, p);
    for (const s of SCREENS) addScreen(b, s);
    addWindow(b);
    addDoors(b);
    for (const l of LIGHTS)
    {
        const room = roomAt(l.x, l.y);
        if (room && Math.abs(l.z - (room.height - 0.3)) < 1e-6) addLamp(b, l, room);
    }
    return { data: new Float32Array(b.data), vertices: b.data.length / STRIDE };
}
