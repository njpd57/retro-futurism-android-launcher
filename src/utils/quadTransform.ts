/** The CSS transform that lays a `w` x `h` box onto any four points (a projective map, so it follows perspective). Pure. */

type P = readonly [number, number];

/** Solves `a x = b` by Gaussian elimination with partial pivoting; null if singular. */
function solve(a: number[][], b: number[]): number[] | null
{
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++)
    {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
        if (Math.abs(m[p][c]) < 1e-12) return null;
        [m[c], m[p]] = [m[p], m[c]];
        for (let r = 0; r < n; r++)
        {
            if (r === c) continue;
            const k = m[r][c] / m[c][c];
            for (let j = c; j <= n; j++) m[r][j] -= k * m[c][j];
        }
    }
    return m.map((row, i) => row[n] / row[i]);
}

/**
 * `matrix3d(...)` that sends the box's corners (0,0), (w,0), (w,h), (0,h) to `to` (same order), for an element with
 * `transform-origin: 0 0`; null if the points make no quad.
 */
export function quadTransform(w: number, h: number, to: readonly P[]): string | null
{
    const from: P[] = [[0, 0], [w, 0], [w, h], [0, h]];
    const a: number[][] = [];
    const b: number[] = [];
    from.forEach(([x, y], i) =>
    {
        const [u, v] = to[i];
        a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
        b.push(u);
        a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
        b.push(v);
    });
    const s = solve(a, b);
    if (!s) return null;
    const [h0, h1, h2, h3, h4, h5, h6, h7] = s;
    // column-major: x' = h0 x + h1 y + h2, y' = h3 x + h4 y + h5, w' = h6 x + h7 y + 1
    return `matrix3d(${[h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1].map(n => +n.toFixed(8)).join(',')})`;
}
