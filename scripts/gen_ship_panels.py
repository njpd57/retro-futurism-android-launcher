#!/usr/bin/env python3
"""Draws the ship's detail textures from scratch: public/ship/<name>.png, 512x512 RGB, in the same layout as
pack_ship_textures.py (R = brightness, 0.5 is average; G, B = the normal's x and y, OpenGL convention).

Each texture is one architectural module of the clean Nostromo / Torrens look, not a photo: moulded wall panels with
an octagonal bead, padded cushions, floor plates, ceiling coffers, louvres, perforated mesh and the door leaf. They
tile without a seam (every shape is drawn periodically), so a wall reads as panels bolted side by side.

Usage: gen_ship_panels.py [name ...]   (all of them when none is given)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

N = 512
# texel centres, 0..1: u across, v down the rows. The engine uploads the image as it is, so row 0 is v = 0, which is
# the bottom of a wall: a texture is drawn here upside down
_c = (np.arange(N) + 0.5) / N
U, V = np.meshgrid(_c, _c)


def box(cx, cy, hx, hy, r=0.0):
    """Signed distance to a rounded rectangle, in texture units (negative inside)."""
    dx = np.abs(U - cx) - hx + r
    dy = np.abs(V - cy) - hy + r
    out = np.hypot(np.maximum(dx, 0), np.maximum(dy, 0))
    return out + np.minimum(np.maximum(dx, dy), 0) - r


def octagon(cx, cy, hx, hy, cut):
    """Signed distance (close enough) to a rectangle with its corners cut at 45 degrees."""
    dx = np.abs(U - cx)
    dy = np.abs(V - cy)
    return np.maximum(np.maximum(dx - hx, dy - hy), (dx + dy - (hx + hy - cut)) / np.sqrt(2))


def hexagon(cx, cy, hx, hy, cut):
    """Signed distance to a stretched hexagon: a rectangle with its four corners cut only at the sides."""
    dx = np.abs(U - cx)
    dy = np.abs(V - cy)
    # the slanted sides run from (hx - cut, hy) to (hx, 0)
    return np.maximum(dy - hy, (dx * hy + dy * cut - hx * hy) / np.hypot(hy, cut))


def band(d, at, width, soft=1.5 / N):
    """1 on the line where the distance `d` is `at`, `width` wide, with soft edges."""
    return np.clip((width / 2 - np.abs(d - at)) / soft + 0.5, 0, 1)


def inside(d, soft=1.5 / N):
    return np.clip(-d / soft + 0.5, 0, 1)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def noise(scale, seed):
    """Periodic smooth noise around 0, features about `scale` of the tile across."""
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((N, N)))
    k = np.fft.fftfreq(N) * N
    kk = np.hypot(*np.meshgrid(k, k))
    f *= np.exp(-(kk * scale) ** 2 / 2)
    n = np.real(np.fft.ifft2(f))
    return n / (np.abs(n).max() + 1e-9)


def finish(height, shade, strength=6.0):
    """Height (texture units are arbitrary, about 1 = a deep moulding) and brightness to the packed RGB image."""
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) / 2
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) / 2
    n = np.stack([-dx * strength * N / 64, -dy * strength * N / 64, np.ones_like(height)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    grey = np.clip(shade / shade.mean(), 0, 2) / 2
    out = np.stack([grey, n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5], axis=-1)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')


def grain(seed, amount=0.004):
    """Painted plastic: a faint, fine unevenness."""
    return noise(0.004, seed) * amount + noise(0.02, seed + 1) * amount


def seam(width=5 / N):
    """The joint around the edge of the tile, where it meets its neighbours: a dark groove."""
    d = box(0.5, 0.5, 0.5, 0.5)
    return band(d, 0, width * 2)


# ---- the textures


def panel():
    """A moulded wall panel (the galley's fridges): a raised plate, an octagonal bead, a pair of rails each side and
    short dashes at the top and bottom. One tile is one panel."""
    h = grain(10)
    plate = smooth(-box(0.5, 0.5, 0.47, 0.47, 0.01) / (6 / N))
    h += plate * 0.25
    oct_d = octagon(0.5, 0.5, 0.2, 0.22, 0.08)
    bead = band(oct_d, 0, 7 / N, 3 / N)
    h += bead * 0.18
    for x in (0.12, 0.155, 0.845, 0.88):
        h += inside(box(x, 0.5, 0.008, 0.3, 0.008), 2 / N) * 0.12
    for y in (0.13, 0.87):
        for x0, x1 in ((0.24, 0.42), (0.58, 0.76)):
            h -= inside(box((x0 + x1) / 2, y, (x1 - x0) / 2, 0.006, 0.006), 2 / N) * 0.1
    groove = seam()
    h -= groove * 0.35
    shade = 1 - groove * 0.55 + grain(11, 0.02) + bead * 0.04
    return finish(h, shade)


def plain():
    """A plain moulded plate: a soft joint and four screws, for what should not draw the eye."""
    h = grain(20)
    groove = seam(4 / N)
    h -= groove * 0.3
    h += smooth(-box(0.5, 0.5, 0.48, 0.48, 0.02) / (5 / N)) * 0.08
    screws = sum(inside(np.hypot(U - x, V - y) - 4 / N) for x in (0.06, 0.94) for y in (0.06, 0.94))
    h -= screws * 0.05
    shade = 1 - groove * 0.45 - screws * 0.25 + grain(21, 0.025)
    return finish(h, shade)


def quilt():
    """A padded cushion with stepped contours: the orange upholstery round the doorways and along the benches."""
    d = box(0.5, 0.5, 0.46, 0.46, 0.08)
    puff = smooth(-d / 0.2) ** 0.6
    # two terraces stitched into it
    steps = band(box(0.5, 0.5, 0.36, 0.36, 0.06), 0, 6 / N, 3 / N) + band(box(0.5, 0.5, 0.25, 0.25, 0.05), 0, 6 / N, 3 / N)
    h = puff * 1.1 - steps * 0.12 + noise(0.01, 30) * 0.02
    shade = 0.75 + 0.25 * puff - steps * 0.15 + noise(0.05, 31) * 0.03
    return finish(h, shade, 5)


def floor():
    """Floor plates: two long ones side by side, thin joints, a fine raised dot texture for grip."""
    h = grain(40) * 0.5
    d = np.minimum(box(0.25, 0.5, 0.25, 0.5), box(0.75, 0.5, 0.25, 0.5))
    groove = band(d, 0, 4 / N)
    h -= groove * 0.3
    dots = np.cos(U * np.pi * 2 * 48) * np.cos(V * np.pi * 2 * 48)
    h += np.clip(dots, 0, 1) ** 4 * 0.015
    shade = 1 - groove * 0.5 + noise(0.03, 41) * 0.03 + grain(42, 0.02)
    return finish(h, shade)


def ceiling():
    """A ceiling coffer: a square bay stepped up in two bevels."""
    d1 = box(0.5, 0.5, 0.44, 0.44, 0.01)
    d2 = box(0.5, 0.5, 0.36, 0.36, 0.01)
    h = smooth(-d1 / (8 / N)) * 0.2 + smooth(-d2 / (8 / N)) * 0.2 + grain(50)
    groove = seam(4 / N)
    h -= groove * 0.2
    shade = 1 - groove * 0.4 - (smooth(-d1 / (8 / N)) - smooth(-d2 / (8 / N))) * 0.08 + grain(51, 0.02)
    return finish(h, shade)


def louvre():
    """A vent: horizontal slats, each tipped down, in a narrow frame."""
    slats = 8
    t = (V * slats) % 1
    h = (1 - t) * 0.25 - (t > 0.82) * 0.3
    shade = 0.55 + (1 - t) * 0.6 - (t > 0.82) * 0.5
    frame = 1 - inside(box(0.5, 0.5, 0.45, 0.47), 2 / N)
    h = h * (1 - frame) + frame * 0.35
    shade = shade * (1 - frame) + frame * 1.1
    return finish(h + grain(60) * 0.3, shade + grain(61, 0.02), 4)


def mesh():
    """Perforated mesh: diamond holes on a diagonal grid."""
    cells = 12
    a = ((U + V) * cells) % 1 - 0.5
    b = ((U - V) * cells) % 1 - 0.5
    d = np.maximum(np.abs(a), np.abs(b)) - 0.3
    hole = inside(d, 0.04)
    h = -hole * 0.3 + grain(70) * 0.3
    shade = 1 - hole * 0.85 + grain(71, 0.02)
    return finish(h, shade, 4)


def door():
    """The door leaf, one per tile: an X of raised mouldings, a stepped hexagonal window frame high in the middle and
    a lock plate below it. Graphite: the colour comes from its material."""
    h = grain(80) + noise(0.02, 81) * 0.01
    h += smooth(-box(0.5, 0.5, 0.47, 0.47, 0.03) / (8 / N)) * 0.15
    window = hexagon(0.5, 0.72, 0.16, 0.08, 0.08)
    h += band(window, 0.025, 0.03, 3 / N) * 0.15
    win = inside(window, 2 / N)
    h -= win * 0.2
    # the X: four slanting bars from the corners toward the middle, stopping short of it
    for sx in (-1, 1):
        for sy in (-1, 1):
            along = (sx * (U - 0.5) * 0.7 + sy * (V - 0.42)) / np.hypot(0.7, 1)
            across = (sx * (U - 0.5) - sy * 0.7 * (V - 0.42)) / np.hypot(0.7, 1)
            bar = inside(np.maximum(np.abs(across) - 0.05, np.maximum(0.1 - along, along - 0.42)), 3 / N)
            h += bar * 0.12
    groove = seam(6 / N)
    h -= groove * 0.3
    shade = 1 - win * 0.6 - groove * 0.5 + noise(0.04, 82) * 0.04 + grain(83, 0.02)
    return finish(h, shade)


TEXTURES = {'panel': panel, 'plain': plain, 'quilt': quilt, 'floor': floor, 'ceiling': ceiling, 'louvre': louvre, 'mesh': mesh, 'door': door}


def main():
    dest = Path(__file__).resolve().parent.parent / 'public' / 'ship'
    dest.mkdir(parents=True, exist_ok=True)
    for name in sys.argv[1:] or TEXTURES:
        TEXTURES[name]().save(dest / f'{name}.png', optimize=True)
        print(name, (dest / f'{name}.png').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
