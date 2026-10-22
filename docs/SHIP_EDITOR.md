# Ship map and asset editor

A dev-only page that draws the ship with the real engine and edits its data: the plan (`src/ship3d/ship.json`), the materials and their textures (`materials.json`, `public/ship/*.png`) and the prefabs (`prefabs.json`). It has three tabs, MAPA, MATERIALES and PREFABS; each has its own undo history and its own file, and the tab bar marks the ones with unsaved work (●).

```bash
npm run ship:edit      # vite dev server, opens /editor.html
```

`editor.html` and `src/editor/` are not part of the build (`vite build` only takes `index.html`); the read / write endpoints (`/__ship/list`, `/load`, `/save`) are a Vite plugin in `vite.config.ts` that exists only under `vite dev`.

## The data

`ship.json` (types in `src/ship3d/shipData.ts`) is the source of truth. `world.ts` expands it with `applyWorld(data)` at import and exports the same constants as before (`ROOMS`, `PORTALS`, `PROPS`, `SCREENS`, `LIGHTS`, `START`, `STANDS`, `VIAS`, `SIGNAL_SLOTS`, `STENCILS`, `TABLE_R`, `CHAIRS`, `BIRD`...). **`applyWorld` empties and refills the arrays and records in place**, so what other modules imported stays valid; modules that derive something at import register with `onWorldChange(fn)` (`bake.ts` clears its cache, `atlas.ts` refills `SLOT`). Don't copy a world export into a module-level constant if the editor needs to see changes (`glide.ts` `SEGS`, `pick.ts` `WALLS`, `acoustics.ts` `SOURCES`, `hud.ts` `NAMES` / `ORDER` and `crew.ts` `SEATS` do, and are only correct because the launcher applies the world once, at import).

