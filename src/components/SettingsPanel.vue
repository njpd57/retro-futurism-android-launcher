<script setup lang="ts">
import { computed, ref } from 'vue';
import { PHOSPHORS, useSettingsStore } from '@/stores/useSettingsStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
import { bridgeHas } from '@/utils/bridgeHas';
import BackupMenu from './BackupMenu.vue';
import HiddenAppsMenu from './HiddenAppsMenu.vue';
import PermissionsMenu from './PermissionsMenu.vue';
import MotherSettings from './MotherSettings.vue';
import TermMenu from './TermMenu.vue';
import MenuItem from './MenuItem.vue';
import { canVibrate } from '@/utils/haptics';
import { nextIdleMinutes } from '@/utils/idle';
import { IMAGE_FILTERS, nextFilter } from '@/utils/crtFilter';
import { defaultLayoutSet } from '@/utils/dashboardLayout';

defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const toggles = useTogglesStore();

// the value only changes once Bridge sends the event back
const bridgeButtonShown = computed(() => toggles.bridgeButtonVisibility === 'shown');

// Which fork methods the installed Bridge has, to see what the launcher can use on this device.
const DIAGNOSTIC_METHODS = [
    'getWindowInsetsSwapFixed', 'getBattery', 'getConnectivity',
    'getNotificationsURL', 'getMediaSession', 'getCalendarEventsURL', 'getNextAlarm', 'requestOpenUrl',
    'getContactsURL', 'getAppUsageURL', 'getAppShortcutsURL', 'getStorageStats', 'getProxyURL', 'getTtsAvailable', 'requestVibrate',
] as const;
const diagnosticOpen = ref(false);

// Two taps to load the starting panels: the first arms it, the second replaces the current ones.
const resetArmed = ref(false);
function resetPanels()
{
    if (!resetArmed.value) { resetArmed.value = true; return; }
    settings.layouts = defaultLayoutSet();
    resetArmed.value = false;
}
const motherOpen = ref(false);
const backupOpen = ref(false);
const permissionsOpen = ref(false);
const hiddenOpen = ref(false);
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
const CURVE_SLIDERS = [
    { key: 'curvatureBend', label: 'DOBLEZ' },
    { key: 'curvatureCorners', label: 'ESQUINAS' },
    { key: 'curvatureShade', label: 'SOMBRA' },
] as const;

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
        <template v-if="settings.curvature">
            <div v-for="c in CURVE_SLIDERS" :key="c.key" class="slider">
                <span>{{ c.label }}</span>
                <input v-model.number="settings[c.key]" type="range" min="0" max="100" step="5" />
                <span>{{ settings[c.key] }}%</span>
            </div>
        </template>
        <MenuItem @click="settings.tubePower = !settings.tubePower"><span>APAGADO DEL TUBO</span><span>{{ onOff(settings.tubePower) }}</span></MenuItem>
        <MenuItem @click="settings.autoDegauss = !settings.autoDegauss"><span>DESMAGNETIZADO AUTOMÁTICO</span><span>{{ onOff(settings.autoDegauss) }}</span></MenuItem>
        <MenuItem @click="settings.phosphorBurn = !settings.phosphorBurn"><span>PERSISTENCIA DE FÓSFORO</span><span>{{ onOff(settings.phosphorBurn) }}</span></MenuItem>
        <MenuItem v-if="settings.phosphorBurn && settings.burnMinutes" @click="settings.burnMinutes = 0"><span>[BORRAR QUEMADURA]</span><span>{{ Math.round(settings.burnMinutes / 60) }} H</span></MenuItem>
        <MenuItem @click="settings.imageFilter = nextFilter(settings.imageFilter)">
            <span>FILTRO IMÁGENES</span><span>{{ IMAGE_FILTERS.find(f => f.id === settings.imageFilter)?.label }}</span>
        </MenuItem>
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
        <MenuItem @click="canVibrate() && (settings.haptics = !settings.haptics)">
            <span>VIBRACIÓN</span><span>{{ canVibrate() ? onOff(settings.haptics) : 'NO DISPONIBLE' }}</span>
        </MenuItem>
        <MenuItem @click="settings.bootSequence = !settings.bootSequence"><span>ARRANQUE</span><span>{{ onOff(settings.bootSequence) }}</span></MenuItem>
        <MenuItem @click="settings.idleMinutes = nextIdleMinutes(settings.idleMinutes)">
            <span>REPOSO</span><span>{{ settings.idleMinutes ? `${settings.idleMinutes} MIN` : 'OFF' }}</span>
        </MenuItem>
        <MenuItem @click="settings.nightShift = !settings.nightShift"><span>TURNO NOCTURNO</span><span>{{ onOff(settings.nightShift) }}</span></MenuItem>
        <MenuItem @click="settings.hypersleep = !settings.hypersleep"><span>HIPERSUEÑO</span><span>{{ onOff(settings.hypersleep) }}</span></MenuItem>
        <MenuItem @click="settings.showType = !settings.showType"><span>COLUMNA TIPO</span><span>{{ onOff(settings.showType) }}</span></MenuItem>
        <MenuItem @click="settings.folderBoxes = !settings.folderBoxes"><span>CARPETAS EN CAJAS</span><span>{{ onOff(settings.folderBoxes) }}</span></MenuItem>
        <MenuItem v-if="settings.folderBoxes" @click="settings.appsLayout = settings.appsLayout === 'deck' ? 'boxes' : 'deck'"><span>VISTA DE CAJAS</span><span>{{ settings.appsLayout === 'deck' ? 'CUBIERTAS' : 'REJILLA' }}</span></MenuItem>

        <MenuItem @click="toggles.bridgeButtonVisibility = bridgeButtonShown ? 'hidden' : 'shown'">
            <span>BOTÓN BRIDGE</span><span>{{ onOff(bridgeButtonShown) }}</span>
        </MenuItem>

        <MenuItem @click="settings.ownStatusBar = !settings.ownStatusBar"><span>BARRA PROPIA</span><span>{{ onOff(settings.ownStatusBar) }}</span></MenuItem>

        <MenuItem @click="resetPanels"><span>{{ resetArmed ? '¿CONFIRMAR? PULSA OTRA VEZ' : '[RESTABLECER PANELES]' }}</span><span>P1-P4</span></MenuItem>

        <MenuItem @click="hiddenOpen = true"><span>APPS OCULTAS ({{ settings.hiddenApps.length }})</span><span>›</span></MenuItem>

        <MenuItem @click="motherOpen = true"><span>MOTHER</span><span>›</span></MenuItem>
        <MenuItem @click="permissionsOpen = true"><span>PERMISOS</span><span>›</span></MenuItem>
        <MenuItem @click="backupOpen = true"><span>RESPALDO</span><span>›</span></MenuItem>
        <MenuItem @click="diagnosticOpen = true"><span>DIAGNÓSTICO</span><span>›</span></MenuItem>
        <MenuItem @click="$emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>

        <MotherSettings v-if="motherOpen" @close="motherOpen = false" />
        <BackupMenu v-if="backupOpen" @close="backupOpen = false" />
        <PermissionsMenu v-if="permissionsOpen" @close="permissionsOpen = false" />
        <HiddenAppsMenu v-if="hiddenOpen" @close="hiddenOpen = false" />

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

.method { font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; }
</style>
