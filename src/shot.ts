// Dev-only page for `scripts/ship-shot.sh`: draws the ship once from the camera in the URL, for a screenshot.
// ?x=&y=&yaw=&pitch=&doors=0..1&palette=amber|green&eye=1.6&mono=1
import { loadMaterialTextures } from '@/ship3d/details';
import { createShipGL } from '@/ship3d/gl';
import { buildMesh } from '@/ship3d/mesh';
import { ATLAS_H, ATLAS_W, drawLabels } from '@/ship3d/atlas';
import { withControls, withSigns, withStencils } from '@/ship3d/labels';
import { controlVertices } from '@/ship3d/controls';
import { CONTROLS, LIGHTS } from '@/ship3d/world';
import { nearestLights, packLights } from '@/ship3d/lights';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const [x, y, yaw, pitch, eye] = [num('x', 0), num('y', 0), num('yaw', 0), num('pitch', 0), num('eye', 1.6)];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = createShipGL(canvas, buildMesh());
if (!gl) throw new Error('no webgl2');
gl.setPalette(q.get('palette') === 'amber'
    ? { ph: [1, 0.69, 0], bg: [0.02, 0.015, 0] }
    : { ph: [0.2, 1, 0.4], bg: [0, 0.02, 0.005] });
const atlas = document.createElement('canvas');
atlas.width = ATLAS_W;
atlas.height = ATLAS_H;
// the stencils and signs, so painted lettering shows in the picture
drawLabels(atlas.getContext('2d')!, withControls(withSigns(withStencils([]))), '#ffb000', 'monospace');
// the panels' controls half way, so every kind shows its moving part
gl.setCrew(controlVertices(Object.fromEntries(CONTROLS.map((c, i) => [c.id, { value: c.kind === 'selector' ? i % 3 : c.kind === 'lever' ? 0.6 : i % 2, lock: null }])),
    { shown: new Map(), pressed: new Map(), blink: true }));
gl.setAtlas(atlas);

await loadMaterialTextures(gl, '/');

gl.resize(Number(q.get('scale') ?? 1));
const doors = Array.from({ length: 16 }, () => num('doors', 0));
gl.render({ eye: [x, eye, y], yaw, pitch, lights: packLights(LIGHTS, nearestLights(LIGHTS, x, y, eye)), time: 0, doors, sweep: -1000, holo: 0, grain: 0, color: q.get('mono') !== '1' });
document.title = 'ready';
