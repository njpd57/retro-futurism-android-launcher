import { BridgeMock } from '@bridgelauncher/api-mock';
import type {
    BridgeBattery, BridgeCalendarEvent, BridgeConnectivity, BridgeMediaAction, BridgeMediaSession, BridgeNextAlarm, BridgeNotification,
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
        makeNotification('n1', 'com.google.android.gm', 'Ana Pérez', 'Reunión movida a las 15:00', 4, { actions: [{ index: 0, title: 'Archivar', acceptsText: false }] }),
        makeNotification('n2', 'com.google.android.apps.messaging', 'Mamá', '¿Vienes a cenar?', 12, { actions: [{ index: 0, title: 'Responder', acceptsText: true }] }),
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
}

export default function injectBridgeMockInDev()
{
    if (import.meta.env.DEV && !window.Bridge)
    {
        window.Bridge = new ForkBridgeMock();
    }
}
