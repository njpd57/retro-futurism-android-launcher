import { useMediaQuery } from '@vueuse/core';

const QUERY = '(prefers-reduced-motion: reduce)';

/** One-shot read, for code that decides once (a canvas loop, the boot screen). */
export function prefersReducedMotion(): boolean
{
    return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** Reactive version, for components that must follow the system setting while mounted. */
export function useReducedMotion()
{
    return useMediaQuery(QUERY);
}
