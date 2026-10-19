export const HAPTIC_TICK_MS = 12;

/** True when the WebView exposes the Vibration API. */
export function canVibrate(nav: { vibrate?: unknown } | undefined = typeof navigator === 'undefined' ? undefined : navigator)
{
    return typeof nav?.vibrate === 'function';
}

/** A short pulse; silently does nothing without the API. */
export function tick(ms = HAPTIC_TICK_MS)
{
    if (!canVibrate()) return false;
    try { return navigator.vibrate(ms); }
    catch { return false; }
}
