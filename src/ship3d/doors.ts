import { PORTALS } from './world';

/** How close the camera has to be for a door to open, in metres. */
export const DOOR_RANGE = 3.4;
/** How quickly a door slides (per second, eased). */
const DOOR_RATE = 9;

/** One value per doorway in `PORTALS`: 0 shut, 1 open. */
export const shutDoors = (): number[] => PORTALS.map(() => 0);

/** Slides every door a step toward open when the camera is near it, shut when it is not. Returns a new array. */
export function stepDoors(open: readonly number[], x: number, y: number, dt: number): number[]
{
    const ease = 1 - Math.exp(-DOOR_RATE * dt);
    return PORTALS.map((p, i) =>
    {
        const target = Math.hypot(p.x - x, p.y - y) < DOOR_RANGE ? 1 : 0;
        const v = (open[i] ?? 0) + (target - (open[i] ?? 0)) * ease;
        return Math.abs(target - v) < 0.002 ? target : v;
    });
}
