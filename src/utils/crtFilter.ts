export type ImageFilter = 'phosphor' | 'color' | 'original';

export const IMAGE_FILTERS: { id: ImageFilter; label: string }[] = [
    { id: 'phosphor', label: 'FÓSFORO' },
    { id: 'color', label: 'CRT COLOR' },
    { id: 'original', label: 'ORIGINAL' },
];

export function nextFilter(current: ImageFilter): ImageFilter
{
    const i = IMAGE_FILTERS.findIndex(f => f.id === current);
    return IMAGE_FILTERS[(i + 1) % IMAGE_FILTERS.length].id;
}

export type Rgb = [number, number, number];

/** `rgb(1, 2, 3)`, `#abc` or `#aabbcc` to channels; null when it isn't one of those. */
export function parseColor(text: string): Rgb | null
{
    const s = text.trim().toLowerCase();
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(s);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map(clamp255) as Rgb;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
    if (!hex) return null;
    const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Rec. 601 luma, 0..255. */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

// 4x4 Bayer matrix, values 0..15
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Maps the image to a single phosphor: black pixels become `bg`, white ones `fg`.
 * `dither` adds an ordered pattern of up to 1/8 of the range so gradients don't band.
 * Works in place on RGBA data.
 */
export function applyDuotone(data: Uint8ClampedArray, width: number, bg: Rgb, fg: Rgb, dither = true): void
{
    for (let i = 0; i < data.length; i += 4)
    {
        const p = i / 4;
        let t = luma(data[i], data[i + 1], data[i + 2]) / 255;
        if (dither)
        {
            const x = p % width;
            const y = Math.floor(p / width);
            t += (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) / 8;
        }
        t = Math.max(0, Math.min(1, (t - 0.5) * 1.15 + 0.5));
        data[i] = bg[0] + (fg[0] - bg[0]) * t;
        data[i + 1] = bg[1] + (fg[1] - bg[1]) * t;
        data[i + 2] = bg[2] + (fg[2] - bg[2]) * t;
        data[i + 3] = 255;
    }
}

/** Contrast and a slight desaturation, the look of a tube that has seen better days. Works in place. */
export function applyCrtColor(data: Uint8ClampedArray, contrast = 1.2, saturation = 0.8): void
{
    for (let i = 0; i < data.length; i += 4)
    {
        const l = luma(data[i], data[i + 1], data[i + 2]);
        for (let c = 0; c < 3; c++)
        {
            const v = l + (data[i + c] - l) * saturation;
            data[i + c] = (v - 128) * contrast + 128;
        }
        data[i + 3] = 255;
    }
}

/** Darkens every other row, `strength` 0..1. Works in place. */
export function applyScanlines(data: Uint8ClampedArray, width: number, strength = 0.35): void
{
    const rowLength = width * 4;
    const keep = 1 - Math.max(0, Math.min(1, strength));
    for (let i = 0; i < data.length; i += 4)
    {
        if (Math.floor(i / rowLength) % 2 === 0) continue;
        data[i] *= keep;
        data[i + 1] *= keep;
        data[i + 2] *= keep;
    }
}
