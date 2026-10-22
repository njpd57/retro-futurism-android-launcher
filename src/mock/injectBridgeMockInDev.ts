import { BridgeMock } from '@bridgelauncher/api-mock';
import type {
    BridgeAppShortcut, BridgeAppUsage, BridgeBattery, BridgeCalendarEvent, BridgeContact, BridgeConnectivity, BridgeMediaAction, BridgeMediaSession, BridgeNextAlarm, BridgeNotification,
} from '@/types/bridge-fork';

const jsonUrl = (data: unknown) => `data:application/json,${encodeURIComponent(JSON.stringify(data))}`;
const svgUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const MIN = 60_000;
const HOUR = 60 * MIN;

function makeNotification(key: string, packageName: string, title: string, text: string, minutesAgo: number, extra: Partial<BridgeNotification> = {}): BridgeNotification
{
    return {
        key, packageName, postTime: Date.now() - minutesAgo * MIN, title, text, subText: null, category: null,
        isOngoing: false, isClearable: true, isGroupSummary: false, isMedia: false, hasLargeIcon: false, actions: [], ...extra,
    };
}

/** BridgeMock plus fake data for the fork methods the launcher uses. */
class ForkBridgeMock extends BridgeMock
{
    private battery: BridgeBattery = { level: 74, isCharging: true, pluggedType: 'usb' };
    private connectivity: BridgeConnectivity = { type: 'wifi', wifiLevel: 3, cellularLevel: 2, dataActivity: 'none' };

    private canReadNotifications = true;
    private notifications = new Map<string, BridgeNotification>([
        makeNotification('n1', 'com.google.android.gm', 'Ana Pérez', 'Reunión movida a las 15:00. Por favor confirma si puedes asistir y trae el informe trimestral actualizado con las cifras de la última revisión, porque lo vamos a presentar al comité.', 4, { subText: 'nico@gmail.com', category: 'email', actions: [{ index: 0, title: 'Archivar', acceptsText: false }] }),
        makeNotification('n1b', 'com.google.android.gm', 'Banco Nova', 'Se ha realizado un cargo en tu tarjeta', 30, { subText: 'nico@gmail.com', category: 'email' }),
        makeNotification('n1c', 'com.google.android.gm', 'Soporte', 'Tu ticket #4821 fue resuelto', 55, { subText: 'trabajo@empresa.com', category: 'email' }),
        makeNotification('n1d', 'com.google.android.gm', 'Newsletter', 'Las noticias de la semana', 300, { subText: 'nico@gmail.com', category: 'promo' }),
        makeNotification('n1s', 'com.google.android.gm', '4 mensajes nuevos', 'Ana Pérez, Banco Nova, Soporte', 4, { isGroupSummary: true }),
        makeNotification('n2', 'com.google.android.apps.messaging', 'Mamá', '¿Vienes a cenar?', 12, { subText: 'Familia', category: 'msg', actions: [{ index: 0, title: 'Responder', acceptsText: true }] }),
        makeNotification('n3', 'com.android.chrome', 'Descarga completa', 'informe.pdf', 40),
        makeNotification('n4', 'com.google.android.deskclock', 'Temporizador', 'En curso', 90, { isOngoing: true, isClearable: false }),
    ].map(n => [n.key, n]));
    private nextNotificationId = 5;

    private media: BridgeMediaSession | null = {
        packageName: 'com.google.android.apps.youtube.music', title: 'Sector 7', artist: 'Orbital Drift', album: 'Cold Boot',
        state: 'playing', durationMs: 214_000, positionMs: 32_000, positionUpdatedAt: Date.now(), playbackSpeed: 1,
        hasArt: true, artVersion: 1, canSkipToNext: true, canSkipToPrevious: true,
    };

    private canReadCalendar = true;
    private nextAlarm: BridgeNextAlarm | null = { triggerTime: Date.now() + 7 * HOUR, packageName: 'com.google.android.deskclock' };

    constructor()
    {
        super();
        window.setInterval(() => this.tickBattery(), 4000);
        window.setInterval(() => this.tickConnectivity(), 3000);
        window.setInterval(() => this.postNotification(), 45_000);
    }

    // like Bridge, tell the page about a change through onBridgeEvent
    private emit(event: object) { (window.onBridgeEvent as ((e: object) => void) | undefined)?.(event); }

    private tickBattery()
    {
        const b = this.battery;
        const level = Math.min(100, Math.max(5, b.level + (b.isCharging ? 1 : -1)));
        const isCharging = level >= 100 ? false : level <= 5 ? true : b.isCharging;
        this.battery = { level, isCharging, pluggedType: isCharging ? 'usb' : null };
        this.emit({ name: 'batteryChanged', newValue: this.battery });
    }

