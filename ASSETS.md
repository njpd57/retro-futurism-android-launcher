# Assets

The ship's surfaces use four detail textures, `public/ship/{wall,floor,ceiling,prop}.png` (512 x 512, RGB: brightness,
normal x, normal y). They are made from the materials below with `scripts/pack_ship_textures.py`.

All of them are from [ambientCG](https://ambientcg.com), licensed CC0 1.0 (public domain, no attribution required; credit
given here anyway).

| Texture | Material | Link |
|---|---|---|
| `wall.png` | MetalPlates015A | https://ambientcg.com/view?id=MetalPlates015A |
| `floor.png` | DiamondPlate008A | https://ambientcg.com/view?id=DiamondPlate008A |
| `ceiling.png` | CorrugatedSteel009 | https://ambientcg.com/view?id=CorrugatedSteel009 |
| `prop.png` | Metal063 | https://ambientcg.com/view?id=Metal063 |

Which textures exist and what each material makes of them is data: `src/ship3d/materials.json`, edited in the map
editor's MATERIALES tab (`docs/SHIP_EDITOR.md`). A texture can be added or replaced there: give it the colour and
normal (OpenGL) maps, and the ambient occlusion if there is one, and it packs and writes the PNG itself
(`src/ship3d/texturePack.ts`, the same formula as the script); put its source and licence in the material's `origen`
field and in the table above.

To change one by hand instead: download its `1K-JPG` zip from ambientCG, unzip each into a folder named after the
material, edit `MATERIALS` in the script and run it with that folder as the argument. Any asset added later with a licence that asks
for attribution (CC-BY) or forbids commercial use (CC-BY-NC) goes in this file too, with its author and licence.

There are no sound files: all sound is synthesized (see `src/audio/`).
