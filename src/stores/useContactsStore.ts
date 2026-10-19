import { defineStore } from "pinia";
import { ref } from "vue";
import type { BridgeContact } from "@/types/bridge-fork";
import { bridgeHas } from "@/utils/bridgeHas";
import { useBridgeEventStore } from "./useBridgeEventStore";

/** Starred contacts from the fork (only the ones with a phone number). */
export const useContactsStore = defineStore('contacts', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const supported = bridgeHas('getContactsURL') && bridgeHas('getCanReadContacts');
    const canRead = ref(false);
    const starred = ref<BridgeContact[]>([]);

    async function sync()
    {
        if (!supported) return;

        canRead.value = Bridge.getCanReadContacts();
        if (!canRead.value)
        {
            starred.value = [];
            return;
        }

        try
        {
            const resp = await fetch(Bridge.getContactsURL('', true, 0));
            starred.value = ((await resp.json()) as { contacts: BridgeContact[] }).contacts;
        }
        catch (err)
        {
            console.error(err);
        }
    }

    sync();

    bridgeEvents.addEventListener(ev =>
    {
        if (ev.name === 'contactsChanged' || ev.name === 'canReadContactsChanged' || ev.name === 'afterResume')
            sync();
    });

    function requestAccess() { Bridge.requestContactsPermission(); }
    function openContact(c: BridgeContact) { Bridge.requestOpenContact(c.lookupKey); }
    function call(number: string) { Bridge.requestOpenUrl(`tel:${number}`); }
    function sms(number: string) { Bridge.requestOpenUrl(`sms:${number}`); }

    return { supported, canRead, starred, sync, requestAccess, openContact, call, sms };
});
