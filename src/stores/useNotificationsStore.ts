import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { BridgeNotification } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { alertCount, appLabelFor, splitNotifications, uniquePackages, visibleNotifications } from "@/utils/notifications";
import { useAppsStore } from "./useAppsStore";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useLogStore } from "./useLogStore";

/** Notifications from the fork, kept by key. Without the fork (or without access) the list stays empty. */
export const useNotificationsStore = defineStore('notifications', () =>
{
    const bridgeEvents = useBridgeEventStore();
    const log = useLogStore();
    const appsStore = useAppsStore();

    const supported = bridgeHas('getNotificationsURL') && bridgeHas('getCanReadNotifications');
    const canRead = ref(false);
    const items = ref(new Map<string, BridgeNotification>());
    const error = ref(false);

    async function sync()
    {
        if (!supported) return;

        canRead.value = Bridge.getCanReadNotifications();
        if (!canRead.value)
        {
            items.value = new Map();
            return;
        }

        try
        {
            const resp = await fetch(Bridge.getNotificationsURL());
            const { notifications } = await resp.json() as { notifications: BridgeNotification[] };
            items.value = new Map(notifications.map(n => [n.key, n]));
            error.value = false;
        }
        catch (err)
        {
            console.error(err);
            error.value = true;
        }
    }

    sync();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'canReadNotificationsChanged')
            sync();
        else if (ev.name === 'afterResume')
            sync();
        else if (ev.name === 'notificationPosted')
        {
            items.value.set(ev.notification.key, ev.notification);
            if (!ev.notification.isMedia)
                log.push('NTF', `${appLabelFor(ev.notification.packageName, appsStore.apps).toUpperCase()}: ${ev.notification.title ?? ''}`.trim());
        }
        else if (ev.name === 'notificationRemoved')
            items.value.delete(ev.key);
    });

    const visible = computed(() => visibleNotifications(items.value.values()));
    const grouped = computed(() => splitNotifications(visible.value));
    const packages = computed(() => uniquePackages(visible.value));
    const alerts = computed(() => alertCount(visible.value));
    /** Newest notification key per app, for the status bar icons. */
    const iconKeys = computed(() => new Map(visible.value.map(n => [n.packageName, n.key] as const).reverse()));

    function open(key: string) { Bridge.requestOpenNotification(key); }
    function dismiss(key: string) { Bridge.requestDismissNotification(key); }
    function runAction(key: string, index: number) { Bridge.requestNotificationAction(key, index); }
    function reply(key: string, index: number, text: string) { Bridge.requestReplyToNotification(key, index, text); }
    function requestAccess() { Bridge.requestOpenNotificationAccessSettings(); }

    return { supported, canRead, error, visible, grouped, packages, alerts, iconKeys, sync, open, dismiss, runAction, reply, requestAccess };
});