    private tickConnectivity()
    {
        const activity = (['none', 'in', 'out', 'inout'] as const)[Math.floor(Math.random() * 4)];
        const wifiLevel = Math.min(4, Math.max(1, (this.connectivity.wifiLevel ?? 3) + Math.round(Math.random() * 2 - 1)));
        this.connectivity = { ...this.connectivity, wifiLevel, dataActivity: activity };
        this.emit({ name: 'connectivityChanged', newValue: this.connectivity });
    }

    private postNotification()
    {
        const n = makeNotification(`n${this.nextNotificationId++}`, 'com.google.android.gm', 'Nuevo correo', 'Resumen semanal disponible', 0);
        this.notifications.set(n.key, n);
        this.emit({ name: 'notificationPosted', notification: n });
    }

    getWindowInsetsSwapFixed() { return true; }
    /** A camera hole in the middle of the top edge, to see the gap in the status bar. */
    getDisplayCutoutPath() { const c = window.innerWidth / 2; return `M ${c - 45} 0 L ${c + 45} 0 L ${c + 45} 28 L ${c - 45} 28 Z`; }
    getBattery() { return JSON.stringify(this.battery); }
    getConnectivity() { return JSON.stringify(this.connectivity); }

    // notifications
    getCanReadNotifications() { return this.canReadNotifications; }
    requestOpenNotificationAccessSettings() { alert('[mock] abrir acceso a notificaciones'); return true; }
    getNotificationsURL() { return jsonUrl({ notifications: [...this.notifications.values()].sort((a, b) => b.postTime - a.postTime) }); }
    getNotificationIconURL()
    {
        // a white silhouette on transparent, like Android's small icons
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#fff"/></svg>');
    }
    requestOpenNotification(key: string) { alert(`[mock] abrir notificación ${key}`); return true; }
    requestDismissNotification(key: string)
    {
        if (!this.notifications.delete(key)) return false;
        this.emit({ name: 'notificationRemoved', key });
        return true;
    }
    requestNotificationAction(key: string, actionIndex: number) { alert(`[mock] acción ${actionIndex} de ${key}`); return true; }
    requestReplyToNotification(key: string, actionIndex: number, text: string) { alert(`[mock] respuesta a ${key}: ${text}`); return true; }

    // media
    getMediaSession()
    {
        if (!this.media) return 'null';
        const m = this.media;
        const position = m.state === 'playing' ? Math.min(m.durationMs, m.positionMs + (Date.now() - m.positionUpdatedAt) * m.playbackSpeed) : m.positionMs;
        return JSON.stringify({ ...m, positionMs: position, positionUpdatedAt: Date.now() });
    }
    getMediaArtURL()
    {
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#888"/><circle cx="32" cy="32" r="20" fill="#ddd"/><circle cx="32" cy="32" r="6" fill="#444"/></svg>');
    }
    requestMediaAction(action: BridgeMediaAction)
    {
        if (!this.media) return false;
        const now = Date.now();
        const m = this.media;
        const position = m.state === 'playing' ? m.positionMs + (now - m.positionUpdatedAt) * m.playbackSpeed : m.positionMs;

        if (action === 'next' || action === 'previous')
            this.media = { ...m, positionMs: 0, positionUpdatedAt: now, title: action === 'next' ? 'Dead Channel' : 'Sector 7', artVersion: m.artVersion + 1 };
        else
        {
            const play = action === 'play' || (action === 'playPause' && m.state !== 'playing');
            this.media = { ...m, state: play ? 'playing' : 'paused', positionMs: position, positionUpdatedAt: now };
        }
        this.emit({ name: 'mediaSessionChanged', session: this.media });
        return true;
    }
    requestOpenMediaApp() { alert('[mock] abrir app de música'); return true; }

