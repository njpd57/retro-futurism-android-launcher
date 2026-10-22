import { onWorldChange, SCREENS } from './world';

/** Every monitor's picture lives in one texture: a grid of equal cells, one per monitor. */
export const CELL_W = 256;
export const CELL_H = 128;
export const COLS = 4;
export const ROWS = 5;
/** Below the monitors, a band of name plates: the crew's apps and names, the shuttles' apps and the rooms' wall stencils. */
export const LABEL_W = 256;
export const LABEL_H = 64;
export const LABEL_COLS = 4;
export const LABEL_ROWS = 7;
export const LABEL_SLOTS = LABEL_COLS * LABEL_ROWS;
const LABELS_Y = ROWS * CELL_H;
export const ATLAS_W = COLS * CELL_W;
export const ATLAS_H = LABELS_Y + LABEL_ROWS * LABEL_H;

/** Slot of each monitor, in `SCREENS` order. */
export const SLOT: Readonly<Record<string, number>> = {};
const fillSlots = () =>
{
    for (const k of Object.keys(SLOT)) delete (SLOT as Record<string, number>)[k];
    SCREENS.forEach((s, i) => { (SLOT as Record<string, number>)[s.id] = i; });
};
fillSlots();
onWorldChange(fillSlots);

export interface Rect { x: number; y: number; w: number; h: number }

/** The cell of slot `i` in pixels (row 0 is the top of the canvas). */
export function slotRect(i: number): Rect
{
    return { x: (i % COLS) * CELL_W, y: Math.floor(i / COLS) * CELL_H, w: CELL_W, h: CELL_H };
}

const toUv = (r: Rect): [number, number, number, number] => [r.x / ATLAS_W, r.y / ATLAS_H, (r.x + r.w) / ATLAS_W, (r.y + r.h) / ATLAS_H];

/** The cell of slot `i` as texture coordinates `[u0, v0, u1, v1]`, with `v` 0 at the top, as the canvas is uploaded. */
export const slotUv = (i: number) => toUv(slotRect(i));

/** The name plate `i` in pixels. */
export function labelRect(i: number): Rect
{
    return { x: (i % LABEL_COLS) * LABEL_W, y: LABELS_Y + Math.floor(i / LABEL_COLS) * LABEL_H, w: LABEL_W, h: LABEL_H };
}

export const labelUv = (i: number) => toUv(labelRect(i));

export interface AtlasScreen { id: string; lines: string[]; level: 'idle' | 'notice' | 'urgent' }

/**
 * Paints the monitors into a canvas: phosphor text on black, a frame (doubled when it wants attention) and, for an
 * urgent one, inverse video while `blink` is on. Text is a texture, so it stays sharp at any angle.
 */
export function drawAtlas(ctx: CanvasRenderingContext2D, screens: readonly AtlasScreen[], ph: string, bg: string, font: string, blink: boolean)
{
    ctx.clearRect(0, 0, ATLAS_W, LABELS_Y);
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

/**
 * Paints the name plates: phosphor text on nothing (the shader drops the empty texels, so it floats), `labels[i]` in
 * plate `i`; a missing one is left empty.
 */
export function drawLabels(ctx: CanvasRenderingContext2D, labels: readonly (string | undefined)[], ph: string, font: string)
{
    ctx.clearRect(0, LABELS_Y, ATLAS_W, ATLAS_H - LABELS_Y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `44px ${font}`;
    ctx.fillStyle = ph;
    labels.slice(0, LABEL_SLOTS).forEach((text, i) =>
    {
        if (!text) return;
        const { x, y, w, h } = labelRect(i);
        ctx.fillText(text, x + w / 2, y + h / 2, w - 12);
    });
}
