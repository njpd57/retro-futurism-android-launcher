const MOVE_THRESHOLD_PX = 10;

/**
 * Long press detection for a list row. `consumeLongPress()` must be called by the click handler:
 * it returns true once after a long press, so the click that ends it can be ignored.
 */
export function useLongPress(onLongPress: () => void, delayMs = 500)
{
    let timer: number | undefined;
    let startX = 0;
    let startY = 0;
    let fired = false;

    function cancel()
    {
        window.clearTimeout(timer);
        timer = undefined;
    }

    function onPointerDown(e: PointerEvent)
    {
        fired = false;
        startX = e.clientX;
        startY = e.clientY;
        cancel();
        timer = window.setTimeout(() => { fired = true; onLongPress(); }, delayMs);
    }

    function onPointerMove(e: PointerEvent)
    {
        if (timer !== undefined && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESHOLD_PX)
            cancel();
    }

    function consumeLongPress()
    {
        const was = fired;
        fired = false;
        return was;
    }

    return { onPointerDown, onPointerMove, onPointerUp: cancel, onPointerCancel: cancel, consumeLongPress };
}
