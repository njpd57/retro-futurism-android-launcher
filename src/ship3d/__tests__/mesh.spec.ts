import { describe, expect, it } from 'vitest';
import { ATLAS_H, ATLAS_W, COLS, ROWS, SLOT, slotRect, slotUv } from '../atlas';
import { nearestLights, packLights } from '../lights';
import { buildMesh, MAT, MAT_STYLE, screenFrame, STRIDE, STYLE, stencilSpot } from '../mesh';
import { STENCIL_PLATES, STENCILS } from '../labels';
import { bounds, LIGHTS, PORTALS, ROOMS, roomAt, SCREENS } from '../world';

describe('buildMesh', () =>
{
    const mesh = buildMesh();
    const b = bounds();

    it('is whole triangles of finite numbers', () =>
    {
        expect(mesh.data.length).toBe(mesh.vertices * STRIDE);
        expect(mesh.vertices % 3).toBe(0);
        expect(mesh.vertices).toBeGreaterThan(1000);
        expect(mesh.data.every(Number.isFinite)).toBe(true);
    });

    it('stays inside the ship and under its tallest ceiling', () =>
    {
        for (let i = 0; i < mesh.vertices; i++)
        {
            const [x, up, z] = [mesh.data[i * STRIDE], mesh.data[i * STRIDE + 1], mesh.data[i * STRIDE + 2]];
            expect(x).toBeGreaterThanOrEqual(b.x0 - 0.5);
            expect(x).toBeLessThanOrEqual(b.x1 + 0.5);
            expect(z).toBeGreaterThanOrEqual(b.y0 - 0.5);
            expect(z).toBeLessThanOrEqual(b.y1 + 0.5);
            expect(up).toBeGreaterThanOrEqual(-0.001);
            expect(up).toBeLessThanOrEqual(7.001);
        }
    });

    it('has unit normals and known materials', () =>
    {
        const mats = new Set(Object.values(MAT));
        for (let i = 0; i < mesh.vertices; i++)
        {
            const o = i * STRIDE;
            expect(Math.hypot(mesh.data[o + 3], mesh.data[o + 4], mesh.data[o + 5])).toBeCloseTo(1, 4);
            expect(mats.has((mesh.data[o + 8] % MAT_STYLE) as never)).toBe(true);
            expect(mesh.data[o + 9]).toBeGreaterThanOrEqual(0);
            expect(mesh.data[o + 9]).toBeLessThanOrEqual(1);
        }
    });

    it('stays near the budget of the plain ship, with the details of phase 3', () =>
    {
        // 6810 vertices before the details; they may add at most 40 %
        expect(mesh.vertices).toBeLessThan(6810 * 1.4);
    });

    it('carries each room style in its walls, floors and ceilings', () =>
    {
        const styles = new Set<number>();
        for (let i = 0; i < mesh.vertices; i++)
        {
            const m = mesh.data[i * STRIDE + 8];
            const base = m % MAT_STYLE;
            const style = Math.floor(m / MAT_STYLE);
            if (base === MAT.wall || base === MAT.floor || base === MAT.ceiling) styles.add(style);
            else expect(style, `material ${base}`).toBe(0);
        }
        expect([...styles].sort()).toEqual([...new Set(Object.values(STYLE))].sort());
    });

    it('lays chevrons on the floor at the doors of the working rooms and nowhere else', () =>
    {
        const hazard: [number, number][] = [];
        for (let i = 0; i < mesh.vertices; i++)
            if (mesh.data[i * STRIDE + 8] === MAT.hazard) hazard.push([mesh.data[i * STRIDE], mesh.data[i * STRIDE + 2]]);
        expect(hazard.length).toBeGreaterThan(0);
        expect(hazard.length % 6).toBe(0);
        for (const [x, y] of hazard)
        {
            expect(['bodega', 'hangar', 'motor']).toContain(roomAt(x, y)?.zone ?? roomAt(x + 0.001, y + 0.001)?.zone);
            expect(PORTALS.some(p => Math.hypot(p.x - x, p.y - y) < 3)).toBe(true);
        }
    });

    it('gives each monitor six vertices of the screen material inside its atlas cell', () =>
    {
        const screens: number[] = [];
        for (let i = 0; i < mesh.vertices; i++) if (mesh.data[i * STRIDE + 8] === MAT.screen) screens.push(i);
        expect(screens).toHaveLength(SCREENS.length * 6);
        for (const i of screens)
        {
            const [u, v] = [mesh.data[i * STRIDE + 6], mesh.data[i * STRIDE + 7]];
            expect(u).toBeGreaterThanOrEqual(0);
            expect(u).toBeLessThanOrEqual(1);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
        }
    });
});

describe('screenFrame', () =>
{
    it('has a unit normal facing the way the screen looks and a right axis across it', () =>
    {
        for (const s of SCREENS)
        {
            const f = screenFrame(s);
            expect(Math.hypot(...f.normal)).toBeCloseTo(1);
            expect(f.normal[0] * f.right[0] + f.normal[2] * f.right[2]).toBeCloseTo(0);
        }
    });
});

describe('atlas', () =>
{
    it('has a slot for every monitor, inside the texture and apart from the others', () =>
    {
        expect(SCREENS.length).toBeLessThanOrEqual(COLS * ROWS);
        expect(new Set(Object.values(SLOT)).size).toBe(SCREENS.length);
        for (const s of SCREENS)
        {
            const r = slotRect(SLOT[s.id]);
            expect(r.x + r.w).toBeLessThanOrEqual(ATLAS_W);
            expect(r.y + r.h).toBeLessThanOrEqual(ATLAS_H);
            const [u0, v0, u1, v1] = slotUv(SLOT[s.id]);
            expect(u1).toBeGreaterThan(u0);
            expect(v1).toBeGreaterThan(v0);
        }
    });
});

describe('lights', () =>
{
    it('picks the nearest first and pads with dark ones', () =>
    {
        const lights = [{ x: 0, y: 0, z: 3, power: 1 }, { x: 10, y: 0, z: 3, power: 1 }, { x: 2, y: 0, z: 3, power: 1 }];
        expect(nearestLights(lights, 1.8, 0, 1.6, 2)).toEqual([2, 0]);
        const packed = packLights(lights, [2, 0], i => (i === 2 ? 2 : 1), 4);
        expect(Array.from(packed.slice(0, 4))).toEqual([2, 3, 0, 2]);
        expect(Array.from(packed.slice(8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('chooses at most eight of the ship lights', () =>
    {
        expect(nearestLights(LIGHTS, 0, -11.8, 1.6)).toHaveLength(8);
    });
});

describe('stencils', () =>
{
    it('sit on a wall of their room, clear of the monitors, one for each room that has one', () =>
    {
        for (const [i, s] of STENCILS.entries())
        {
            const room = ROOMS.find(r => r.id === s.room)!;
            const spot = stencilSpot(room)!;
            expect(spot, s.room).not.toBeNull();
            expect(roomAt(spot.x + spot.nx * 0.3, spot.y + spot.ny * 0.3)?.id, s.room).toBe(room.id);
            for (const sc of SCREENS) expect(Math.hypot(sc.x - spot.x, sc.y - spot.y), `${s.room} near ${sc.id}`).toBeGreaterThan(1.8);
            expect(STENCIL_PLATES + i).toBeLessThan(28);
        }
    });
});
