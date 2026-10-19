<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAppsStore } from '@/stores/useAppsStore';
import { useTogglesStore } from '@/stores/useTogglesStore';
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

const onOff = (v: boolean) => v ? '[X]' : '[ ]';
const bloomPct = computed({
    get: () => Math.round(settings.bloom * 100),
    set: v => { settings.bloom = v / 100; },
});
</script>

<template>
    <TermMenu title="AJUSTES" @close="$emit('close')">
        <MenuItem @click="settings.phosphor = settings.phosphor === 'amber' ? 'green' : 'amber'">
            <span>COLOR</span><span>{{ settings.phosphor === 'amber' ? 'ÁMBAR' : 'VERDE' }}</span>
        </MenuItem>

        <div class="slider">
            <span>BLOOM</span>
            <input v-model.number="bloomPct" type="range" min="0" max="100" step="5" />
            <span>{{ bloomPct }}%</span>
        </div>

        <MenuItem @click="settings.scanlines = !settings.scanlines"><span>SCANLINES</span><span>{{ onOff(settings.scanlines) }}</span></MenuItem>
        <MenuItem @click="settings.flicker = !settings.flicker"><span>PARPADEO</span><span>{{ onOff(settings.flicker) }}</span></MenuItem>
        <MenuItem @click="settings.vignette = !settings.vignette"><span>VIÑETA</span><span>{{ onOff(settings.vignette) }}</span></MenuItem>
        <MenuItem @click="settings.labelCase = settings.labelCase === 'upper' ? 'normal' : 'upper'">
            <span>NOMBRES</span><span>{{ settings.labelCase === 'upper' ? 'MAYÚSCULAS' : 'NORMAL' }}</span>
        </MenuItem>
        <MenuItem @click="settings.showType = !settings.showType"><span>COLUMNA TIPO</span><span>{{ onOff(settings.showType) }}</span></MenuItem>

        <MenuItem @click="toggles.bridgeButtonVisibility = bridgeButtonShown ? 'hidden' : 'shown'">
            <span>BOTÓN BRIDGE</span><span>{{ onOff(bridgeButtonShown) }}</span>
        </MenuItem>

        <template v-if="hidden.length">
            <div class="section">APPS OCULTAS (TOCA DOS VECES PARA MOSTRAR)</div>
            <MenuItem v-for="h in hidden" :key="h.packageName" :class="{ armed: armed === h.packageName }" @click="onHiddenTap(h.packageName)">
                <span>{{ h.label }}</span><span>{{ armed === h.packageName ? '¿MOSTRAR?' : '+' }}</span>
            </MenuItem>
        </template>

        <MenuItem @click="$emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>
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
</style>
