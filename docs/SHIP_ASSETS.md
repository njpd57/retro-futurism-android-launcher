# Ship assets and zones (modular ship3d)

Rule: nothing specific to a room or a piece is written in `world.ts`, `mesh/` or `shaders.ts`. Pieces are **assets**
in their own folder; room types are **zones** in their own file; the plan (`plan/`) only places and configures them.

## Zones: `src/ship3d/zones/<id>.json`
One file per kind of room (`puente`, `motor`, `pasillo`...), found by name (`zones.ts`, `import.meta.glob`). Fields:
`required` (the validator expects a room of it), `hall` (a corridor), `label`, `voice` (ambient sound), `step`
(`plate`/`grate`), `work` (hazard chevrons at its doorways), `widgets` (the card a monitor opens), `keyScreens` (what the
hud says). Read them with `zoneDef(zone)` / `isHall(zone)`; never compare a zone name in code.

New room type: add `zones/<id>.json`, then a room in the plan (`plan/`) with `"zone": "<id>"` (its light style is still
`zoneStyle` in `materials.json`).

## Assets: `src/ship3d/assets/<kind>/`
```
assets/<kind>/asset.json   { "kind": "<kind>", "params": { every parameter with its default } }
assets/<kind>/mesh.ts      export function build(b: Builder, p: Record<string, unknown>): void
```
The builder gets the parameters (defaults overridden by the placement) and knows nothing else: rooms are looked up by the
`room` parameter, materials are named by parameters (`made(MAT.prop, String(p.frame))`).

Place it in the plan (`plan/global.json`):
```json
"assets": [ { "kind": "window", "room": "puente", "from": 2, "to": 6 } ]
```
Order of `assets` is build order. Adding, moving or removing a piece is a data edit; a new kind is a new folder and
nothing else (`assets.ts` finds it). Keep `npm run ship:check`'s hash unchanged for a pure refactor.

Existing assets: `window` (glass panes on the sides `from..to` of a room's outline; the sky is `MAT.window` in the shader).

## Asset shaders
An asset that paints its own surfaces adds `"shader": true` to `asset.json` and a `shader.glsl` that defines
`vec3 shade_<kind>()`. The engine gives it a material number (`assetMaterial(kind)` in its `mesh.ts`: `MAT` has the
built-in kinds, assets take 11-15 in sorted order) and runs it for those vertices. Inside it may use `vPos`, `uEye`,
`uTime`, `uBg`, `uPh`, `hash12`, `valueNoise`, `shipTime()` (holds still under reduced motion) and `monoTint(col)`
(the colour as the one phosphor tint when the ship is shown in one). Its uniforms are declared in the `.glsl` and mapped
in the manifest, `"uniforms": { "uSkyDrift": "skyDrift" }` (uniform -> parameter, a number or an array of 2-4), and take
their value from the parameters of the first placement of the kind: the sky of the window (stars, planet, moon, drift)
is tuned from the plan (`plan/`), not in code.

## The plan: `src/ship3d/plan/`
`global.json` (door, start, mess, hangar, lamps, floodlight, `assets`, and `roomOrder`) and one `rooms/<room id>.json` per
room holding everything that stands in it: its `rooms` entry, `portals`, `props`, `screens`, `panels`, `controls`,
`stations`, `signs`, `stencils`, `stands`, `vias`. `plan.ts` loads them with `import.meta.glob` and `planMerge.ts`
merges them into the one `ShipData` the engine and the editor use. The editor saves through `splitPlan`, which files each
thing under the nearest room, so the files stay in step with where things are. A new room is a new file (and a line in
`roomOrder` if its place in the order matters); nothing else lists it.

`assets` in `global.json` has a `stage` (`pre`: built before the props, `post`: after) set in each asset's `asset.json`.
Existing assets: `corridor`, `hazard`, `stencil`, `sign`, `keyboard`, `control-panel`, `screen`, `window`, `door`, `lamp`.

## Monitors' text: `readings/zones/<zone>.ts`
One file per kind of room, `export function readings(i: ShipInput, put)`, found by name (`readings.ts`); `readings/kit.ts` has
the types and helpers (`idle`, `fit`, `hhmm`). A new room's monitors are one file; a screen with no reading says `SIN DATOS`.

## The crew: `crew.json`
Who wanders (`id`, `kind`, `home` room, `wait`, `speed`, `pool` of rooms it may go to).

## Still to migrate
- The material ids an asset uses (`graphite`, `frame`...) are still written in its `mesh.ts`, not parameters.
- The `pods` and mess generators and the hangar bays are in `worldGen.ts`, not assets; the zones' light style is
  `zoneStyle` in `materials.json` (the materials editor owns it).
- `ShipPanel.vue` (camera, seat, controls and frame loop) and `gl.ts` are not yet split.
