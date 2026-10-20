/** Names of the system boxes when the apps screen is drawn as a ship's deck plan. */
const SYSTEM_ROOMS: Record<string, string> = {
    'sys:favorites': 'PUENTE',
    'sys:recents': 'BITÁCORA',
    'sys:new': 'HANGAR',
};

/** The compartment name for a box: the ship's name for a system box, the folder's own name otherwise. */
export function roomName(box: { id: string; label: string }): string
{
    return SYSTEM_ROOMS[box.id] ?? box.label;
}

/** A pressure door from closed to open, as the three cells next to the wall: wall, then outwards. */
export const DOOR_FRAMES = ['▓▓▓', '▓▓░', '▓░░', '░░░'] as const;
/** Time each frame of the opening door stays on screen. */
export const DOOR_STEP_MS = 90;

/** The door at `step` (0 closed .. 3 open); out-of-range steps are clamped. `side` mirrors it for the right-hand rooms. */
export function doorFrame(step: number, side: 'left' | 'right' = 'left'): string
{
    const frame = DOOR_FRAMES[Math.min(DOOR_FRAMES.length - 1, Math.max(0, Math.floor(step)))];
    return side === 'left' ? frame : [...frame].reverse().join('');
}

export const DOOR_OPEN_STEP = DOOR_FRAMES.length - 1;

export interface DeckRow<T> { left: T; right: T | null }

/**
 * The plan is a corridor with a compartment on each side: the boxes are paired two to a row, left then right, and
 * an odd box is alone on the left of the last row.
 */
export function deckRows<T>(boxes: readonly T[]): DeckRow<T>[]
{
    const rows: DeckRow<T>[] = [];
    for (let i = 0; i < boxes.length; i += 2) rows.push({ left: boxes[i], right: boxes[i + 1] ?? null });
    return rows;
}
