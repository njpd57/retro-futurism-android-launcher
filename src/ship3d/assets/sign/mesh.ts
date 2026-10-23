import { LABEL_SLOTS } from '../../atlas';
import { SIGN_PLATES, SIGNS } from '../../labels';
import type { V3 } from '../../math';
import { roomAt } from '../../world';
import { MAT, Builder } from '../../mesh/builder';
import { made } from '../../mesh/doorway';
import { plate } from '../../mesh/plate';

/** How much of a plate's width a sign's letters take: the atlas writes 44 px letters, about 22 px each, in a 256 px cell. */
const signWidth = (text: string) => Math.min(0.95, text.length * 0.088 + 0.1);

/** The printed signs: light letters (emit 0.75 tells the shader so) on a dark strip stuck to the wall. */
export function addSigns(b: Builder)
{
    SIGNS.slice(0, LABEL_SLOTS - SIGN_PLATES).forEach((s, i) =>
    {
        b.room = roomAt(s.x, s.y) ?? null;
        const right: V3 = [s.ny, 0, -s.nx];
        const [hw, hh] = [(s.w * signWidth(s.text)) / 2, s.w / 10];
        const at = (dw: number, dh: number, o: number): V3 => [s.x + right[0] * dw + s.nx * o, s.z + dh, s.y + right[2] * dw + s.ny * o];
        b.quad([at(-hw, -hh, 0.006), at(hw, -hh, 0.006), at(hw, hh, 0.006), at(-hw, hh, 0.006)], [s.nx, 0, s.ny], [[0, 0], [1, 0], [1, 1], [0, 1]],
            made(MAT.prop, 'graphite'), 0);
        plate(b, [s.x + s.nx * 0.012, s.z, s.y + s.ny * 0.012], right, s.w, [s.nx, 0, s.ny], SIGN_PLATES + i, 0.75);
    });
}

export const build = (b: Builder) => addSigns(b);
