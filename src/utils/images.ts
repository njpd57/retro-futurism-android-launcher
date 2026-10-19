export const MAX_IMAGE_SIDE = 1280;

export interface ImageMeta
{
    id: string;
    name: string;
    addedAt: number;
    w: number;
    h: number;
}

/** Size that fits inside `max` x `max` keeping the aspect ratio; never enlarges. */
export function fitSize(w: number, h: number, max = MAX_IMAGE_SIDE): { w: number; h: number }
{
    if (w <= 0 || h <= 0) return { w: 0, h: 0 };
    const scale = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** `IMG_2041.jpeg` to `IMG_2041.JPEG`, long names cut in the middle so the extension stays visible. */
export function displayName(name: string, max = 22): string
{
    const upper = name.trim().toUpperCase() || 'SIN NOMBRE';
    if (upper.length <= max) return upper;
    const dot = upper.lastIndexOf('.');
    const ext = dot > 0 && upper.length - dot <= 5 ? upper.slice(dot) : '';
    return `${upper.slice(0, max - ext.length - 1)}…${ext}`;
}

/** Newest first. */
export function sortImages<T extends { addedAt: number }>(images: T[]): T[]
{
    return [...images].sort((a, b) => b.addedAt - a.addedAt);
}

/** `[01]`, `[12]`: the position in the list as the terminal shows it. */
export const indexLabel = (i: number) => `[${String(i + 1).padStart(2, '0')}]`;

/** Index after moving `step` places, wrapping around; -1 for an empty list. */
export function wrapIndex(current: number, step: number, length: number): number
{
    if (length <= 0) return -1;
    return (((current + step) % length) + length) % length;
}
