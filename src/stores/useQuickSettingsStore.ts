import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { BridgeRingerMode, BridgeScreenBrightness, BridgeSystemPanel } from '@/types/bridge-fork';
import { bridgeHas } from '@/utils/bridgeHas';
import { readJson } from '@/utils/safeJson';
import { useBridgeEventStore } from './useBridgeEventStore';

export type QuickPermission = 'settings' | 'policy';

/** The phone's quick settings the ship's controls work: what can be set, what can only be read, and the two special permissions. */
export const useQuickSettingsStore = defineStore('quickSettings', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getFlashlightOn') && bridgeHas('requestSetFlashlightOn');
    const hasFlashlight = ref(false);
    const flashlight = ref(false);
    const brightness = ref<BridgeScreenBrightness | null>(null);
    const ringer = ref<BridgeRingerMode | null>(null);
    const volume = ref<number | null>(null);
    const wifi = ref<boolean | null>(null);
    const bluetooth = ref<boolean | null>(null);
    const location = ref<boolean | null>(null);
    /** "Modify system settings": brightness */
    const canWriteSettings = ref(false);
    /** "Do Not Disturb access": the ringer mode */
    const canPolicy = ref(false);
    /** the system's dark theme, which Bridge can change only with a permission granted over adb */
    const nightMode = ref<string | null>(null);
    const canNight = ref(false);

    /** A getter the installed Bridge may lack, or that throws: its fallback instead. */
    function get<T>(method: keyof typeof Bridge, read: () => T, fallback: T): T
    {
        if (!bridgeHas(method)) return fallback;
        try { return read(); }
        catch { return fallback; }
    }

    function read()
    {
        if (!supported) return;
        hasFlashlight.value = get('getIsFlashlightAvailable', () => Bridge.getIsFlashlightAvailable(), false);
        flashlight.value = get('getFlashlightOn', () => Bridge.getFlashlightOn(), false);
        brightness.value = bridgeHas('getScreenBrightness') ? readJson<BridgeScreenBrightness>(() => Bridge.getScreenBrightness()) : null;
        ringer.value = get('getRingerMode', () => Bridge.getRingerMode(), null);
        volume.value = get('getMusicVolume', () => Bridge.getMusicVolume(), null);
        wifi.value = get('getWifiEnabled', () => Bridge.getWifiEnabled(), null);
        bluetooth.value = get('getIsBluetoothAvailable', () => Bridge.getIsBluetoothAvailable(), false)
            ? get('getBluetoothEnabled', () => Bridge.getBluetoothEnabled(), null)
            : null;
        location.value = get('getLocationEnabled', () => Bridge.getLocationEnabled(), null);
        nightMode.value = get('getSystemNightMode', () => Bridge.getSystemNightMode(), null);
        readPermissions();
    }

    function readPermissions()
    {
        canWriteSettings.value = get('getCanWriteSystemSettings', () => Bridge.getCanWriteSystemSettings(), false);
        canPolicy.value = get('getCanAccessNotificationPolicy', () => Bridge.getCanAccessNotificationPolicy(), false);
        canNight.value = get('getCanRequestSystemNightMode', () => Bridge.getCanRequestSystemNightMode(), false);
    }

    read();

    bridgeEvents.addEventListener(ev =>
    {
        switch (ev.name)
        {
            case 'flashlightChanged': flashlight.value = ev.newValue; break;
            case 'screenBrightnessChanged': brightness.value = ev.newValue; break;
            case 'ringerModeChanged': ringer.value = ev.newValue; break;
            case 'musicVolumeChanged': volume.value = ev.newValue; break;
            case 'wifiEnabledChanged': wifi.value = ev.newValue; break;
            case 'bluetoothEnabledChanged': bluetooth.value = ev.newValue; break;
            case 'locationEnabledChanged': location.value = ev.newValue; break;
            case 'canWriteSystemSettingsChanged': canWriteSettings.value = ev.newValue; break;
            case 'canAccessNotificationPolicyChanged': canPolicy.value = ev.newValue; break;
            case 'systemNightModeChanged': nightMode.value = ev.newValue; break;
            case 'canRequestSystemNightModeChanged': canNight.value = ev.newValue; break;
            // the permissions are granted in Android's settings, outside the launcher
            case 'afterResume': if (supported) readPermissions(); break;
        }
    });

    /** Calls a setter without letting a missing method or a refusal break the caller. The value changes when Bridge sends the event back. */
    function call(method: keyof typeof Bridge, run: () => boolean): boolean
    {
        if (!bridgeHas(method)) return false;
        try { return run(); }
        catch { return false; }
    }

    const setFlashlight = (on: boolean) => call('requestSetFlashlightOn', () => Bridge.requestSetFlashlightOn(on, false));
    const setBrightnessAuto = (auto: boolean) => call('requestSetScreenBrightnessAuto', () => Bridge.requestSetScreenBrightnessAuto(auto, false));
    const setBrightness = (level: number) => call('requestSetScreenBrightnessLevel', () => Bridge.requestSetScreenBrightnessLevel(Math.max(0, Math.min(1, level)), false));
    const setRinger = (mode: BridgeRingerMode) => call('requestSetRingerMode', () => Bridge.requestSetRingerMode(mode, false));
    const setVolume = (level: number) => call('requestSetMusicVolume', () => Bridge.requestSetMusicVolume(Math.max(0, Math.min(1, level)), false));
    const setNightMode = (on: boolean) => call('requestSetSystemNightMode', () => Bridge.requestSetSystemNightMode(on ? 'yes' : 'no', false));
    const openPanel = (panel: BridgeSystemPanel) => call('requestOpenSystemPanel', () => Bridge.requestOpenSystemPanel(panel));

    function grant(which: QuickPermission)
    {
        if (which === 'settings') call('requestOpenWriteSystemSettingsPermission', () => Bridge.requestOpenWriteSystemSettingsPermission());
        else call('requestOpenNotificationPolicyAccessSettings', () => Bridge.requestOpenNotificationPolicyAccessSettings());
    }

    return {
        supported, hasFlashlight, flashlight, brightness, ringer, volume, wifi, bluetooth, location, canWriteSettings, canPolicy, nightMode, canNight,
        setFlashlight, setNightMode, setBrightnessAuto, setBrightness, setRinger, setVolume, openPanel, grant,
    };
});
