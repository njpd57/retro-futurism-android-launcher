import { describe, expect, it } from 'vitest';
import { EYE_HEIGHT, fovYFor, multiply, perspective, transform, viewMatrix, yawOf, type V3 } from '../math';
import { pickScreen, REACH } from '../pick';
import { CARDS } from '../cards';
import { screenById, screenNormal, SCREENS, type ScreenDef } from '../world';
import { WIDGETS } from '@/widgets/registry';

const W = 390;
const H = 700;

/** The pixel a GL-space point lands on. */
function pixelOf(eye: V3, yaw: number, pitch: number, p: V3): [number, number]
{
    const [x, y, , w] = transform(multiply(perspective(fovYFor(W / H), W / H, 0.08, 90), viewMatrix(eye, yaw, pitch)), p);
    return [((x / w + 1) / 2) * W, ((1 - y / w) / 2) * H];
}

/** An eye `back` metres in front of a screen, looking at it. */
function facing(s: ScreenDef, back: number): { eye: V3; yaw: number }
{
    const [nx, ny] = screenNormal(s);
    return { eye: [s.x + nx * back, EYE_HEIGHT, s.y + ny * back], yaw: yawOf(-nx, -ny) };
}

describe('pickScreen', () =>
{
    const screen = screenById('motor.reserva')!;

    it('finds the monitor under its own centre, at the right distance', () =>
    {
        const { eye, yaw } = facing(screen, 3);
        const [px, py] = pixelOf(eye, yaw, 0, [screen.x, screen.z, screen.y]);
        const hit = pickScreen(eye, yaw, 0, W, H, px, py);
        expect(hit?.screen.id).toBe('motor.reserva');
        expect(hit?.distance).toBeCloseTo(3, 1);
        expect(REACH).toBeGreaterThan(3);
    });

    it('misses bare wall and the floor', () =>
    {
        const { eye, yaw } = facing(screen, 3);
        expect(pickScreen(eye, yaw, 0, W, H, 10, 10)).toBeNull();
        expect(pickScreen(eye, yaw, 0, W, H, W / 2, H - 10)).toBeNull();
    });

    it('does not pick a monitor seen from behind', () =>
    {
        const { eye, yaw } = facing(screen, 3);
        // turned round it sees the room's other monitor across the floor, never the one at its back
        expect(pickScreen(eye, yaw + Math.PI, 0, W, H, W / 2, H / 2)?.screen.id).not.toBe('motor.reserva');
    });

    it('does not pick a monitor through a wall', () =>
    {
        // the engine room's east monitor, from the corridor outside its wall
        const east = screenById('motor.enlace')!;
        const eye: V3 = [11, EYE_HEIGHT, east.y];
        const [px, py] = pixelOf(eye, yawOf(-1, 0), 0, [east.x, east.z, east.y]);
        expect(pickScreen(eye, yawOf(-1, 0), 0, W, H, px, py)).toBeNull();
    });

    it('can pick every monitor from three metres in front of it', () =>
    {
        for (const s of SCREENS)
        {
            const { eye, yaw } = facing(s, 3);
            const [px, py] = pixelOf(eye, yaw, 0, [s.x, s.z, s.y]);
            expect(pickScreen(eye, yaw, 0, W, H, px, py)?.screen.id, s.id).toBe(s.id);
        }
    });
});

describe('cards', () =>
{
    it('exist for every room and only use widgets that exist', () =>
    {
        expect(Object.keys(CARDS).sort()).toEqual([...new Set(SCREENS.map(s => s.zone).filter(z => z !== 'hub'))].sort());
        for (const widgets of Object.values(CARDS))
            for (const w of widgets)
            {
                expect(WIDGETS[w.kind], w.kind).toBeDefined();
                expect(w.rows).toBeGreaterThanOrEqual(1);
            }
    });
});
