import { bridgeHas } from './bridgeHas';

export const HAPTIC_TICK_MS = 12;

/** True when the fork's native vibrator or the WebView's Vibration API is available. */
export function canVibrate(nav: { vibrate?: unknown } | undefined = typeof navigator === 'undefined' ? undefined : navigator)
{
    return bridgeHas('requestVibrate') || typeof nav?.vibrate === 'function';
}

/** A short pulse, through the fork when it has it (the WebView has no `navigator.vibrate`); silently does nothing otherwise. */
export function tick(ms = HAPTIC_TICK_MS)
{
    try
    {
        if (bridgeHas('requestVibrate')) return Bridge.requestVibrate(ms);
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return navigator.vibrate(ms);
    }
    catch { /* haptics are optional */ }
    return false;
}
