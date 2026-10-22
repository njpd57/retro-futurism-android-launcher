#!/usr/bin/env python3
"""Packs ambientCG materials (1K-JPG) into the ship's detail textures: public/ship/<name>.png, 512x512 RGB.

  R = brightness (colour x ambient occlusion, as grey, divided by its mean and halved, so 0.5 is "as bright as average")
  G = normal x   B = normal y   (OpenGL convention, tangent space; z is rebuilt in the shader)

Usage: pack_ship_textures.py <folder with one sub-folder per material, as unzipped from ambientCG>
Sources and licences are listed in ASSETS.md.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
# texture name -> ambientCG material
MATERIALS = {
    'wall': 'MetalPlates015A',
    'floor': 'DiamondPlate008A',
    'ceiling': 'CorrugatedSteel009',
    'prop': 'Metal063',
}


def load(folder: Path, material: str, kind: str):
    for p in folder.glob(f'{material}_1K-JPG_{kind}.jpg'):
        return Image.open(p).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    return None


def pack(folder: Path, material: str) -> Image.Image:
    color = np.asarray(load(folder, material, 'Color'), dtype=np.float32) / 255
    grey = color @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    ao = load(folder, material, 'AmbientOcclusion')
    if ao is not None:
        grey = grey * np.sqrt(np.asarray(ao, dtype=np.float32)[..., 0] / 255)
    grey = np.clip(grey / grey.mean(), 0, 2) / 2

    n = np.asarray(load(folder, material, 'NormalGL'), dtype=np.float32) / 255 * 2 - 1
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
    out = np.stack([grey, n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5], axis=-1)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')


def main():
    src = Path(sys.argv[1])
    dest = Path(__file__).resolve().parent.parent / 'public' / 'ship'
    dest.mkdir(parents=True, exist_ok=True)
    for name, material in MATERIALS.items():
        pack(src / material, material).save(dest / f'{name}.png', optimize=True)
        print(name, material, (dest / f'{name}.png').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
