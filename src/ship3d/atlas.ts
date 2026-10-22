import { SCREENS } from './world';

/** Every monitor's picture lives in one texture: a grid of equal cells, one per monitor. */
export const CELL_W = 256;
export const CELL_H = 128;
export const COLS = 4;
export const ROWS = 5;
export const ATLAS_W = COLS * CELL_W;
export const ATLAS_H = ROWS * CELL_H;

/** Slot of each monitor, in `SCREENS` order. */
export const SLOT: Readonly<Record<string, number>> = Object.fromEntries(SCREENS.map((s, i) => [s.id, i]));

export interface Rect { x: number; y: number; w: number; h: number }

/** The cell of slot `i` in pixels (row 0 is the top of the canvas). */
export function slotRect(i: number): Rect
{
    return { x: (i % COLS) * CELL_W, y: Math.floor(i / COLS) * CELL_H, w: CELL_W, h: CELL_H };
}

/** The cell of slot `i` as texture coordinates `[u0, v0, u1, v1]`, with `v` 0 at the top, as the canvas is uploaded. */
export function slotUv(i: number): [number, number, number, number]
{
    const r = slotRect(i);
    return [r.x / ATLAS_W, r.y / ATLAS_H, (r.x + r.w) / ATLAS_W, (r.y + r.h) / ATLAS_H];
}

export interface AtlasScreen { id: string; lines: string[]; level: 'idle' | 'notice' | 'urgent' }

/**
 * Paints the monitors into a canvas: phosphor text on black, a frame (doubled when it wants attention) and, for an
 * urgent one, inverse video while `blink` is on. Text is a texture, so it stays sharp at any angle.
 */
export function drawAtlas(ctx: CanvasRenderingContext2D, screens: readonly AtlasScreen[], ph: string, bg: string, font: string, blink: boolean)
{
    ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of screens)
    {
        const slot = SLOT[s.id];
        if (slot === undefined) continue;
        const { x, y, w, h } = slotRect(slot);
        const lit = s.level === 'urgent' && blink;
        ctx.fillStyle = lit ? ph : bg;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = lit ? bg : ph;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
        if (s.level !== 'idle') ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);

        const lines = s.lines.slice(0, 3);
        const size = lines.length >= 3 ? 26 : 32;
        const step = size * 1.05;
        ctx.font = `${size}px ${font}`;
        ctx.fillStyle = lit ? bg : ph;
        lines.forEach((text, k) => ctx.fillText(text, x + w / 2, y + h / 2 + (k - (lines.length - 1) / 2) * step, w - 40));
    }
}
