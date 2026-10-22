# Assets

The ship's surfaces use eight detail textures, `public/ship/{panel,plain,quilt,floor,ceiling,louvre,mesh,door}.png`
(512 x 512, RGB: brightness, normal x, normal y). They are drawn from scratch by `scripts/gen_ship_panels.py` (numpy,
no source images), one architectural module each, so they are original to this project.

`scripts/pack_ship_textures.py` remains for packing ambientCG (CC0) materials in the same layout; none are in use now.
List the source and licence here of any texture added from outside.

Which textures exist and what each material makes of them is data: `src/ship3d/materials.json`, edited in the map
editor's MATERIALES tab (`docs/SHIP_EDITOR.md`). A texture can be added or replaced there: give it the colour and
normal (OpenGL) maps, and the ambient occlusion if there is one, and it packs and writes the PNG itself
(`src/ship3d/texturePack.ts`, the same formula as the script); put its source and licence in the material's `origen`
field and in the table above.

To change one by hand instead: download its `1K-JPG` zip from ambientCG, unzip each into a folder named after the
material, edit `MATERIALS` in the script and run it with that folder as the argument. Any asset added later with a licence that asks
for attribution (CC-BY) or forbids commercial use (CC-BY-NC) goes in this file too, with its author and licence.

There are no sound files: all sound is synthesized (see `src/audio/`).
