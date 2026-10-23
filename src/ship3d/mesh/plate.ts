import { labelUv } from '../atlas';
import type { V3 } from '../math';
import { MAT, Builder } from './builder';

/** A name plate: a quad of the atlas's plate `slot`, centred on `c` (GL space), `w` wide, spanning `right`, facing `n`. */
export function plate(b: Builder, c: V3, right: V3, w: number, n: V3, slot: number, emit = 1)
{
    b.room = null;
    const [u0, v0, u1, v1] = labelUv(slot);
    const hw = w / 2;
    const hh = w / 8;
    const at = (dw: number, dh: number): V3 => [c[0] + right[0] * dw, c[1] + dh, c[2] + right[2] * dw];
    b.quad([at(-hw, hh), at(hw, hh), at(hw, -hh), at(-hw, -hh)], n, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], MAT.label, emit);
}
