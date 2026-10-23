import { computed } from 'vue';
import { controlState, liveLabel, readout, RINGER_STOPS, SHORTCUT_BUTTONS, type ControlInput } from '@/ship3d/actions';
import type { ControlLock, ControlState } from '@/ship3d/controls';
import { CONTROLS } from '@/ship3d/world';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { useMediaStore } from '@/stores/useMediaStore';
import { useQuickSettingsStore } from '@/stores/useQuickSettingsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSystemStatusStore } from '@/stores/useSystemStatusStore';
import type { BridgeRingerMode } from '@/types/bridge-fork';
import { bridgeHas } from '@/utils/bridgeHas';
import { formatClock } from '@/utils/tui';
import { useAppShortcuts } from './useAppShortcuts';

/** The brightness a hypersleep capsule turns the screen down to. */
const SLEEP_BRIGHTNESS = 0.08;

/** The ship's controls tied to the phone: the state each one shows, what moving one does, and the capsules' sleep. */
export function useShipControls()
{
    const quick = useQuickSettingsStore();
    const media = useMediaStore();
    const alarm = useAlarmStore();
    const system = useSystemStatusStore();
    const settings = useSettingsStore();
    // the hangar's console works the shortcuts of the first favourite app
    const favourite = computed(() => settings.favorites[0] ?? null);
    const { shortcuts, start } = useAppShortcuts(favourite);
    // shortcuts can be read only while Bridge is the home app
    const canShortcuts = (() =>
    {
        try { return bridgeHas('getCanAccessAppShortcuts') && Bridge.getCanAccessAppShortcuts(); }
        catch { return false; }
    })();

    const input = computed<ControlInput>(() => ({
        linked: quick.supported,
        hasFlashlight: quick.hasFlashlight,
        flashlight: quick.flashlight,
        brightness: quick.brightness,
        ringer: quick.ringer,
        volume: quick.volume,
        night: quick.nightMode === null ? null : quick.nightMode === 'yes',
        canWriteSettings: quick.canWriteSettings,
        canPolicy: quick.canPolicy,
        canNight: quick.canNight,
        wifi: quick.wifi,
        bluetooth: quick.bluetooth,
        location: quick.location,
        online: system.connectivity ? system.connectivity.type !== 'none' : null,
        media: media.supported ? { playing: media.session?.state === 'playing' } : null,
        alarm: alarm.supported ? (alarm.nextAlarm ? { at: formatClock(new Date(alarm.nextAlarm.triggerTime)) } : null) : undefined,
        battery: system.battery ? { level: system.battery.level, charging: system.battery.isCharging } : null,
        storageUsed: system.storage && system.storage.totalBytes > 0 ? 1 - system.storage.freeBytes / system.storage.totalBytes : null,
        shortcuts: canShortcuts ? shortcuts.value.slice(0, SHORTCUT_BUTTONS).map(s => s.shortLabel.toUpperCase()) : null,
    }));

    const states = computed<Record<string, ControlState>>(() =>
        Object.fromEntries(CONTROLS.map(c => [c.id, controlState(c.action, input.value)])));

    /** The plates that follow the phone (the next alarm, the shortcuts' names), by control id. */
    const labels = computed<Record<string, string>>(() =>
    {
        const out: Record<string, string> = {};
        for (const c of CONTROLS)
        {
            const text = liveLabel(c.action, input.value);
            if (text !== undefined) out[c.id] = text;
        }
        return out;
    });

    /** Sets what `action` works to `value` (or presses it). False if the phone refused. */
    function apply(action: string, value: number | 'press'): boolean
    {
        const v = value === 'press' ? 1 : value;
        const shortcut = /^shortcut(\d)$/.exec(action);
        if (shortcut)
        {
            const s = shortcuts.value[Number(shortcut[1])];
            if (!s) return false;
            start(s.id);
            return true;
        }
        switch (action)
        {
            case 'flashlight': return quick.setFlashlight(v > 0.5);
            case 'brightness': return quick.setBrightness(v);
            case 'brightnessAuto': return quick.setBrightnessAuto(v > 0.5);
            case 'ringer': return quick.setRinger(RINGER_STOPS[Math.round(v)] ?? 'normal');
            case 'volume': return quick.setVolume(v);
            case 'nightMode': return quick.setNightMode(v > 0.5);
            // what apps can't switch: the lamp opens the system's own panel
            case 'wifi': return quick.openPanel('wifi');
            case 'bluetooth': return quick.openPanel('bluetooth');
            case 'location': return quick.openPanel('location');
            case 'online': return quick.openPanel('internet');
            case 'mediaPrev': media.action('previous'); return true;
            case 'mediaPlay': media.action('playPause'); return true;
            case 'mediaNext': media.action('next'); return true;
            case 'alarm': alarm.openAlarms(); return true;
            default: return false;
        }
    }

    /** Opens where the user grants what a locked control needs; adb and a missing feature have nothing to open. */
    function grant(lock: ControlLock)
    {
        if (lock === 'settings') quick.grant('settings');
        else if (lock === 'policy') quick.grant('policy');
    }

    // ---- hypersleep: lying in a capsule silences the phone and dims the screen; getting up puts them back
    let saved: { ringer: BridgeRingerMode | null; brightness: { isAuto: boolean; level: number } | null } | null = null;

    /** Goes to sleep; returns what MOTHER says (what could not be done is named). */
    function sleep(): string
    {
        if (saved) return '';
        saved = { ringer: quick.ringer, brightness: quick.brightness };
        const done: string[] = [];
        const missing: string[] = [];
        if (quick.ringer !== null && quick.canPolicy && quick.ringer !== 'silent') { if (quick.setRinger('silent')) done.push('SILENCIO'); }
        else if (!quick.canPolicy) missing.push('SIN SILENCIO');
        if (quick.brightness && quick.canWriteSettings) { if (quick.setBrightness(SLEEP_BRIGHTNESS)) done.push('LUCES BAJAS'); }
        else if (!quick.canWriteSettings) missing.push('SIN LUCES');
        return ['HIPERSUEÑO', ...done, ...missing].join(' · ');
    }

    /** Wakes up: the ringer and the brightness as they were before the capsule. */
    function wake(): string
    {
        const was = saved;
        saved = null;
        if (!was) return '';
        if (was.ringer && quick.canPolicy && quick.ringer !== was.ringer) quick.setRinger(was.ringer);
        if (was.brightness && quick.canWriteSettings)
        {
            if (was.brightness.isAuto) quick.setBrightnessAuto(true);
            else quick.setBrightness(was.brightness.level);
        }
        return 'REANIMACIÓN COMPLETA';
    }

    return { input, states, labels, apply, grant, readout: (action: string) => readout(action, input.value), sleep, wake };
}

