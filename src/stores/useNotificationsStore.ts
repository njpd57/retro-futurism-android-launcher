import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { BridgeNotification } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { splitNotifications, uniquePackages, visibleNotifications } from "@/utils/notifications";
import { useBridgeEventStore } from "./useBridgeEventStore";
import { useLogStore } from "./useLogStore";

/** Notifications from the fork, kept by key. Without the fork (or without access) the list stays empty. */
export const useNotificationsStore = defineStore('notifications', () =>
{
    const bridgeEvents = useBridgeEventStore();
    const log = useLogStore();

    const supported = bridgeHas('getNotificationsURL') && bridgeHas('getCanReadNotifications');
    const canRead = ref(false);
    const items = ref(new Map<string, BridgeNotification>());

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
        }
        catch (err)
        {
            console.error(err);
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
                log.push('NTF', `${ev.notification.packageName.split('.').pop()?.toUpperCase()}: ${ev.notification.title ?? ''}`.trim());
        }
        else if (ev.name === 'notificationRemoved')
            items.value.delete(ev.key);
    });

    const visible = computed(() => visibleNotifications(items.value.values()));
    const grouped = computed(() => splitNotifications(visible.value));
    const packages = computed(() => uniquePackages(visible.value));

    function open(key: string) { Bridge.requestOpenNotification(key); }
    function dismiss(key: string) { Bridge.requestDismissNotification(key); }
    function runAction(key: string, index: number) { Bridge.requestNotificationAction(key, index); }
    function reply(key: string, index: number, text: string) { Bridge.requestReplyToNotification(key, index, text); }
    function requestAccess() { Bridge.requestOpenNotificationAccessSettings(); }

    return { supported, canRead, visible, grouped, packages, sync, open, dismiss, runAction, reply, requestAccess };
});
