import { describe, expect, it } from 'vitest';
import { collides } from '../collide';
import { bounds, collisionSegments, inside, LIGHTS, PORTALS, PROPS, propOutline, roomAt, roomById, ROOMS, SCREENS, screenNormal, splitEdge, START } from '../world';

describe('rooms', () =>
{
    it('have unique ids, convex outlines and sensible heights', () =>
    {
        expect(new Set(ROOMS.map(r => r.id)).size).toBe(ROOMS.length);
        for (const r of ROOMS)
        {
            expect(r.poly.length).toBeGreaterThanOrEqual(4);
            expect(r.height).toBeGreaterThanOrEqual(3);
            // convex: every vertex is on the same side of every edge
            for (const [x, y] of r.poly) expect(inside(r.poly, x, y, -1e-6), r.id).toBe(true);
        }
    });

    it('include the nine rooms the data lives in', () =>
    {
        const zones = new Set(ROOMS.map(r => r.zone));
        for (const z of ['puente', 'comms', 'motor', 'bodega', 'enfermeria', 'hipersueno', 'comedor', 'camarotes', 'hangar']) expect(zones.has(z as never), z).toBe(true);
    });

    it('do not overlap', () =>
    {
        for (const a of ROOMS) for (const b of ROOMS)
        {
            if (a === b) continue;
            // no vertex of one lies well inside the other
            for (const [x, y] of a.poly) expect(inside(b.poly, x, y, 0.1), `${a.id} in ${b.id}`).toBe(false);
        }
    });
});

describe('doors', () =>
{
    it('each lies on exactly two rooms, opening both walls', () =>
    {
        for (const p of PORTALS)
        {
            let sides = 0;
            for (const r of ROOMS) for (let i = 0; i < r.poly.length; i++)
                if (splitEdge(r, i).doors.some(d => d.portal === p)) sides++;
            expect(sides, `${p.x},${p.y}`).toBe(2);
        }
    });

    it('connect every room to the bridge', () =>
    {
        const touching = (id: string) => PORTALS.filter(p => ROOMS.find(r => r.id === id)!.poly.some((_, i) => splitEdge(roomById(id)!, i).doors.some(d => d.portal === p)));
        const seen = new Set<string>(['puente']);
        const queue = ['puente'];
        while (queue.length)
        {
            const at = queue.shift()!;
            for (const p of touching(at))
                for (const r of ROOMS)
                    if (!seen.has(r.id) && touching(r.id).includes(p)) { seen.add(r.id); queue.push(r.id); }
        }
        expect([...seen].sort()).toEqual(ROOMS.map(r => r.id).sort());
    });
});

describe('screens', () =>
{
    /** the rooms a screen may stand in: the ship's terminal (`hub`) hangs in the mess */
    const roomsOf = (s: (typeof SCREENS)[number]) => ROOMS.filter(r => r.zone === (s.zone === 'hub' ? 'comedor' : s.zone));

    it('have unique ids, sit on a wall of a room of their zone and face into it', () =>
    {
        expect(new Set(SCREENS.map(s => s.id)).size).toBe(SCREENS.length);
        for (const s of SCREENS.filter(q => !q.hung))
        {
            const rooms = roomsOf(s);
            const [nx, ny] = screenNormal(s);
            // a little in front of the screen is inside the room, a little behind it is not
            expect(rooms.some(r => inside(r.poly, s.x + nx * 0.3, s.y + ny * 0.3)), s.id).toBe(true);
            expect(rooms.some(r => inside(r.poly, s.x - nx * 0.3, s.y - ny * 0.3)), `${s.id} behind`).toBe(false);
            expect(s.z + s.h / 2, s.id).toBeLessThanOrEqual(rooms[0].height);
        }
    });

    it('hang over the mess table on its crown, facing out, below the ceiling and above the heads', () =>
    {
        const hung = SCREENS.filter(s => s.hung);
        expect(hung).toHaveLength(4);
        for (const s of hung)
        {
            const [nx, ny] = screenNormal(s);
            expect(roomAt(s.x, s.y)?.zone, s.id).toBe('comedor');
            // facing away from the middle
            expect(s.x * nx + s.y * ny, s.id).toBeGreaterThan(1);
            expect(s.z - s.h / 2, s.id).toBeGreaterThan(2.5);
            expect(s.z + s.h / 2, s.id).toBeLessThan(roomAt(s.x, s.y)!.height);
        }
    });

    it('hang flush on a real wall: a few centimetres off it, not buried or floating', () =>
    {
        for (const s of SCREENS.filter(q => !q.hung))
        {
            let nearest = Infinity;
            for (const r of roomsOf(s))
                for (let i = 0; i < r.poly.length; i++)
                {
                    const e = splitEdge(r, i);
                    // distance to the infinite edge line, for the stretch of wall that is actually wall
                    const along = (s.x - e.ax) * e.dx + (s.y - e.ay) * e.dy;
                    if (!e.walls.some(([from, to]) => along >= from && along <= to)) continue;
                    nearest = Math.min(nearest, Math.abs((s.x - e.ax) * e.nx + (s.y - e.ay) * e.ny));
                }
            expect(nearest, s.id).toBeGreaterThan(0.02);
            expect(nearest, s.id).toBeLessThan(0.07);
        }
    });

    it('cover every id the readings produce', () =>
    {
        expect(SCREENS).toHaveLength(20);
    });
});

describe('props and the start', () =>
{
    const segs = collisionSegments();

    it('stand inside a room and leave every doorway free', () =>
    {
        for (const p of PROPS)
        {
            expect(roomAt(p.x, p.y), `${p.kind} ${p.x},${p.y}`).toBeDefined();
            for (const door of PORTALS) expect(Math.hypot(p.x - door.x, p.y - door.y) > p.w / 2 + 1.2, `${p.x},${p.y} near door ${door.x},${door.y}`).toBe(true);
        }
    });

    it('keep a body-sized gap to the walls on the bridge floor', () =>
    {
        expect(collides(segs, START.x, START.y, 0.3)).toBe(false);
        expect(roomAt(START.x, START.y)?.zone).toBe('puente');
    });

    it('outline boxes with four corners and columns with the asked number', () =>
    {
        expect(propOutline(PROPS.find(p => p.kind === 'box')!, 16)).toHaveLength(4);
        expect(propOutline(PROPS.find(p => p.kind === 'cyl')!, 16)).toHaveLength(16);
    });
});

describe('lights and bounds', () =>
{
    it('light every room and every light is inside the ship', () =>
    {
        for (const r of ROOMS) expect(LIGHTS.some(l => inside(r.poly, l.x, l.y) && l.z > 1), r.id).toBe(true);
        const b = bounds();
        for (const l of LIGHTS)
        {
            expect(l.x).toBeGreaterThanOrEqual(b.x0 - 1);
            expect(l.x).toBeLessThanOrEqual(b.x1 + 1);
            expect(l.power).toBeGreaterThan(0);
        }
    });
});