| Key | What |
|---|---|
| `door` | width and height of every doorway (the shader reads the height once at load) |
| `start` | where the camera begins |
| `rooms` | `id`, `zone` (one of the nine rooms or `pasillo`), `name`, `height`, `shape`: `rect`, `chamfer`, `ngon`, `dome` (parameters) or `poly` (literal convex outline) |
| `portals` | doorway centres; each must sit on a wall shared by two rooms |
| `props` | boxes and cylinders in order, plus generators: `mess` (ring, table, jars, bird's glass, crown, chairs: numbers in `mess`) and `pods` |
| `mess`, `hangar` | parameters of those generators; `hangar.rows` holds one `y` per pair of shuttles |
| `screens` | monitors: `wall` (point on a wall and `face`), `crown` (over the mess table), `dome` (side `k` of the bridge dome); the order is the atlas slot (20 at most) |
| `lamps`, `extraLights` | the ceiling-lamp grid, and lights placed by hand |
| `stands`, `vias`, `signalSlots`, `stencils` | where the minimap puts the camera in each room, route points round obstacles, the crew's places in COMMS, the wall stencils (used by `glide.ts`, `crew.ts`, `labels.ts`) |

Rebuilding is cheap (about 50 ms): `applyWorld` + `buildMesh()` + `ShipGL.setMesh`.

## Using it

- **Plan view**: the engine from straight above (`GLFrame.top`, orthographic, everything above the *corte* height removed so you see into the rooms), with an SVG overlay for outlines and handles. Wheel zooms, drag on the background or middle button pans.
- **Select** by clicking. Drag props, screens (they slide along their wall and take its face), doorways (along the nearest wall), lights, stands, route points and signal posts. A room must be selected first, then dragging moves it with its props, screens, doorways, stand and route points (switch off *mover sala con su contenido* to move only the outline).
- **Rooms**: drag a corner; the first time the shape becomes a literal polygon, and doorways on the two sides that meet there follow it. The dot in the middle of a side splits it; shift+click on a corner removes it.
- **Props**: handles for width, depth and rotation (box) or diameter (cylinder). `imán` snaps the *movement* to a grid (existing off-grid positions stay off-grid).
- Keys: arrows nudge, Delete removes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Shift+Z undo and redo, Tab walks.
- **Walk (Tab)**: first person with the launcher's own `walker`, collisions and doors; WASD, drag or arrows to look, Esc returns to the plan where you stood.
- **Avisos** (`validate.ts`, plus the mesh check from `ship3d/meshCheck.ts`): room not convex, overlapping or without area; doorway off any wall, joining fewer than two rooms or blocked by a solid prop; corridors without a door at each end; props through a wall or outside the ship; screens off their wall or duplicated; stands and route points outside their room or inside a solid; more than 20 screens or 16 doorways; solids open underneath. Click one to jump to it.
- **Files**: *Guardar* writes the active plan. *Guardar como…* writes `src/ship3d/variants/<name>.json`; only `ship.json` is loaded by the launcher. *Cambios* shows a line diff against what is on disk. A draft of unsaved work is kept in `localStorage`.

After saving `ship.json`, reload the launcher (or its dev tab) to see it. The editor's own page is not reloaded when the file it wrote changes, so the undo history survives.

## Materials and textures (MATERIALES tab)

`materials.json` (types in `materialData.ts`, run-time tables in `materials.ts`): `textures` (names; each is a layer of **one texture array**, `public/ship/<name>.png`, 512x512 RGB: red brightness, green and blue the normal's x and y), `materials` (`id`, `texture`, `tile` in metres, `strength` of the relief, `albedo`, `shin` / `ks` of the highlight, `styled` = the brightness comes from the room's style table, `source` = where it comes from and its licence), `kinds` (which material the engine's own surfaces use: `wall`, `floor`, `ceiling`, `prop`, `frame`, `door`), `styles` (the brightness of a `styled` material per style) and `zoneStyle` (the style of each zone). At most 16 materials, 16 textures and 8 styles: the shader has that many slots.

- How it reaches the screen: `gl.setMaterials(packMaterialUniforms())` fills uniform arrays (`uTile[m]`, `uAlbedo[m]`...) and `loadMaterialTextures(gl, base)` (`details.ts`) loads each PNG into its layer. A surface asks for its material by `materialOf(mat)` in the fragment shader: the one its vertices name (`mat + 16 * style + 256 * (material + 1)`, see `MAT_SURFACE`) or the one of its kind. A vertex that names none is `mat + 16 * style` as before, so adding a material changes nothing that does not use it.
- **Subir**: give a name and either the maps (colour, normal GL, AO if any: packed in the browser by `texturePack.ts`, the same formula as `scripts/pack_ship_textures.py`) or an already packed image; it is resized to 512x512 and written to `public/ship/<name>.png` by the dev server (`POST /__ship/texture`, a 512x512 PNG of at most 2 MB). A picture of the wrong size is rejected.
- A live preview (floor, wall, boxes and a column of the selected material, drag to turn, wheel to zoom) uses the same shader. A material is deleted only when no kind, prefab or object uses it. Warnings: missing or oversized textures, a kind pointing to a missing material, unused materials, more than the limits, and a total over 3 MB.
- Props (and prefab parts) pick a material in their panel; `Prop.material` is its index in `MATERIALS`, found by id when the plan is expanded.

## Prefabs (PREFABS tab)

`prefabs.json` (`prefabData.ts`, `prefabs.ts`): objects made of boxes and cylinders in their own frame (`x`, `y` on the floor, `z0` the base, `w`, `d`, `h`, `yaw` for boxes, `material`, `glow`, `solid`). The map holds `{ prefab, x, y, yaw }` in `props`; `propsOf` expands it to ordinary props (so collision, lights, baking and the mesh need nothing new), turning every part by the instance's `yaw`.

- The viewer builds a mesh of just the prefab (`prefabMesh`, no baked light) with the engine's own shader. Drag to orbit, wheel to zoom, click a part to select it (`rayBox`, `rayCylinder`), drag the coloured arrows to move it along x, y or up (z0); shift = fine step.
- **DESDE OBJETO DEL MAPA** makes a prefab of one part from the box or cylinder selected in the MAPA tab. In the map, `+ <prefab>` places it in the middle of the view, the panel edits its id, position and turn, and **DESAGRUPAR** replaces it with plain props. A prefab with instances can't be deleted; renaming it renames its instances (undoing that undoes only the prefab, so the map then warns about the missing one).
- The vertex cost per instance is shown (`~216 vértices` for a box and a cylinder): the ship has about 68000.

## Not covered

- Mess furniture along the walls (galley, lockers, dispenser, bench, crate, cone) is a list of plain props, not a generator: edit it like any prop. The table, chairs, crown and bird are `mess` parameters, centred on the origin.
- The door height is read when the page loads; shaders, the monochrome tint, and the figures (`figures.ts`, `pose.ts`: the crew, Jones, the bird, the shuttles) and the sounds are still code. Surfaces are monochrome: a material is brightness and relief, not colour.
- A room can't be non-convex (the engine's lighting, collisions and doorway cuts assume convex outlines).
