import '@bridgelauncher/api';

// Methods and events that only exist in our Bridge fork (njpd57/bridge-launcher).
// Names must match the Kotlin ones exactly. Call them behind bridgeHas().

export type BridgePluggedType = 'ac' | 'usb' | 'wireless' | 'other';

export interface BridgeBattery
{
    /** 0-100 */
    level: number;
    isCharging: boolean;
    pluggedType: BridgePluggedType | null;
}

export type BridgeConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'other' | 'none';
export type BridgeDataActivity = 'none' | 'in' | 'out' | 'inout' | 'dormant';

export interface BridgeConnectivity
{
    type: BridgeConnectionType;
    /** 0-4 */
    wifiLevel: number | null;
    /** 0-4 */
    cellularLevel: number | null;
    dataActivity: BridgeDataActivity;
}

export interface BridgeNotificationAction
{
    index: number;
    title: string;
    acceptsText: boolean;
}

export interface BridgeNotification
{
    key: string;
    packageName: string;
    /** ms */
    postTime: number;
    title: string | null;
    text: string | null;
    subText: string | null;
    category: string | null;
    isOngoing: boolean;
    isClearable: boolean;
    isGroupSummary: boolean;
    isMedia: boolean;
    hasLargeIcon: boolean;
    actions: BridgeNotificationAction[];
}

export type BridgeMediaState = 'playing' | 'paused' | 'buffering' | 'stopped' | 'none';
export type BridgeMediaAction = 'play' | 'pause' | 'playPause' | 'next' | 'previous';

export interface BridgeMediaSession
{
    packageName: string;
    title: string | null;
    artist: string | null;
    album: string | null;
    state: BridgeMediaState;
    durationMs: number;
    /** A snapshot: extrapolate with positionUpdatedAt and playbackSpeed while playing. */
    positionMs: number;
    positionUpdatedAt: number;
    playbackSpeed: number;
    hasArt: boolean;
    artVersion: number;
    canSkipToNext: boolean;
    canSkipToPrevious: boolean;
}

export interface BridgeCalendarEvent
{
    eventId: number;
    title: string | null;
    location: string | null;
    /** ms; all-day events use midnight UTC */
    begin: number;
    end: number;
    allDay: boolean;
    /** #rrggbb */
    color: string;
    calendarName: string;
}

export interface BridgeNextAlarm
{
    /** ms */
    triggerTime: number;
    packageName: string;
}

export interface BridgeContactNumber
{
    number: string;
    label: string | null;
    isPrimary: boolean;
}

export interface BridgeContact
{
    id: number;
    lookupKey: string;
    name: string;
    starred: boolean;
    hasPhoto: boolean;
    /** Default number first. */
    phoneNumbers: BridgeContactNumber[];
}

export interface BridgeAppUsage
{
    packageName: string;
    totalTimeMs: number;
    openCount: number;
    lastTimeUsed: number;
}

export interface BridgeAppShortcut
{
    id: string;
    shortLabel: string;
    longLabel: string | null;
}

export interface BridgeStorageStats
{
    totalBytes: number;
    freeBytes: number;
}

export type BridgeForkEvent =
    | { name: 'batteryChanged'; newValue: BridgeBattery }
    | { name: 'connectivityChanged'; newValue: BridgeConnectivity }
    | { name: 'canReadNotificationsChanged'; newValue: boolean }
    | { name: 'notificationPosted'; notification: BridgeNotification }
    | { name: 'notificationRemoved'; key: string }
    | { name: 'mediaSessionChanged'; session: BridgeMediaSession | null }
    | { name: 'canReadCalendarChanged'; newValue: boolean }
    | { name: 'calendarChanged' }
    | { name: 'nextAlarmChanged'; newValue: BridgeNextAlarm | null }
    | { name: 'canReadContactsChanged'; newValue: boolean }
    | { name: 'contactsChanged' }
    | { name: 'canReadUsageStatsChanged'; newValue: boolean };

