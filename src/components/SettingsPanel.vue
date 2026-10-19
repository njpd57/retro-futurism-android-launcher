<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { PHOSPHORS, useSettingsStore } from '@/stores/useSettingsStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
import { bridgeHas } from '@/utils/bridgeHas';
import MotherSettings from './MotherSettings.vue';
import TermMenu from './TermMenu.vue';
import MenuItem from './MenuItem.vue';

defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const appsStore = useAppsStore();
const toggles = useTogglesStore();

// the value only changes once Bridge sends the event back
const bridgeButtonShown = computed(() => toggles.bridgeButtonVisibility === 'shown');

const hidden = computed(() => settings.hiddenApps.map(p => ({ packageName: p, label: appsStore.apps.get(p)?.label ?? p })));

// Unhiding takes two taps on the same row, so a stray tap doesn't bring an app back.
const ARM_MS = 3000;
const armed = ref<string | null>(null);
let armTimer: number | undefined;

function onHiddenTap(packageName: string)
{
    window.clearTimeout(armTimer);

    if (armed.value === packageName)
    {
        armed.value = null;
        settings.unhideApp(packageName);
        return;
    }

    armed.value = packageName;
    armTimer = window.setTimeout(() => { armed.value = null; }, ARM_MS);
}

onBeforeUnmount(() => window.clearTimeout(armTimer));

// Which fork methods the installed Bridge has, to see what the launcher can use on this device.
const DIAGNOSTIC_METHODS = [
    'getWindowInsetsSwapFixed', 'getBattery', 'getConnectivity',
    'getNotificationsURL', 'getMediaSession', 'getCalendarEventsURL', 'getNextAlarm', 'requestOpenUrl',
    'getContactsURL', 'getAppUsageURL', 'getAppShortcutsURL', 'getStorageStats',
] as const;
const diagnosticOpen = ref(false);
const motherOpen = ref(false);
const diagnostic = computed(() => DIAGNOSTIC_METHODS.map(m => ({ method: m, ok: bridgeHas(m) })));

const volumePct = computed({
    get: () => Math.round(settings.volume * 100),
    set: v => { settings.volume = v / 100; },
});

function nextPhosphor()
{
    const i = PHOSPHORS.findIndex(p => p.id === settings.phosphor);
    settings.phosphor = PHOSPHORS[(i + 1) % PHOSPHORS.length].id;
}

const onOff = (v: boolean) => v ? '[X]' : '[ ]';
const bloomPct = computed({
    get: () => Math.round(settings.bloom * 100),
    set: v => { settings.bloom = v / 100; },
});
</script>

<template>
    <TermMenu title="AJUSTES" @close="$emit('close')">
        <MenuItem @click="nextPhosphor">
            <span>COLOR</span><span>{{ PHOSPHORS.find(p => p.id === settings.phosphor)?.label }}</span>
        </MenuItem>

        <div class="slider">
            <span>BLOOM</span>
            <input v-model.number="bloomPct" type="range" min="0" max="100" step="5" />
            <span>{{ bloomPct }}%</span>
        </div>

        <MenuItem @click="settings.scanlines = !settings.scanlines"><span>SCANLINES</span><span>{{ onOff(settings.scanlines) }}</span></MenuItem>
        <MenuItem @click="settings.flicker = !settings.flicker"><span>PARPADEO</span><span>{{ onOff(settings.flicker) }}</span></MenuItem>
        <MenuItem @click="settings.vignette = !settings.vignette"><span>VIÑETA</span><span>{{ onOff(settings.vignette) }}</span></MenuItem>
        <MenuItem @click="settings.sweep = !settings.sweep"><span>BARRIDO</span><span>{{ onOff(settings.sweep) }}</span></MenuItem>
        <MenuItem @click="settings.curvature = !settings.curvature"><span>CURVATURA</span><span>{{ onOff(settings.curvature) }}</span></MenuItem>
        <MenuItem @click="settings.showIcons = !settings.showIcons"><span>ICONOS</span><span>{{ onOff(settings.showIcons) }}</span></MenuItem>
        <MenuItem @click="settings.labelCase = settings.labelCase === 'upper' ? 'normal' : 'upper'">
            <span>NOMBRES</span><span>{{ settings.labelCase === 'upper' ? 'MAYÚSCULAS' : 'NORMAL' }}</span>
        </MenuItem>
        <MenuItem @click="settings.soundUi = !settings.soundUi"><span>SONIDO UI</span><span>{{ onOff(settings.soundUi) }}</span></MenuItem>
        <MenuItem @click="settings.soundAmbient = !settings.soundAmbient"><span>AMBIENTE</span><span>{{ onOff(settings.soundAmbient) }}</span></MenuItem>
        <div class="slider">
            <span>VOLUMEN</span>
            <input v-model.number="volumePct" type="range" min="0" max="100" step="5" />
            <span>{{ volumePct }}%</span>
        </div>
        <MenuItem @click="settings.showType = !settings.showType"><span>COLUMNA TIPO</span><span>{{ onOff(settings.showType) }}</span></MenuItem>

        <MenuItem @click="toggles.bridgeButtonVisibility = bridgeButtonShown ? 'hidden' : 'shown'">
            <span>BOTÓN BRIDGE</span><span>{{ onOff(bridgeButtonShown) }}</span>
        </MenuItem>

        <MenuItem @click="settings.ownStatusBar = !settings.ownStatusBar"><span>BARRA PROPIA</span><span>{{ onOff(settings.ownStatusBar) }}</span></MenuItem>

        <template v-if="hidden.length">
            <div class="section">APPS OCULTAS (TOCA DOS VECES PARA MOSTRAR)</div>
            <MenuItem v-for="h in hidden" :key="h.packageName" :class="{ armed: armed === h.packageName }" @click="onHiddenTap(h.packageName)">
                <span>{{ h.label }}</span><span>{{ armed === h.packageName ? '¿MOSTRAR?' : '+' }}</span>
            </MenuItem>
        </template>

        <MenuItem @click="motherOpen = true"><span>MOTHER</span><span>›</span></MenuItem>
        <MenuItem @click="diagnosticOpen = true"><span>DIAGNÓSTICO</span><span>›</span></MenuItem>
        <MenuItem @click="$emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>

        <MotherSettings v-if="motherOpen" @close="motherOpen = false" />

        <TermMenu v-if="diagnosticOpen" title="DIAGNÓSTICO" @close="diagnosticOpen = false">
            <MenuItem v-for="d in diagnostic" :key="d.method"><span class="method">{{ d.method }}</span><span>{{ d.ok ? 'OK' : '--' }}</span></MenuItem>
        </TermMenu>
    </TermMenu>
</template>

<style scoped lang="scss">
.slider {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px;

    > input { flex: 1; min-width: 0; accent-color: var(--ph); }
}

.section { padding: 6px 10px 2px; opacity: 0.7; }

.armed { @include inverse; }
.method { font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; }
</style>
