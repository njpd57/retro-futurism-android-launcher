<script setup lang="ts">
import { computed } from 'vue';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useContactsStore } from '@/stores/useContactsStore';
import { useNotificationsStore } from '@/stores/useNotificationsStore';
import { useQuickSettingsStore } from '@/stores/useQuickSettingsStore';
import { useSpeechStore } from '@/stores/useSpeechStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { bridgeHas } from '@/utils/bridgeHas';
import { canVibrate } from '@/utils/haptics';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const notifications = useNotificationsStore();
const calendar = useCalendarStore();
const contacts = useContactsStore();
const usage = useUsageStore();
const speech = useSpeechStore();
const quick = useQuickSettingsStore();

type State = 'ok' | 'missing' | 'unavailable';

interface Row
{
    id: string;
    label: string;
    state: State;
    /** one line on what it is for or what to do */
    note: string;
    action?: { label: string; run: () => void };
}

// Android permissions the user grants outside the launcher: the stores re-read them when the launcher resumes.
const rows = computed<Row[]>(() => [
    {
        id: 'notifications', label: 'NOTIFICACIONES', note: 'PANEL DE ALERTAS, RADAR Y CONTADOR',
        state: !notifications.supported ? 'unavailable' : notifications.canRead ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => notifications.requestAccess() },
    },
    {
        id: 'calendar', label: 'CALENDARIO', note: 'AGENDA E INFORME DE TURNO',
        state: !calendar.supported ? 'unavailable' : calendar.canRead ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => calendar.requestAccess() },
    },
    {
        id: 'contacts', label: 'CONTACTOS', note: 'WIDGET CONTACTOS Y BÚSQUEDA',
        state: !contacts.supported ? 'unavailable' : contacts.canRead ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => contacts.requestAccess() },
    },
    {
        id: 'usage', label: 'USO DE APPS', note: 'WIDGET USO Y ORDEN POR USO',
        state: !usage.supported ? 'unavailable' : usage.canRead ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => usage.requestAccess() },
    },
    {
        id: 'system-settings', label: 'AJUSTES DEL SISTEMA', note: 'BRILLO DESDE EL PUENTE DE LA NAVE',
        state: !bridgeHas('getCanWriteSystemSettings') ? 'unavailable' : quick.canWriteSettings ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => quick.grant('settings') },
    },
    {
        id: 'policy', label: 'NO MOLESTAR', note: 'MODO DE TIMBRE DESDE LA NAVE',
        state: !bridgeHas('getCanAccessNotificationPolicy') ? 'unavailable' : quick.canPolicy ? 'ok' : 'missing',
        action: { label: 'CONCEDER', run: () => quick.grant('policy') },
    },
    {
        id: 'shortcuts', label: 'ATAJOS DE APPS', note: 'SOLO SI BRIDGE ES EL LAUNCHER POR DEFECTO',
        state: !bridgeHas('getCanAccessAppShortcuts') ? 'unavailable' : Bridge.getCanAccessAppShortcuts() ? 'ok' : 'missing',
    },
    {
        id: 'voice', label: 'VOZ DE MOTHER', note: speech.message,
        state: speech.available ? 'ok' : 'missing',
        action: speech.available
            ? { label: 'PROBAR', run: () => speech.speak('Mother en línea. Todos los sistemas funcionan con normalidad.') }
            : speech.canOpenSettings ? { label: 'AJUSTES DE VOZ', run: () => speech.openSettings() } : undefined,
    },
    {
        id: 'storage', label: 'ALMACÉN', note: 'NECESITA getStorageStats EN EL FORK',
        state: bridgeHas('getStorageStats') ? 'ok' : 'unavailable',
    },
    {
        id: 'proxy', label: 'RED POR BRIDGE', note: 'RESPALDO DEL CLIMA SI EL WEBVIEW NO LLEGA',
        state: bridgeHas('getProxyURL') ? 'ok' : 'unavailable',
    },
    {
        id: 'orientation', label: 'SENSOR DE RUMBO', note: 'WIDGET RUMBO',
        state: 'DeviceOrientationEvent' in window ? 'ok' : 'unavailable',
    },
    {
        id: 'vibration', label: 'VIBRACIÓN', note: 'PULSO AL PULSAR',
        state: canVibrate() ? 'ok' : 'unavailable',
    },
]);

const mark = (s: State) => s === 'ok' ? '[OK]' : s === 'missing' ? '[--]' : 'N/D';
</script>

<template>
    <TermMenu title="PERMISOS" @close="emit('close')">
        <div class="hint">[--] FALTA · N/D NO DISPONIBLE EN ESTE BRIDGE O WEBVIEW. LOS PERMISOS SE CONCEDEN EN AJUSTES DE ANDROID Y SE ACTUALIZAN AL VOLVER.</div>
        <template v-for="r in rows" :key="r.id">
            <MenuItem @click="r.action && r.state !== 'unavailable' && r.action.run()">
                <span>{{ r.label }}</span>
                <span>{{ r.state === 'missing' && r.action ? `[${r.action.label}]` : r.state === 'ok' && r.action ? `[OK] [${r.action.label}]` : mark(r.state) }}</span>
            </MenuItem>
            <div class="note">{{ r.note }}</div>
        </template>
    </TermMenu>
</template>

<style scoped lang="scss">
.hint { color: var(--ph-dim); font-size: 0.8em; padding: 2px 0 6px; }
.note { color: var(--ph-dim); font-size: 0.75em; padding: 0 0 4px 12px; }
</style>
