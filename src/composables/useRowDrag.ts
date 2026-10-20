import { DRAG_THRESHOLD_PX, LIFT_MS, movedPast } from '@/utils/dragDrop';

export interface RowDragHandlers
{
    /** Drag is possible (the list shows folder boxes to drop on). When false, a long press only opens the menu. */
    canDrag: () => boolean;
    /** The row has been held long enough: lift it. */
    onLift: () => void;
    /** Released without moving after a lift: the long-press menu. */
    onMenu: () => void;
    onMove: (x: number, y: number) => void;
    onDrop: (x: number, y: number) => void;
    /** The gesture was interrupted (a second finger, the system took the touch). */
    onCancel: () => void;
}

/**
 * Touch gesture of an app row: hold to lift it; then either drag (drop where it is released) or let go to open the menu.
 * It uses touch events, not pointer events, because pointer events are cancelled once the browser starts scrolling.
 * The lift happens while the finger is still, so the first `touchmove` after it can be cancelled to stop the list from
 * scrolling. A gesture that ended as lift or drop prevents the default of its `touchend`, so the swipe detector and the
 * click that would follow ignore it.
 */
export function useRowDrag(h: RowDragHandlers)
{
    let timer: number | undefined;
    let startX = 0;
    let startY = 0;
    let lifted = false;
    let dragging = false;

    const clear = () => { window.clearTimeout(timer); timer = undefined; };
    const reset = () => { clear(); lifted = false; dragging = false; };

    function onTouchStart(e: TouchEvent)
    {
        reset();
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        timer = window.setTimeout(() => { timer = undefined; lifted = true; h.onLift(); }, LIFT_MS);
    }

    function onTouchMove(e: TouchEvent)
    {
        const t = e.touches[0];
        if (!t) return;
        if (!lifted)
        {
            // the finger moved before the lift: it is a scroll
            if (timer !== undefined && Math.hypot(t.clientX - startX, t.clientY - startY) > DRAG_THRESHOLD_PX) clear();
            return;
        }
        if (e.cancelable) e.preventDefault(); // a lifted row never scrolls the list
        if (!h.canDrag()) return;
        if (!dragging && movedPast(t.clientX - startX, t.clientY - startY)) dragging = true;
        if (dragging) h.onMove(t.clientX, t.clientY);
    }

    function onTouchEnd(e: TouchEvent)
    {
        const t = e.changedTouches[0];
        const wasLifted = lifted;
        const wasDragging = dragging;
        reset();
        if (!wasLifted) return;
        if (e.cancelable) e.preventDefault();
        if (wasDragging && t) h.onDrop(t.clientX, t.clientY); else h.onMenu();
    }

    function onTouchCancel()
    {
        const was = lifted;
        reset();
        if (was) h.onCancel();
    }

    return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
