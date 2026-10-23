import type { ShapeData } from './shipData';

/** The outlines a room's shape makes (`ship.json` -> `rooms[].shape`). Pure, and free of the rest of the world so the dev server can use it too. */

export type V2 = [number, number];

const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A rectangle with its corners cut. */
const chamfer = (x0: number, y0: number, x1: number, y1: number, c: number): V2[] => [
    [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
];

/** A regular polygon of `n` sides (a multiple of four) with flat sides facing the four directions, `a` from the centre to each flat. */
const ngon = (cx: number, cy: number, a: number, n: number): V2[] =>
{
    const r = a / Math.cos(Math.PI / n);
    return Array.from({ length: n }, (_, k): V2 =>
    {
        const t = ((k + 0.5) * Math.PI * 2) / n;
        return [round(cx + r * Math.cos(t)), round(cy + r * Math.sin(t))];
    });
};

/** The bridge: a flat edge to the south and a half-ellipse dome to the north. */
const dome = (cx: number, baseY: number, rx: number, ry: number, steps: number): V2[] =>
    Array.from({ length: steps + 1 }, (_, k): V2 =>
    {
        const a = (k * Math.PI) / steps;
        return [round(cx + rx * Math.cos(a)), round(baseY - ry * Math.sin(a))];
    });

export const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** The outline a room's shape makes. */
export function shapeOf(s: ShapeData): V2[]
{
    if ('rect' in s) return rect(...s.rect);
    if ('chamfer' in s) return chamfer(...s.chamfer);
    if ('ngon' in s) return ngon(...s.ngon);
    if ('dome' in s) return dome(...s.dome);
    return s.poly.map((p): V2 => [p[0], p[1]]);
}
