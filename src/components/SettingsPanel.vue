<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAnimStore } from '@/stores/useAnimStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
import { useTubeStore } from '@/stores/useTubeStore';
import { useMotherStore } from '@/stores/useMotherStore';
import { useProtocolsStore } from '@/stores/useProtocolsStore';
import { useSettingsViewStore } from '@/stores/useSettingsViewStore';
import { bridgeHas } from '@/utils/bridgeHas';
import { canVibrate } from '@/utils/haptics';
import { defaultLayoutSet } from '@/utils/dashboardLayout';
import { SETTINGS_SECTIONS, summary, visibleRows, type ActionId, type SettingRow, type SettingSection } from '@/utils/settingsSchema';
import BackupMenu from './BackupMenu.vue';
import HiddenAppsMenu from './HiddenAppsMenu.vue';
import PermissionsMenu from './PermissionsMenu.vue';
import ProtocolsMenu from './ProtocolsMenu.vue';
import MotherSettings from './MotherSettings.vue';
import TermMenu from './TermMenu.vue';
import TuiWindow from './TuiWindow.vue';
import MenuItem from './MenuItem.vue';
import TermSlider from './settings/TermSlider.vue';
import TermChoice from './settings/TermChoice.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const anim = useAnimStore();
const toggles = useTogglesStore();
const tube = useTubeStore();
const mother = useMotherStore();
const protocols = useProtocolsStore();
const view = useSettingsViewStore();

// the page always opens at the root
onMounted(view.reset);

// Which fork methods the installed Bridge has, to see what the launcher can use on this device.
const DIAGNOSTIC_METHODS = [
    'getWindowInsetsSwapFixed', 'getBattery', 'getConnectivity',
    'getNotificationsURL', 'getMediaSession', 'getCalendarEventsURL', 'getNextAlarm', 'requestOpenUrl',
    'getContactsURL', 'getAppUsageURL', 'getAppShortcutsURL', 'getStorageStats', 'getProxyURL', 'getTtsAvailable', 'requestVibrate',
] as const;
const diagnostic = computed(() => DIAGNOSTIC_METHODS.map(m => ({ method: m, ok: bridgeHas(m) })));

// The schema reads settings by key; the store is a reactive object, so it serves as the values as it is.
const store = settings as unknown as Record<string, unknown>;
const values = computed(() => ({ ...settings.$state, motherKey: mother.hasKey }));

const section = computed<SettingSection | null>(() => SETTINGS_SECTIONS.find(s => s.id === view.section) ?? null);
const rows = computed(() => section.value ? visibleRows(section.value, values.value) : []);
const title = computed(() => section.value ? `AJUSTES › ${section.value.title}` : 'AJUSTES');

function openSection(s: SettingSection)
{
    if (s.opens) view.submenu = s.opens;
    else view.section = s.id;
}

// The footer explains the last row touched; a new section starts with its own description.
const hint = ref('');
watch(section, s => { hint.value = s?.hint ?? ''; resetArmed.value = false; });
const touch = (row: SettingRow) => { hint.value = `${row.label.replace(/[[\]]/g, '')}: ${row.hint}`; };

const onOff = (v: boolean) => v ? '[X]' : '[ ]';

function toggle(row: SettingRow & { kind: 'toggle' })
{
    touch(row);
    store[row.key] = !store[row.key];
}

const sliderValue = (row: SettingRow & { kind: 'slider' }) => row.fraction ? Math.round(Number(store[row.key]) * 100) : Number(store[row.key]);
function setSlider(row: SettingRow & { kind: 'slider' }, v: number)
{
    store[row.key] = row.fraction ? v / 100 : v;
}

const bridgeButtonShown = computed(() => toggles.bridgeButtonVisibility === 'shown');

// Two taps to load the starting panels: the first arms it, the second replaces the current ones.
const resetArmed = ref(false);

function actionValue(id: ActionId)
{
    switch (id)
    {
        case 'bridgeButton': return onOff(bridgeButtonShown.value);
        case 'haptics': return canVibrate() ? onOff(settings.haptics) : 'NO DISPONIBLE';
        case 'clearBurn': return `${Math.round(settings.burnMinutes / 60)} H`;
        case 'resetPanels': return 'P1-P4';
        default: return '';
    }
}

function runAction(row: SettingRow & { kind: 'action' })
{
    touch(row);
    switch (row.id)
    {
        case 'degauss': tube.degauss(); break;
        case 'clearBurn': settings.burnMinutes = 0; break;
        // the value only changes once Bridge sends the event back
        case 'bridgeButton': toggles.bridgeButtonVisibility = bridgeButtonShown.value ? 'hidden' : 'shown'; break;
        case 'haptics': if (canVibrate()) settings.haptics = !settings.haptics; break;
        case 'resetPanels':
            if (!resetArmed.value) { resetArmed.value = true; hint.value = 'PULSA OTRA VEZ PARA CONFIRMAR'; break; }
            settings.layouts = defaultLayoutSet();
            resetArmed.value = false;
            hint.value = 'PANELES RESTABLECIDOS';
            break;
    }
}

const linkLabel = (row: SettingRow & { kind: 'link' }) =>
    row.target === 'protocols' ? `${row.label} (${protocols.active.length}/${protocols.rules.length})`
    : row.target === 'hidden' ? `${row.label} (${settings.hiddenApps.length})`
    : row.label;

