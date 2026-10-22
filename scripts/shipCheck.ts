// Checks the ship's mesh for faulty geometry and prints a short report: `npm run ship:check`.
//  - coplanar: pairs of triangles in the same plane, facing the same way, that overlap: they fight for the pixel (z-fighting)
//  - open: a solid's side face whose top edge is joined to something but whose bottom edge, above the floor, is not: an open
//    box, seen through from below
// Exits 1 when a solid is open. The coplanar count is only a guide: it can't tell a face that is hidden from one in view,
// so compare it with the figure before a change rather than reading it as a fault. The fingerprint is the vertex count and a hash of the mesh, to compare a refactor before and after.
import { buildMesh, MAT, STRIDE } from '@/ship3d/mesh';
import { openBottoms } from '@/ship3d/meshCheck';

const { data, vertices } = buildMesh();
const MAT_NAME = Object.fromEntries(Object.entries(MAT).map(([k, v]) => [v, k]));
const matOf = (t: number) => MAT_NAME[Math.round(data[t * 3 * STRIDE + 8]) % 16] ?? '?';
const at = (t: number, k: number) => [0, 1, 2].map(c => data[(t * 3 + k) * STRIDE + c]);

let hash = 2166136261;
for (const b of new Uint8Array(data.buffer)) hash = Math.imul(hash ^ b, 16777619) >>> 0;
const lines = [`mesh ${vertices} vertices, hash ${hash.toString(16)}`];

const tris = vertices / 3;
const PLANE_TOL = 0.001;
const AREA_TOL = 1e-4;

const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

interface Tri { i: number; p: number[][]; n: number[]; d: number; axis: number }
const planes = new Map<string, Tri[]>();
for (let i = 0; i < tris; i++)
{
    const p = [at(i, 0), at(i, 1), at(i, 2)];
    const c = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    const len = Math.hypot(...c);
    if (len < 1e-9) continue;
    let n = c.map(v => v / len);
    // one sign per plane: the first non-zero component positive
    const lead = n.find(v => Math.abs(v) > 1e-6) ?? 1;
    // faces turned the same way and in one plane are what fight; back to back ones hide behind each other
    if (lead < 0) n = n.map(v => -v);
    // the way it faces is the normal the mesh declares for it; the winding of a triangle means nothing with culling off
    const flip = [3, 4, 5].reduce((s, c, m) => s + data[i * 3 * STRIDE + c] * n[m], 0) < 0;
    const d = n[0] * p[0][0] + n[1] * p[0][1] + n[2] * p[0][2];
    const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    const key = `${flip ? '-' : '+'}${n.map(v => Math.round(v * 1000)).join(',')}`;
    const tri = { i, p, n, d, axis };
    const bin = Math.round(d / PLANE_TOL);
    const k = `${key}|${bin}`;
    (planes.get(k) ?? planes.set(k, []).get(k)!).push(tri);
}

const project = (t: Tri) => t.p.map(q => [q[(t.axis + 1) % 3], q[(t.axis + 2) % 3]]);
/** Two triangles in the same plane overlap with area when no edge direction separates them. */
function overlap(a: Tri, b: Tri): boolean
{
    const [pa, pb] = [project(a), project(b)];
    for (const poly of [pa, pb])
        for (let k = 0; k < 3; k++)
        {
            const [p, q] = [poly[k], poly[(k + 1) % 3]];
            const ax = [-(q[1] - p[1]), q[0] - p[0]];
            const len = Math.hypot(ax[0], ax[1]) || 1;
            const proj = (pts: number[][]) => pts.map(v => (v[0] * ax[0] + v[1] * ax[1]) / len);
            const [ra, rb] = [proj(pa), proj(pb)];
            if (Math.max(...ra) <= Math.min(...rb) + AREA_TOL || Math.max(...rb) <= Math.min(...ra) + AREA_TOL) return false;
        }
    return true;
}

const clashes = new Map<string, { n: number; at: string }>();
for (const group of planes.values())
    for (let a = 0; a < group.length; a++)
        for (let b = a + 1; b < group.length; b++)
            if (overlap(group[a], group[b]))
            {
                const key = [matOf(group[a].i), matOf(group[b].i)].sort().join(' / ');
                const c = clashes.get(key) ?? { n: 0, at: group[a].p[0].map(v => v.toFixed(2)).join(', ') };
                c.n++;
                clashes.set(key, c);
            }
const clashTotal = [...clashes.values()].reduce((s, c) => s + c.n, 0);
lines.push(`coplanar: ${clashTotal} same-facing overlapping pairs (info: many are hidden behind other faces by design)`);
for (const [key, c] of [...clashes].sort((p, q) => q[1].n - p[1].n).slice(0, 6)) lines.push(`  ${key}: ${c.n}, e.g. at (${c.at})`);

const open = openBottoms({ data, vertices });
lines.push(`open: ${open.total} bottom edges of closed-topped solids`);
for (const [mat, o] of open.byMaterial) lines.push(`  ${mat}: ${o.n}, e.g. at (${o.at.map(v => v.toFixed(2)).join(', ')})`);

console.log(lines.join('\n'));
process.exit(open.total > 0 ? 1 : 0);
