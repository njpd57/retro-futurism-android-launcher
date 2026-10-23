/**
 * What each control of the ship works on the phone, as pure data: the state a control shows from a flat snapshot of
 * the phone (`ControlInput`, gathered by `composables/useShipControls.ts`), what MOTHER says when it is moved, what a
 * dial reads out and the names that change on their plates (the next alarm, an app's shortcuts).
 */
import type { ControlLock, ControlState } from './controls';

/** How many of the favourite app's shortcuts the hangar's console offers. */
export const SHORTCUT_BUTTONS = 4;

export interface ControlInput
{
    /** the fork answers for quick settings */
    linked: boolean;
    hasFlashlight: boolean;
    flashlight: boolean;
    brightness: { isAuto: boolean; level: number } | null;
    ringer: 'normal' | 'vibrate' | 'silent' | null;
    volume: number | null;
    night: boolean | null;
    canWriteSettings: boolean;
    canPolicy: boolean;
    canNight: boolean;
    wifi: boolean | null;
    bluetooth: boolean | null;
    location: boolean | null;
    /** null without the fork's connectivity */
    online: boolean | null;
    /** null without media access */
    media: { playing: boolean } | null;
    /** what the next alarm says on its plate, null without the fork */
    alarm: { at: string } | null | undefined;
    /** 0..100 */
    battery: { level: number; charging: boolean } | null;
    /** share of the storage in use, 0..1 */
    storageUsed: number | null;
    /** the favourite app's launcher shortcuts, by button; null when they can't be read (Bridge isn't the home app) */
    shortcuts: readonly string[] | null;
}

export const RINGER_STOPS = ['normal', 'vibrate', 'silent'] as const;

const off = (lock: ControlLock | null = 'missing'): ControlState => ({ value: null, lock });
const bool = (v: boolean) => (v ? 1 : 0);
const known = (v: boolean | null): ControlState => (v === null ? off() : { value: bool(v), lock: null });

/** The state a control working `action` shows; an action nobody knows is dark. */
export function controlState(action: string, i: ControlInput): ControlState
{
    const shortcut = /^shortcut(\d)$/.exec(action);
    if (shortcut)
    {
        const k = Number(shortcut[1]);
        return i.shortcuts && k < i.shortcuts.length ? { value: 0, lock: null } : off();
    }
    switch (action)
    {
        // what the phone has without the fork's quick settings
        case 'mediaPrev':
        case 'mediaNext':
            return i.media ? { value: 0, lock: null } : off();
        case 'mediaPlay':
            return i.media ? { value: bool(i.media.playing), lock: null } : off();
        case 'alarm':
            return i.alarm === undefined ? off() : { value: bool(i.alarm !== null), lock: null };
        case 'battery':
            return i.battery ? { value: i.battery.level / 100, lock: null } : off();
        case 'charging':
            return i.battery ? { value: bool(i.battery.charging), lock: null } : off();
        case 'storage':
            return i.storageUsed === null ? off() : { value: i.storageUsed, lock: null };
        case 'online':
            return known(i.online);
    }
    if (!i.linked) return off();
    switch (action)
    {
        case 'flashlight':
            return i.hasFlashlight ? { value: bool(i.flashlight), lock: null } : off();
        case 'brightness':
            return i.brightness ? { value: i.brightness.level, lock: i.canWriteSettings ? null : 'settings' } : off();
        case 'brightnessAuto':
            return i.brightness ? { value: bool(i.brightness.isAuto), lock: i.canWriteSettings ? null : 'settings' } : off();
        case 'ringer':
            return i.ringer ? { value: RINGER_STOPS.indexOf(i.ringer), lock: i.canPolicy ? null : 'policy' } : off();
        case 'volume':
            return i.volume === null ? off() : { value: i.volume, lock: null };
        case 'nightMode':
            return i.night === null ? off() : { value: bool(i.night), lock: i.canNight ? null : 'adb' };
        case 'wifi': return known(i.wifi);
        case 'bluetooth': return known(i.bluetooth);
        case 'location': return known(i.location);
        default:
            return off();
    }
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** MOTHER's confirmation of a control set to `value`, in her words; empty for nothing to say. */
export function voiceLine(action: string, value: number): string
{
    switch (action)
    {
        case 'flashlight': return value > 0.5 ? 'FOCO EXTERIOR ACTIVO' : 'FOCO EXTERIOR APAGADO';
        case 'brightness': return `LUCES DE CABINA AL ${pct(value)}`;
        case 'brightnessAuto': return value > 0.5 ? 'LUCES DE CABINA EN AUTOMÁTICO' : 'LUCES DE CABINA EN MANUAL';
        case 'ringer': return ['ALERTA SONORA', 'ALERTA POR VIBRACIÓN', 'SILENCIO A BORDO'][Math.round(value)] ?? '';
        case 'volume': return `VOLUMEN AL ${pct(value)}`;
        case 'nightMode': return value > 0.5 ? 'MODO NOCTURNO ACTIVO' : 'MODO NOCTURNO DESACTIVADO';
        default: return '';
    }
}

/** What a dial or a lamp says when it is touched, for the strip at the bottom. */
export function readout(action: string, i: ControlInput): string
{
    switch (action)
    {
        case 'battery': return i.battery ? `RESERVA ${i.battery.level} %` : 'RESERVA SIN DATOS';
        case 'charging': return i.battery ? (i.battery.charging ? 'CARGANDO' : 'SIN CARGA EXTERNA') : 'CARGA SIN DATOS';
        case 'storage': return i.storageUsed === null ? 'ALMACÉN SIN DATOS' : `ALMACÉN OCUPADO ${pct(i.storageUsed)}`;
        default: return '';
    }
}

/** The plates whose text follows the phone, by action: the next alarm and the favourite app's shortcuts. */
export function liveLabel(action: string, i: ControlInput): string | undefined
{
    if (action === 'alarm') return i.alarm ? `ALARMA ${i.alarm.at}` : i.alarm === null ? 'SIN ALARMA' : undefined;
    const shortcut = /^shortcut(\d)$/.exec(action);
    if (shortcut) return i.shortcuts?.[Number(shortcut[1])] ?? '---';
    return undefined;
}

/** What the strip says when a locked control is touched. */
export const LOCK_TEXT: Record<ControlLock, string> = {
    settings: 'ACCESO DENEGADO · AJUSTES DEL SISTEMA',
    policy: 'ACCESO DENEGADO · NO MOLESTAR',
    adb: 'ACCESO DENEGADO · REQUIERE ADB',
    missing: 'SIN ENLACE CON EL SISTEMA',
};
