import { DETAIL_SIZE } from './materials';

/**
 * Packs the maps of a material into a detail texture, as `scripts/pack_ship_textures.py` does for the ones that ship:
 * red the brightness (colour as grey, times the square root of the ambient occlusion, divided by its mean and halved,
 * so 0.5 is "as bright as average"), green and blue the normal's x and y (OpenGL convention, tangent space). All maps
 * are `DETAIL_SIZE` square, RGBA bytes; the result is RGBA with full alpha. Pure.
 */
export function packDetail(color: Uint8ClampedArray, normal: Uint8ClampedArray, ao: Uint8ClampedArray | null = null): Uint8ClampedArray
{
    const n = DETAIL_SIZE * DETAIL_SIZE;
    const grey = new Float32Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++)
    {
        let g = (0.299 * color[i * 4] + 0.587 * color[i * 4 + 1] + 0.114 * color[i * 4 + 2]) / 255;
        if (ao) g *= Math.sqrt(ao[i * 4] / 255);
        grey[i] = g;
        sum += g;
    }
    const mean = Math.max(sum / n, 1e-6);
    const out = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++)
    {
        let x = (normal[i * 4] / 255) * 2 - 1;
        let y = (normal[i * 4 + 1] / 255) * 2 - 1;
        const z = (normal[i * 4 + 2] / 255) * 2 - 1;
        const len = Math.max(Math.hypot(x, y, z), 1e-6);
        x /= len;
        y /= len;
        out[i * 4] = Math.round(Math.min(2, Math.max(0, grey[i] / mean)) / 2 * 255);
        out[i * 4 + 1] = Math.round((x * 0.5 + 0.5) * 255);
        out[i * 4 + 2] = Math.round((y * 0.5 + 0.5) * 255);
        out[i * 4 + 3] = 255;
    }
    return out;
}
