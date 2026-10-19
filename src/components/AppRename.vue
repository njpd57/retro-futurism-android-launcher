<script setup lang="ts">
import { ref } from 'vue';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const props = defineProps<{ app: InstalledAppInfo }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const draft = ref(settings.aliases[props.app.packageName] ?? props.app.label);

function save()
{
    // the original name stays the default: an alias equal to it is no alias
    settings.setAlias(props.app.packageName, draft.value.trim() === props.app.label ? '' : draft.value);
    emit('close');
}

function reset()
{
    settings.setAlias(props.app.packageName, '');
    emit('close');
}
</script>

<template>
    <TermMenu title="RENOMBRAR" @close="emit('close')">
        <div class="label">NOMBRE ORIGINAL: {{ app.label.toUpperCase() }}</div>
        <input v-model="draft" type="text" autocomplete="off" spellcheck="false" maxlength="40" @keydown.enter="save" />
        <MenuItem @click="save"><span>[GUARDAR]</span></MenuItem>
        <MenuItem v-if="settings.aliases[app.packageName]" @click="reset"><span>[RESTABLECER]</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.label { color: var(--ph-dim); font-size: 0.85em; padding: 4px 0; }

input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ph);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
    margin-bottom: 4px;
}
</style>
