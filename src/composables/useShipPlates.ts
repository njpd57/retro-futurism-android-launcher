import { computed } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useContactsStore } from '@/stores/useContactsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useShipControls } from '@/composables/useShipControls';
import { CONTACT_SEATS, SIGNAL_SLOTS } from '@/ship3d/crew';
import { shuttleVertices } from '@/ship3d/figures';
import { plateTexts, withControls, withSigns, withStencils } from '@/ship3d/labels';
import { collisionSegments, hangarBays, PROPS, ROOMS } from '@/ship3d/world';
import { appLabelFor } from '@/utils/notifications';
import { radarContacts } from '@/utils/radar';

/** What the crew and the shuttles stand for aboard: the apps with signals, the starred contacts, the favourite apps, and the name plates that say so. */
export function useShipPlates()
{
    const settings = useSettingsStore();
    const appsStore = useAppsStore();
    const notifications = useNotificationsStore();
    const contacts = useContactsStore();
    const shipControls = useShipControls();

    const labelOf = (pkg: string) => appLabelFor(pkg, appsStore.apps);
    const signalApps = computed(() => radarContacts(notifications.visible, SIGNAL_SLOTS.length));
    const starred = computed(() => contacts.starred.slice(0, CONTACT_SEATS));
    const bays = computed(() => hangarBays(settings.favorites.length));
    const plates = computed(() =>
    {
        const texts = plateTexts({
            signals: settings.shipLabels ? signalApps.value.map(c => ({ label: labelOf(c.packageName), count: c.notifications.length })) : [],
            contacts: settings.shipLabels ? starred.value.map(c => c.name) : [],
            shuttles: settings.favorites.slice(0, bays.value.length).map(labelOf),
        });
        return withControls(withSigns(settings.shipLabels ? withStencils(texts) : texts), shipControls.labels.value);
    });
    const shuttles = computed(() => shuttleVertices(bays.value));
    // the shuttles are walked round like any crate
    const segs = computed(() => collisionSegments(ROOMS, [...PROPS, ...bays.value.map(b => b.prop)]));

    return { labelOf, signalApps, starred, bays, plates, shuttles, segs };
}
