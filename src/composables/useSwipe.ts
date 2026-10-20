import type { Ref } from 'vue';
import { classifySwipe, type SwipeKind } from '@/utils/swipe';

/** Elements that own their own touch gestures. */
const OWN_TOUCH = 'input, textarea, canvas, [data-no-swipe]';

/**
 * Swipe detection with touch events (pointer events get cancelled when the browser starts a scroll).
 * Listeners are passive and never prevent default, so scrolling is untouched.
 */
export function useSwipe(el: Ref<HTMLElement | null>, onSwipe: (kind: SwipeKind) => void, enabled: () => boolean)
{
    let start: { x: number; y: number; t: number; top: number } | null = null;
    let target: HTMLElement | null = null;

    function onStart(e: TouchEvent)
    {
        const touch = e.touches[0];
        if (e.touches.length !== 1 || !touch || !enabled() || (e.target as HTMLElement | null)?.closest?.(OWN_TOUCH))
        {
            start = null;
            return;
        }
        const top = el.value?.getBoundingClientRect().top ?? 0;
        start = { x: touch.clientX, y: touch.clientY, t: Date.now(), top };
    }

    function onEnd(e: TouchEvent)
    {
        const touch = e.changedTouches[0];
        const s = start;
        start = null;
        // a child (a lifted app row being dragged) already took this touch
        if (!s || !touch || e.defaultPrevented) return;
        const kind = classifySwipe({ dx: touch.clientX - s.x, dy: touch.clientY - s.y, startY: s.y - s.top, ms: Date.now() - s.t });
        if (kind) onSwipe(kind);
    }

    function onCancel() { start = null; }

    function attach(node: HTMLElement)
    {
        node.addEventListener('touchstart', onStart, { passive: true });
        node.addEventListener('touchend', onEnd, { passive: true });
        node.addEventListener('touchcancel', onCancel, { passive: true });
        target = node;
    }

    return {
        /** call from onMounted once the element exists */
        attach: () => { if (el.value) attach(el.value); },
        detach: () => { target?.removeEventListener('touchstart', onStart); target?.removeEventListener('touchend', onEnd); target?.removeEventListener('touchcancel', onCancel); target = null; },
    };
}
