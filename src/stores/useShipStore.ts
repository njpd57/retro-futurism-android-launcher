import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { START, type RoomId } from '@/ship3d/world';
import { useSettingsStore } from './useSettingsStore';

export interface ShipPose { x: number; y: number; yaw: number; pitch: number }

/** Where the camera is in the ship, and which room's card is open. The panel moves the camera; Home resets it. */
export const useShipStore = defineStore('ship', () =>
{
    const settings = useSettingsStore();
    const pose = shallowRef<ShipPose>({ ...START });
    /** counts the resets, so the panel knows the camera was moved from outside */
    const epoch = ref(0);
    /** the room whose card (its widgets in a window) is open */
    const card = ref<RoomId | null>(null);
    /** the app whose notifications a crew member of COMMS was asked about */
    const signals = ref<string | null>(null);
    /** counts the hub terminal's requests to search, which `App.vue` answers by focusing the prompt */
    const search = ref(0);

    /** Home: closes what is open and, unless the user keeps the last position, puts the camera back on the bridge. */
    function reset()
    {
        card.value = null;
        signals.value = null;
        if (settings.shipStart === 'last') return;
        pose.value = { ...START };
        epoch.value++;
    }

    const openCard = (room: RoomId) => { card.value = room; };
    const closeCard = () => { card.value = null; };
    const openSignals = (packageName: string) => { signals.value = packageName; };
    const closeSignals = () => { signals.value = null; };
    const askSearch = () => { search.value++; };

    return { pose, epoch, card, signals, search, reset, openCard, closeCard, openSignals, closeSignals, askSearch };
});
