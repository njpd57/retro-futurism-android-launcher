import { describe, expect, it } from 'vitest';
import { collides } from '../collide';
import { agentsOf, BUNK_SLOTS, newRoamers, SIGNAL_SLOTS, stationaryAgents, stepRoamer } from '../crew';
import { DOOR_RANGE, shutDoors, stepDoors } from '../doors';
import { figureVertices } from '../figures';
import { buildMesh, MAT, STRIDE } from '../mesh';
import { pickAgent } from '../pick';
import { collisionSegments, inside, PORTALS, ROOMS, roomAt } from '../world';
import { EYE_HEIGHT } from '../math';

const segs = collisionSegments();

describe('doors', () =>
{
    it('start shut, open as the camera comes near and shut again when it leaves', () =>
    {
        const near = PORTALS[0];
        let open = shutDoors();
        expect(open.every(v => v === 0)).toBe(true);
        for (let i = 0; i < 60; i++) open = stepDoors(open, near.x, near.y + 1, 1 / 60);
        expect(open[0]).toBeGreaterThan(0.99);
        // a door on the other side of the ship stays shut
        expect(open[PORTALS.length - 1]).toBe(0);
        for (let i = 0; i < 120; i++) open = stepDoors(open, near.x, near.y + DOOR_RANGE + 10, 1 / 60);
        expect(open[0]).toBe(0);
    });

    it('slide smoothly: a short step never jumps a door open', () =>
    {
        const p = PORTALS[0];
        const open = stepDoors(shutDoors(), p.x, p.y, 1 / 60);
        expect(open[0]).toBeGreaterThan(0);
        expect(open[0]).toBeLessThan(0.3);
    });
});

describe('the door leaves in the mesh', () =>
{
    it('are two per doorway, numbered by doorway, no higher than the door', () =>
    {
        const mesh = buildMesh();
        const ids = new Set<number>();
        let verts = 0;
        for (let i = 0; i < mesh.vertices; i++)
        {
            const o = i * STRIDE;
            if (mesh.data[o + 8] !== MAT.door) continue;
            verts++;
            ids.add(Math.round(mesh.data[o + 9] * 16));
            expect(mesh.data[o + 1]).toBeLessThanOrEqual(2.6 + 1e-6);
        }
        expect(verts).toBe(PORTALS.length * 2 * 6);
        expect([...ids].sort((a, b) => a - b)).toEqual(PORTALS.map((_, i) => i));
    });
});

describe('stationary crew', () =>
{
    it('stand in their own places, free of walls and furniture', () =>
    {
        for (const s of SIGNAL_SLOTS)
        {
            expect(roomAt(s.x, s.y)?.id).toBe('comms');
            expect(collides(segs, s.x, s.y, 0.25)).toBe(false);
        }
        for (const s of BUNK_SLOTS)
        {
            expect(roomAt(s.x, s.y)?.id).toBe('comedor');
            expect(collides(segs, s.x, s.y, 0.25)).toBe(false);
        }
    });

    it('are as many as there are signals and contacts, up to the places there are', () =>
    {
        expect(stationaryAgents(0, 0)).toHaveLength(0);
        expect(stationaryAgents(3, 2).map(a => a.kind)).toEqual(['signal', 'signal', 'signal', 'contact', 'contact']);
        expect(stationaryAgents(99, 99)).toHaveLength(SIGNAL_SLOTS.length + BUNK_SLOTS.length);
        expect(stationaryAgents(-2, -2)).toHaveLength(0);
    });
});

describe('roamers', () =>
{
    // a fixed sequence so the test is the same every time
    const sequence = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    it('wait, walk to another room along clear routes and never leave the ship', () =>
    {
        let roamers = newRoamers();
        const rng = sequence(7);
        const visited = new Set<string>();
        for (let t = 0; t < 600; t += 0.1)
        {
            roamers = roamers.map(r => stepRoamer(r, 0.1, rng));
            for (const r of roamers)
            {
                expect(ROOMS.some(room => inside(room.poly, r.x, r.y, -0.05)), `${r.id} at ${r.x.toFixed(2)},${r.y.toFixed(2)}`).toBe(true);
                expect(collides(segs, r.x, r.y, 0.2), `${r.id} touches something at ${r.x.toFixed(2)},${r.y.toFixed(2)}`).toBe(false);
                visited.add(`${r.id}:${r.room}`);
            }
        }
        // in ten minutes each went somewhere else more than once
        expect([...visited].filter(v => v.startsWith('jones')).length).toBeGreaterThan(2);
        expect([...visited].filter(v => v.startsWith('ash')).length).toBeGreaterThan(2);
    });

    it('stand still while waiting', () =>
    {
        const [jones] = newRoamers();
        const next = stepRoamer(jones, 0.1, () => 0.5);
        expect([next.x, next.y]).toEqual([jones.x, jones.y]);
        expect(next.wait).toBeLessThan(jones.wait);
    });
});

describe('figures and picking', () =>
{
    const agents = agentsOf(stationaryAgents(2, 1), newRoamers());

    it('are whole triangles of finite numbers with the crew material', () =>
    {
        const data = figureVertices(agents, 1.2, new Set(['jones']));
        expect(data.length % (STRIDE * 3)).toBe(0);
        expect(data.length).toBeGreaterThan(STRIDE * 3 * agents.length);
        expect(data.every(Number.isFinite)).toBe(true);
        const mats = new Set<number>();
        for (let i = 0; i < data.length; i += STRIDE) mats.add(data[i + 8]);
        expect([...mats].every(m => m === MAT.crew || m === MAT.glow)).toBe(true);
    });

    it('can be picked from the front and not through a wall', () =>
    {
        const crew = agents.find(a => a.kind === 'signal')!;
        // two metres south of the first signal, looking north at it
        const eye: [number, number, number] = [crew.x, EYE_HEIGHT, crew.y + 2];
        const hit = pickAgent(agents, eye, 0, -0.1, 390, 700, 195, 350);
        expect(hit?.agent.id).toBe(crew.id);
        // the same crew seen from the corridor outside, through the wall
        const far: [number, number, number] = [-8, EYE_HEIGHT, 0];
        expect(pickAgent([crew], far, -Math.PI / 2, 0, 390, 700, 195, 350)).toBeNull();
    });
});
