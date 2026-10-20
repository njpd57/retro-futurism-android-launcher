import { correctPoint } from './curvature';

/**
 * The element drawn under the finger at (x, y). With the CRT curvature the filter moves what is painted but not
 * the hit-testing, so the point is corrected first (the same correction `CrtScreen` applies to clicks).
 * `tube` is the tube's rectangle when the curvature is on, otherwise null.
 */
export function elementAtPoint(x: number, y: number, tube: DOMRect | null, bendK: number): Element | null
{
    const p = tube ? correctPoint(x, y, tube, bendK) : { x, y };
    return document.elementFromPoint(p.x, p.y);
}
