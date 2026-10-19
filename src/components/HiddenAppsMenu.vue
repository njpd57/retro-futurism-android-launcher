<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { displayName } from '@/utils/appSearch';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const appsStore = useAppsStore();

const name = (label: string) => settings.labelCase === 'upper' ? label.toUpperCase() : label;

const hidden = computed(() => settings.hiddenApps
    .map(p => ({ packageName: p, label: name(appsStore.apps.get(p)?.label ?? p) }))
    .sort((a, b) => a.label.localeCompare(b.label)));

// Showing an app again takes two taps on the same row, so a stray tap doesn't bring it back.
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

// Picker: every installed app with a box; the marks are only applied with [APLICAR].
const picking = ref(false);
const marked = ref(new Set<string>());

const allApps = computed(() => [...appsStore.apps.values()]
    .map(a => ({ packageName: a.packageName, label: name(displayName(a, settings.aliases)) }))
    .sort((a, b) => a.label.localeCompare(b.label)));

const changed = computed(() =>
{
    const current = new Set(settings.hiddenApps);
    return [...marked.value].filter(p => !current.has(p)).length + [...current].filter(p => !marked.value.has(p)).length;
});

function startPicking()
{
    marked.value = new Set(settings.hiddenApps);
    picking.value = true;
}

function toggle(packageName: string)
{
    const next = new Set(marked.value);
    if (!next.delete(packageName)) next.add(packageName);
    marked.value = next;
}

function apply()
{
    settings.hiddenApps = [...marked.value];
    picking.value = false;
}
</script>

<template>
    <TermMenu title="APPS OCULTAS" @close="$emit('close')">
        <MenuItem @click="startPicking"><span>MARCAR APPS A OCULTAR</span><span>›</span></MenuItem>

        <div class="section">{{ hidden.length ? 'OCULTAS (TOCA DOS VECES PARA MOSTRAR)' : 'NO HAY APPS OCULTAS' }}</div>
        <MenuItem v-for="h in hidden" :key="h.packageName" :class="{ armed: armed === h.packageName }" @click="onHiddenTap(h.packageName)">
            <span>{{ h.label }}</span><span>{{ armed === h.packageName ? '¿MOSTRAR?' : '+' }}</span>
        </MenuItem>

        <TermMenu v-if="picking" title="MARCAR APPS" @close="picking = false">
            <div class="actions">
                <MenuItem @click="apply"><span>[APLICAR]</span><span>{{ changed ? `${changed} CAMBIOS` : 'SIN CAMBIOS' }}</span></MenuItem>
                <MenuItem @click="picking = false"><span>[CANCELAR]</span></MenuItem>
            </div>
            <div class="hint">MARCADA = OCULTA</div>
            <MenuItem v-for="a in allApps" :key="a.packageName" @click="toggle(a.packageName)">
                <span class="label">{{ a.label }}</span><span>{{ marked.has(a.packageName) ? '[X]' : '[ ]' }}</span>
            </MenuItem>
        </TermMenu>
    </TermMenu>
</template>

<style scoped lang="scss">
.section { padding: 6px 10px 2px; opacity: 0.7; }
.hint { padding: 2px 10px; color: var(--ph-dim); font-size: 0.8em; }
.armed { @include inverse; }

// the buttons stay in view while a long list scrolls
.actions {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--ph-bg);
    border-bottom: 1px solid var(--ph-dim);
}

.label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