    // calendar
    getCanReadCalendar() { return this.canReadCalendar; }
    requestCalendarPermission()
    {
        this.canReadCalendar = true;
        this.emit({ name: 'canReadCalendarChanged', newValue: true });
        return true;
    }
    getCalendarEventsURL(from: number, to: number)
    {
        const day = new Date(); day.setHours(0, 0, 0, 0);
        const at = (dayOffset: number, hour: number, minutes = 0) => day.getTime() + dayOffset * 24 * HOUR + hour * HOUR + minutes * MIN;
        const utcMidnight = (dayOffset: number) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset);
        const events: BridgeCalendarEvent[] = [
            { eventId: 1, title: 'Daily', location: null, begin: at(0, 10), end: at(0, 10, 30), allDay: false, color: '#33aa55', calendarName: 'Trabajo' },
            { eventId: 2, title: 'Dentista', location: 'Centro', begin: at(0, 17), end: at(0, 18), allDay: false, color: '#aa3355', calendarName: 'Personal' },
            { eventId: 3, title: 'Cumpleaños de Sol', location: null, begin: utcMidnight(1), end: utcMidnight(2), allDay: true, color: '#3355aa', calendarName: 'Personal' },
            { eventId: 4, title: 'Revisión de sprint', location: 'Sala 2', begin: at(2, 15), end: at(2, 16), allDay: false, color: '#33aa55', calendarName: 'Trabajo' },
        ];
        return jsonUrl({ events: events.filter(e => e.end > from && e.begin < to) });
    }
    requestOpenCalendarEvent(eventId: number) { alert(`[mock] abrir evento ${eventId}`); return true; }
    requestOpenCalendarAt(time: number) { alert(`[mock] abrir calendario en ${new Date(time).toISOString()}`); return true; }

    // alarm
    getNextAlarm() { return JSON.stringify(this.nextAlarm); }
    requestOpenAlarms() { alert('[mock] abrir alarmas'); return true; }

    requestOpenUrl(url: string) { window.open(url, '_blank'); return true; }

    // contacts
    private canReadContacts = true;
    getCanReadContacts() { return this.canReadContacts; }
    requestContactsPermission()
    {
        this.canReadContacts = true;
        this.emit({ name: 'canReadContactsChanged', newValue: true });
        return true;
    }
    getContactsURL(query = '', starredOnly = false, limit = 0)
    {
        const make = (id: number, name: string, number: string, starred: boolean): BridgeContact => ({
            id, lookupKey: `lk${id}`, name, starred, hasPhoto: false,
            phoneNumbers: [{ number, label: 'móvil', isPrimary: true }],
        });
        const all = [
            make(1, 'Ana Pérez', '+34600111222', true),
            make(2, 'Mamá', '+34600333444', true),
            make(3, 'Carlos Ruiz', '+34600555666', false),
            make(4, 'Sol', '+34600777888', true),
        ];
        const q = query.toLowerCase();
        let contacts = all.filter(c => (!starredOnly || c.starred) && (!q || c.name.toLowerCase().includes(q) || c.phoneNumbers[0].number.includes(q)));
        if (limit > 0) contacts = contacts.slice(0, limit);
        return jsonUrl({ contacts });
    }
    getContactPhotoURL() { return ''; }
    requestOpenContact(lookupKey: string) { alert(`[mock] abrir contacto ${lookupKey}`); return true; }

    // app usage
    private canReadUsage = true;
    getCanReadUsageStats() { return this.canReadUsage; }
    requestOpenUsageAccessSettings()
    {
        this.canReadUsage = true;
        this.emit({ name: 'canReadUsageStatsChanged', newValue: true });
        return true;
    }
    getAppUsageURL(from: number)
    {
        // every day gets its own scale, so the weekly report has something to compare
        const k = 0.4 + ((Math.floor(from / 86_400_000) * 7) % 10) / 8;
        const apps: BridgeAppUsage[] = [
            { packageName: 'com.android.chrome', totalTimeMs: 95 * MIN, openCount: 14, lastTimeUsed: Date.now() - 10 * MIN },
            { packageName: 'com.google.android.youtube', totalTimeMs: 52 * MIN, openCount: 5, lastTimeUsed: Date.now() - 40 * MIN },
            { packageName: 'com.google.android.gm', totalTimeMs: 21 * MIN, openCount: 9, lastTimeUsed: Date.now() - 5 * MIN },
            { packageName: 'com.google.android.apps.messaging', totalTimeMs: 12 * MIN, openCount: 20, lastTimeUsed: Date.now() - 2 * MIN },
        ];
        return jsonUrl({ apps: apps.map(a => ({ ...a, totalTimeMs: Math.round(a.totalTimeMs * k) })) });
    }

    // app shortcuts
    getCanAccessAppShortcuts() { return true; }
    getAppShortcutsURL(packageName: string)
    {
        const shortcuts: BridgeAppShortcut[] = [
            { id: 'new', shortLabel: 'Nuevo', longLabel: `Nuevo en ${packageName}` },
            { id: 'search', shortLabel: 'Buscar', longLabel: null },
        ];
        return jsonUrl({ shortcuts });
    }
    getAppShortcutIconURL() { return ''; }
    requestStartAppShortcut(packageName: string, shortcutId: string) { alert(`[mock] atajo ${shortcutId} de ${packageName}`); return true; }

    // storage
    getProxyURL(url: string) { return url; }

    // speech
    getTtsAvailable() { return false; }
    requestSpeak(text: string) { console.info('[mock] speak', text); return false; }
    requestStopSpeaking() { /* nothing to stop */ }
    requestVibrate(ms: number) { console.info('[mock] vibrate', ms); return true; }
    requestOpenTtsSettings() { alert('[mock] ajustes de voz'); return true; }
    getStorageStats() { return JSON.stringify({ totalBytes: 128 * 1024 ** 3, freeBytes: 47 * 1024 ** 3 }); }
}

export default function injectBridgeMockInDev()
{
    if (import.meta.env.DEV && !window.Bridge)
    {
        window.Bridge = new ForkBridgeMock();
    }
}
