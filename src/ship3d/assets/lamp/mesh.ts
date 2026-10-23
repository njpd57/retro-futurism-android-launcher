import { LIGHTS, roomAt, type Light, type Room } from '../../world';
import { MAT, Builder } from '../../mesh/builder';

/** A glowing lamp panel on the ceiling under each ceiling light. */
export function addLamp(b: Builder, l: Light, room: Room)
{
    b.room = null;
    const y = room.height - 0.02;
    b.quad([[l.x - 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y - 0.25], [l.x + 0.8, y, l.y + 0.25], [l.x - 0.8, y, l.y + 0.25]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], MAT.glow, 1);
}

/** A lamp panel under every light that hangs at `height - 0.3` (the lamp grid, and extra lights placed there). */
export function build(b: Builder)
{
    for (const l of LIGHTS)
    {
        const room = roomAt(l.x, l.y);
        if (room && Math.abs(l.z - (room.height - 0.3)) < 1e-6) addLamp(b, l, room);
    }
}
