import { STENCIL_PLATES, STENCILS } from '../../labels';
import { PORTALS, ROOMS, SCREENS, splitEdge, type Room } from '../../world';
import { Builder } from '../../mesh/builder';
import { plate } from '../../mesh/plate';

/** A name stencil on the wall beside the room's door, away from monitors. */
export function stencilSpot(room: Room): { x: number; y: number; nx: number; ny: number } | null
{
    const near = (x: number, y: number, list: readonly { x: number; y: number }[], r: number) => list.some(q => Math.hypot(q.x - x, q.y - y) < r);
    let fallback: { x: number; y: number; nx: number; ny: number } | null = null;
    for (let i = 0; i < room.poly.length; i++)
    {
        const e = splitEdge(room, i);
        for (const [from, to] of e.walls)
        {
            if (to - from < 2.4) continue;
            for (const t of [from + 1.3, to - 1.3])
            {
                const x = e.ax + e.dx * t + e.nx * 0.02;
                const y = e.ay + e.dy * t + e.ny * 0.02;
                if (near(x, y, SCREENS, 1.9)) continue;
                const spot = { x, y, nx: e.nx, ny: e.ny };
                if (near(x, y, PORTALS, 3.2)) return spot;
                fallback ??= spot;
            }
        }
    }
    return fallback;
}

export function addStencils(b: Builder)
{
    STENCILS.forEach((s, i) =>
    {
        const room = ROOMS.find(r => r.id === s.room);
        const spot = room && stencilSpot(room);
        if (spot) plate(b, [spot.x, 2.2, spot.y], [spot.ny, 0, -spot.nx], 2, [spot.nx, 0, spot.ny], STENCIL_PLATES + i, 0.5);
    });
}

export const build = (b: Builder) => addStencils(b);
