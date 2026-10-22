<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import type { BridgeNotification } from '@/types/bridge-fork';
import { appLabelFor } from '@/utils/notifications';
import { radarContacts } from '@/utils/radar';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

/** One app's notifications, as the radar's scanner shows them: open, dismiss or run their buttons. */
const props = defineProps<{ packageName: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const notifications = useNotificationsStore();
const appsStore = useAppsStore();

const SHOWN_SIGNALS = 8;

const contact = computed(() => radarContacts(notifications.visible, Infinity).find(c => c.packageName === props.packageName) ?? null);
const picked = ref<string | null>(null); // the key of the signal being looked at, when its app has several
const scanned = computed<BridgeNotification | null>(() =>
{
    const c = contact.value;
    if (!c) return null;
    if (c.notifications.length === 1) return c.notifications[0];
    return c.notifications.find(n => n.key === picked.value) ?? null;
});
const clearable = computed(() => contact.value?.notifications.filter(n => n.isClearable) ?? []);

watch(() => props.packageName, () => { picked.value = null; });
// the app's last signal went away: nothing left to scan
watch(contact, c => { if (!c) emit('close'); });

/** Runs an action on a signal and leaves the scanner. */
function act(fn: () => void)
{
    fn();
    emit('close');
}

/** Back from one signal to the list of its app. */
function back()
{
    if (picked.value && (contact.value?.notifications.length ?? 0) > 1) picked.value = null; else emit('close');
}
</script>

<template>
    <TermMenu v-if="contact" title="ESCÁNER" @close="back">
        <div class="contact">
            <div>CONTACTO: {{ appLabelFor(contact.packageName, appsStore.apps).toUpperCase() }} · {{ contact.notifications.length }} {{ contact.notifications.length === 1 ? 'SEÑAL' : 'SEÑALES' }}</div>
            <template v-if="scanned">
                <div v-if="scanned.title">{{ scanned.title }}</div>
                <div v-if="scanned.text" class="dim">{{ scanned.text }}</div>
            </template>
        </div>
        <template v-if="scanned">
            <MenuItem @click="act(() => notifications.open(scanned!.key))"><span>ABRIR</span></MenuItem>
            <MenuItem v-if="scanned.isClearable" @click="act(() => notifications.dismiss(scanned!.key))"><span>NEUTRALIZAR</span></MenuItem>
            <MenuItem v-for="a in scanned.actions.filter(x => !x.acceptsText)" :key="a.index" @click="act(() => notifications.runAction(scanned!.key, a.index))"><span>{{ a.title.toUpperCase() }}</span></MenuItem>
            <MenuItem v-if="contact.notifications.length > 1" @click="picked = null"><span>[VER TODAS]</span></MenuItem>
        </template>
        <template v-else>
            <MenuItem v-for="n in contact.notifications.slice(0, SHOWN_SIGNALS)" :key="n.key" @click="picked = n.key">
                <span class="signal">{{ n.title || n.text || n.packageName }}</span><span>»</span>
            </MenuItem>
            <div v-if="contact.notifications.length > SHOWN_SIGNALS" class="contact dim">+{{ contact.notifications.length - SHOWN_SIGNALS }} MÁS</div>
            <MenuItem v-if="clearable.length > 1" @click="act(() => clearable.forEach(n => notifications.dismiss(n.key)))"><span>NEUTRALIZAR TODAS ({{ clearable.length }})</span></MenuItem>
        </template>
    </TermMenu>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.contact { padding: 4px 10px 8px; overflow-wrap: anywhere; }
.signal { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
</style>
