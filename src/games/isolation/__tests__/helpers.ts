import { IDLE, centreOf, step, type Controls, type GameEvent, type GameState } from '../game';

export const EAST = Math.PI / 2;
export const FORWARD: Controls = { move: 1, strafe: 0, turn: 0 };

/** The player stands in the middle of `cell`, looking along `yaw`. */
export const at = (s: GameState, cell: number, yaw = s.player.yaw): GameState => ({ ...s, player: { ...s.player, ...centreOf(s.grid, cell), yaw } });

/** Holds the controls for `ms`, in 50 ms steps, until `until` or the time is up. */
export function run(s: GameState, ms: number, controls: Controls = IDLE, until: (s: GameState, e: GameEvent[]) => boolean = () => false, rng: () => number = () => 0)
{
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += 50)
    {
        const r = step(s, 50, rng, controls);
        s = r.state;
        events.push(...r.events);
        if (until(s, r.events)) break;
    }
    return { s, events };
}
