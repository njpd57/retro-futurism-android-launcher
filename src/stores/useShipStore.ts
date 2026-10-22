import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { START, type RoomId } from '@/ship3d/world';

export interface ShipPose { x: number; y: number; yaw: number; pitch: number }

/** Where the camera is in the ship, and which room's card is open. The panel moves the camera; Home resets it. */
export const useShipStore = defineStore('ship', () =>
{
    const pose = shallowRef<ShipPose>({ ...START });
    /** counts the resets, so the panel knows the camera was moved from outside */
    const epoch = ref(0);
    /** the room whose card (its widgets in a window) is open */
    const card = ref<RoomId | null>(null);

    function reset()
    {
        pose.value = { ...START };
        epoch.value++;
        card.value = null;
    }

    const openCard = (room: RoomId) => { card.value = room; };
    const closeCard = () => { card.value = null; };

    return { pose, epoch, card, reset, openCard, closeCard };
});
