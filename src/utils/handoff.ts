/**
 * The handoff before an app opens: MOTHER types that it is passing control to the app while a bar fills, and then
 * the picture folds (the CSS `tube-off`). Pure, so it is tested; `CrtScreen` paints it.
 */
import { typedLength } from './anim';

/** Length of the handoff before the fold; the bar's CSS animation (`handoff-bar`) must end by then. */
export const HANDOFF_MS = 620;
export const TYPE_START_MS = 60;
export const TYPE_CPS = 120;
/** longest app name that fits the box at the base font size */
export const LABEL_MAX = 18;

export interface HandoffText { link: string; transfer: string }

/** The two lines MOTHER types. Long names are cut with `»`. */
export function handoffText(label: string): HandoffText
{
    const clean = label.trim().toUpperCase().replace(/\s+/g, ' ') || 'APLICACIÓN';
    const name = clean.length > LABEL_MAX ? clean.slice(0, LABEL_MAX - 1) + '»' : clean;
    return { link: `> ENLAZANDO: ${name}`, transfer: 'TRANSFIRIENDO CONTROL' };
}

export interface HandoffFrame
{
    /** characters visible of each line; the second starts once the first is done */
    link: number;
    transfer: number;
}

export function handoffFrame(text: HandoffText, elapsedMs: number): HandoffFrame
{
    const typed = typedLength(text.link.length + text.transfer.length, elapsedMs - TYPE_START_MS, TYPE_CPS);
    const link = Math.min(text.link.length, typed);
    return { link, transfer: typed - link };
}
