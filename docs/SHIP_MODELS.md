# Ship models: where each piece is built, and how to look at it

The static ship is one triangle list built in code (`buildMesh()`), no model files. Each piece has its own file in `src/ship3d/mesh/`; `src/ship3d/mesh.ts` only re-exports them so imports stay `from './mesh'`. The *data* (rooms, doorways, props, lights, monitors) is `src/ship3d/ship.json`, which `world.ts` expands (`applyWorld`); these files turn it into triangles. To edit it by eye use the map editor (`npm run ship:edit`, `docs/SHIP_EDITOR.md`).

## Files

| File | What it builds |
|---|---|
| `builder.ts` | `Builder` (`quad`, `tri`, bakes light per vertex), `STRIDE`, `MAT`, `STYLE` (the zones' styles, from `materials.json`), `MAT_STYLE`, `MAT_SURFACE` (a surface that names its own material), `extrude` (a flat-topped solid on a plan outline) |
| `room.ts` | floors and ceilings in 1 m cells (`tessellate`, `CELL`), walls (`wallGrid`), the doorway frame (two posts and a beam), props, ceiling lamps: `addRoom`, `addProp`, `addLamp` |
| `doors.ts` | the sliding leaf of each doorway (`addDoors`); the vertex shader lifts it by `uDoor[n]` |
| `corridor.ts` | ribs, quilted cushions (`CUSHIONS`), ceiling pipes and floor hatches of the corridors |
| `decor.ts` | hazard chevrons, name plates and wall stencils (`plate`, `stencilSpot`), bridge keyboards |
| `controls.ts` | the panels of controls: slab, bezels and flat name plates (`addPanels`, `panelFrame`, `onPanel`, `facePatch`); the moving parts are drawn each frame by `src/ship3d/controls.ts` |
| `screens.ts` | monitors: the picture from the atlas and its bezel (`addScreen`, `screenFrame`) |
| `assets/window/` | the bridge's window onto space, now an asset folder (see `SHIP_ASSETS.md`); the sky is the `MAT.window` branch of `shaders.ts`, painted from the view ray |
| `index.ts` | `buildMesh()`: the order everything is added in |

## Conventions

- Vertices are `x, up, z` in GL space; `z` is the plan's `y`. Metres.
- **Culling is off** (`gl.disable(gl.CULL_FACE)`): winding means nothing, and every face is drawn from both sides. So a box must be **closed** (`extrude` caps the underside when `z0 > 0`), or from below you see through it to the faces behind. Two faces in one plane fight for the pixel: stand one a few millimetres off.
- `Builder.room` must be set before adding anything to the static mesh: it picks the room whose lamps and occlusion are baked into the vertices (`null` = no baked light).
- Material is `MAT.*`; for walls, floors and ceilings it rides as `mat + 16 * style`, and a prop or prefab part with its own material adds `256 * (material + 1)` (`propMaterial` in `room.ts`); what each kind and material looks like is `materials.json` (`docs/SHIP_EDITOR.md`). A door leaf carries its door number (`i / 16`) in the `emit` slot, and the fragment shader discards what has gone up past `DOOR.height`.
- Vertex budget: about 68 000 vertices at the moment.

## Looking at it

- `scripts/ship-shot.sh X Y YAW PITCH [DOORS 0..1] [OUT.png] [W H]` draws the ship once from a camera (headless Chrome, software WebGL) and prints the PNG's path; read the PNG to see it. Plan metres (x east, y south), yaw 0 = north clockwise, in radians. `0 4.5 0 0` is the mess facing the north door; `0 -2.5 0 0 1` stands in front of it with the door open. It uses `shot.html` and `src/shot.ts` (dev only, not in the build) and starts Vite if nothing runs on `$PORT` (5173). It is software rendering: good for geometry, z-fighting and layout, not for the exact brightness on the phone.
- `npm run ship:check` prints the vertex count and a hash of the mesh, how many solids are open underneath (exit code 1 if any) and how many same-facing faces overlap (a guide: many are hidden by design, so compare it before and after a change). After a pure refactor the vertex count and hash must not change.
