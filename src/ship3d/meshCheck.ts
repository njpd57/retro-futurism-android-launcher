import { MAT, STRIDE, type Mesh } from './mesh';

const MAT_NAME = Object.fromEntries(Object.entries(MAT).map(([k, v]) => [v, k]));
const SOLID = new Set(['prop', 'frame', 'glow']);

/** Where solids are open underneath: for each material, how many edges and where the first is (GL space, metres). */
export interface OpenBottoms { total: number; byMaterial: Map<string, { n: number; at: number[] }> }

/**
 * A solid's side face whose top edge is joined to something but whose bottom edge, above the floor, is not: an open box,
 * seen through from below. Used by `scripts/shipCheck.ts` and by the map editor.
 */
export function openBottoms(mesh: Mesh): OpenBottoms
{
    const { data, vertices } = mesh;
    const tris = vertices / 3;
    const matOf = (t: number) => MAT_NAME[Math.round(data[t * 3 * STRIDE + 8]) % 16] ?? '?';
    const at = (t: number, k: number) => [0, 1, 2].map(c => data[(t * 3 + k) * STRIDE + c]);
    const vkey = (p: number[]) => p.map(v => Math.round(v * 1000)).join(',');

    const edges = new Map<string, { n: number }>();
    for (let i = 0; i < tris; i++)
    {
        if (!SOLID.has(matOf(i))) continue;
        const p = [at(i, 0), at(i, 1), at(i, 2)];
        for (let k = 0; k < 3; k++)
        {
            const key = [vkey(p[k]), vkey(p[(k + 1) % 3])].sort().join('>');
            const e = edges.get(key) ?? { n: 0 };
            e.n++;
            edges.set(key, e);
        }
    }

    const byMaterial = new Map<string, { n: number; at: number[] }>();
    const same = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[2] - q[2]) < 1e-6;
    const used = (a: number[], b: number[]) => edges.get([vkey(a), vkey(b)].sort().join('>'))?.n ?? 0;
    for (let i = 0; i < tris; i++)
    {
        const mat = matOf(i);
        if (!SOLID.has(mat)) continue;
        const p = [at(i, 0), at(i, 1), at(i, 2)];
        for (let k = 0; k < 3; k++)
        {
            const [a, b] = [p[k], p[(k + 1) % 3]];
            if (Math.abs(a[1] - b[1]) > 1e-6 || a[1] <= 0.01 || used(a, b) !== 1) continue;
            // the opposite edge of the same quad is in the next triangle or the previous one
            const joined = [i - 1, i + 1].some(j => j >= 0 && j < tris && [0, 1, 2].some(m =>
            {
                const [c, d] = [at(j, m), at(j, (m + 1) % 3)];
                return Math.abs(c[1] - d[1]) < 1e-6 && Math.abs(c[1] - a[1]) > 1e-6 && (same(c, a) && same(d, b) || same(c, b) && same(d, a)) && used(c, d) >= 2;
            }));
            if (!joined) continue;
            const o = byMaterial.get(mat) ?? { n: 0, at: a };
            o.n++;
            byMaterial.set(mat, o);
        }
    }
    return { total: [...byMaterial.values()].reduce((s, o) => s + o.n, 0), byMaterial };
}
