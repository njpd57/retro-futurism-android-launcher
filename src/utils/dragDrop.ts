/** How long a finger must rest on an app row before it is lifted. */
export const LIFT_MS = 450;
/** How far a lifted row must move before it counts as a drag (below that, releasing opens the menu). */
export const DRAG_THRESHOLD_PX = 12;
/** The id of the drop zone that creates a folder. */
export const NEW_FOLDER_ID = 'new-folder';
/** Height reserved for that drop zone at the bottom of the list, in px. */
export const NEW_FOLDER_BAR_PX = 40;

export function movedPast(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean
{
    return Math.hypot(dx, dy) > threshold;
}

export type DropAction =
    | { type: 'none' }
    | { type: 'folder'; name: string }
    | { type: 'new' };

/**
 * What dropping an app on `targetId` does. Only the user's own folders accept apps (FAVORITAS, RECIENTES and NUEVAS are
 * filters), dropping on the folder the app is already in does nothing, and the new-folder zone asks for a name.
 */
export function dropAction(targetId: string | null, boxes: readonly { id: string; kind: 'system' | 'folder'; label: string }[], currentFolder: string | null): DropAction
{
    if (targetId === null) return { type: 'none' };
    if (targetId === NEW_FOLDER_ID) return { type: 'new' };
    const box = boxes.find(b => b.id === targetId);
    if (!box || box.kind !== 'folder' || box.label === currentFolder) return { type: 'none' };
    return { type: 'folder', name: box.label };
}

/**
 * Pixels to scroll per tick while a row is dragged near the edge of the list: negative up, positive down, 0 in the
 * middle. It speeds up the closer the finger is to the edge, and past it.
 */
export function autoScrollSpeed(y: number, top: number, bottom: number, edge = 56, max = 14): number
{
    if (y < top + edge) return -Math.min(max, Math.max(1, Math.round((top + edge - y) / edge * max)));
    if (y > bottom - edge) return Math.min(max, Math.max(1, Math.round((y - (bottom - edge)) / edge * max)));
    return 0;
}