function openLink(row: SettingRow & { kind: 'link' })
{
    touch(row);
    view.submenu = row.target;
}

function back()
{
    if (!view.back()) emit('close');
}

// Hold to see the tube: the page fades out (not display:none, so the touchend still reaches the button).
const peek = ref(false);
</script>

<template>
    <div class="settings-page" :class="{ peek, opening: anim.transitions }">
        <TuiWindow class="window" :title="title" fill :minimizable="false" closable @close="emit('close')">
            <div class="content">
                <template v-if="!section">
                    <div class="dim header">MU-TH-UR 6000 · CONFIGURACIÓN DE SISTEMA</div>
                    <MenuItem v-for="s in SETTINGS_SECTIONS" :key="s.id" @click="openSection(s)">
                        <span><span class="dim">{{ s.code }}</span> {{ s.title }}</span>
                        <span><span class="dim">{{ summary(s.id, values) }}</span> ›</span>
                    </MenuItem>
                    <MenuItem @click="emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>
                </template>

                <template v-else>
                    <MenuItem @click="back"><span>« VOLVER</span><span class="dim">{{ section.code }}</span></MenuItem>
                    <template v-for="row in rows" :key="'key' in row ? row.key : 'id' in row ? row.id : row.target">
                        <MenuItem v-if="row.kind === 'toggle'" @click="toggle(row)">
                            <span>{{ row.label }}</span><span>{{ onOff(store[row.key] === true) }}</span>
                        </MenuItem>
                        <TermSlider
                            v-else-if="row.kind === 'slider'" :label="row.label" :min="row.min" :max="row.max" :step="row.step"
                            :model-value="sliderValue(row)" @update:model-value="setSlider(row, $event)" @touch="touch(row)"
                        />
                        <TermChoice
                            v-else-if="row.kind === 'choice'" :label="row.label" :options="row.options"
                            :model-value="store[row.key]" @update:model-value="store[row.key] = $event" @touch="touch(row)"
                        />
                        <MenuItem v-else-if="row.kind === 'link'" @click="openLink(row)">
                            <span>{{ linkLabel(row) }}</span><span>›</span>
                        </MenuItem>
                        <MenuItem v-else :class="{ armed: row.id === 'resetPanels' && resetArmed }" @click="runAction(row)">
                            <span>{{ row.id === 'resetPanels' && resetArmed ? '¿CONFIRMAR? PULSA OTRA VEZ' : row.label }}</span>
                            <span>{{ actionValue(row.id) }}</span>
                        </MenuItem>
                    </template>
                </template>

                <footer class="footer">
                    <div v-if="section" class="dim hint">» {{ hint }}</div>
                    <div v-else class="dim hint">» SELECCIONE MÓDULO<span class="cursor">_</span></div>
                    <div
                        v-if="section?.preview" class="peek-btn pressable"
                        @touchstart.prevent="peek = true" @touchend="peek = false" @touchcancel="peek = false"
                        @mousedown="peek = true" @mouseup="peek = false" @mouseleave="peek = false"
                    >[MANTÉN: VER TUBO]</div>
                </footer>
            </div>
        </TuiWindow>

        <MotherSettings v-if="view.submenu === 'mother'" @close="view.submenu = null" />
        <BackupMenu v-if="view.submenu === 'backup'" @close="view.submenu = null" />
        <PermissionsMenu v-if="view.submenu === 'permissions'" @close="view.submenu = null" />
        <ProtocolsMenu v-if="view.submenu === 'protocols'" @close="view.submenu = null" />
        <HiddenAppsMenu v-if="view.submenu === 'hidden'" @close="view.submenu = null" />
        <TermMenu v-if="view.submenu === 'diagnostic'" title="DIAGNÓSTICO" @close="view.submenu = null">
            <MenuItem v-for="d in diagnostic" :key="d.method"><span class="method">{{ d.method }}</span><span>{{ d.ok ? 'OK' : '--' }}</span></MenuItem>
        </TermMenu>
    </div>
</template>

<style scoped lang="scss">
.settings-page {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    padding: calc(6px + var(--inset-top, 0px)) 6px calc(6px + var(--inset-bottom, 0px));
    background: var(--ph-bg);

    &.peek { opacity: 0; }

    > .window { flex: 1; }

    // opening: the window draws open from a line (transform and opacity only)
    &.opening > .window { animation: settings-open 0.16s linear both; transform-origin: center; }
}

@keyframes settings-open {
    from { transform: scale(1, 0.03); opacity: 0.5; }
    to { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .settings-page.opening > .window { animation: none; }
}

.content {
    display: flex;
    flex-direction: column;
    min-height: 100%;
}

.dim { color: var(--ph-dim); }
.header { padding: 4px 10px 8px; border-bottom: 1px solid var(--ph-dim); margin-bottom: 4px; font-size: 0.85em; }
.armed { @include inverse; }
.method { font-size: 0.8em; overflow: hidden; text-overflow: ellipsis; }

// kept at the bottom of the page, over the rows when they scroll
.footer {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 6px 10px 2px;
    border-top: 1px solid var(--ph-dim);
    background: var(--ph-bg);

    > .hint { min-height: 1.2em; }
    > .peek-btn { margin-top: 4px; text-align: center; padding: 4px 0; border: 1px solid var(--ph); user-select: none; &:active { @include inverse; } }
}

.cursor { animation: cursor-blink 1s steps(1) infinite; }
@keyframes cursor-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
</style>