declare module '@bridgelauncher/api'
{
    interface JSToBridgeAPI
    {
        /** Always true on the fork; absent on stock Bridge. */
        getWindowInsetsSwapFixed(): boolean;
        /** JSON of BridgeBattery. */
        getBattery(): string;
        /** JSON of BridgeConnectivity. */
        getConnectivity(): string;

        getCanReadNotifications(): boolean;
        requestOpenNotificationAccessSettings(showToastIfFailed?: boolean): boolean;
        /** URL of JSON `{ notifications: BridgeNotification[] }`, newest first. */
        getNotificationsURL(): string;
        getNotificationIconURL(key: string, large?: boolean): string;
        requestOpenNotification(key: string, showToastIfFailed?: boolean): boolean;
        requestDismissNotification(key: string, showToastIfFailed?: boolean): boolean;
        requestNotificationAction(key: string, actionIndex: number, showToastIfFailed?: boolean): boolean;
        requestReplyToNotification(key: string, actionIndex: number, text: string, showToastIfFailed?: boolean): boolean;

        /** JSON of BridgeMediaSession, or "null". */
        getMediaSession(): string;
        getMediaArtURL(): string;
        requestMediaAction(action: BridgeMediaAction, showToastIfFailed?: boolean): boolean;
        requestOpenMediaApp(showToastIfFailed?: boolean): boolean;

        getCanReadCalendar(): boolean;
        requestCalendarPermission(showToastIfFailed?: boolean): boolean;
        /** URL of JSON `{ events: BridgeCalendarEvent[] }` overlapping [from, to) in ms. */
        getCalendarEventsURL(from: number, to: number): string;
        requestOpenCalendarEvent(eventId: number, begin: number, end: number, showToastIfFailed?: boolean): boolean;
        requestOpenCalendarAt(time: number, showToastIfFailed?: boolean): boolean;

        /** JSON of BridgeNextAlarm, or "null". */
        getNextAlarm(): string;
        requestOpenAlarms(showToastIfFailed?: boolean): boolean;

        requestOpenUrl(url: string, showToastIfFailed?: boolean): boolean;

        getCanReadContacts(): boolean;
        requestContactsPermission(showToastIfFailed?: boolean): boolean;
        /** URL of JSON `{ contacts: BridgeContact[] }`; only contacts with a phone number. `limit` 0 = none. */
        getContactsURL(query?: string, starredOnly?: boolean, limit?: number): string;
        getContactPhotoURL(lookupKey: string): string;
        requestOpenContact(lookupKey: string, showToastIfFailed?: boolean): boolean;

        getCanReadUsageStats(): boolean;
        requestOpenUsageAccessSettings(showToastIfFailed?: boolean): boolean;
        /** URL of JSON `{ apps: BridgeAppUsage[] }` for [from, to) in ms, most used first. */
        getAppUsageURL(from: number, to: number): string;

        /** True only when Bridge is the default launcher. */
        getCanAccessAppShortcuts(): boolean;
        /** URL of JSON `{ shortcuts: BridgeAppShortcut[] }`. */
        getAppShortcutsURL(packageName: string): string;
        getAppShortcutIconURL(packageName: string, shortcutId: string): string;
        requestStartAppShortcut(packageName: string, shortcutId: string, showToastIfFailed?: boolean): boolean;

        /** JSON of BridgeStorageStats (internal storage). */
        getStorageStats(): string;

        /** A URL that makes Bridge download an http(s) URL natively (GET), for sites the WebView can't read because of CORS. */
        getProxyURL(url: string): string;

        /** True once an Android text-to-speech engine is bound (the first call starts it). */
        getTtsAvailable(): boolean;
        /** Speaks the text with Android's engine, replacing what is being said. False if there is no engine or no voice for the language. */
        requestSpeak(text: string, languageTag: string, pitch: number, rate: number): boolean;
        requestStopSpeaking(): void;
        /** Opens Android's text-to-speech settings. */
        requestOpenTtsSettings(showToastIfFailed?: boolean): boolean;
    }
}
