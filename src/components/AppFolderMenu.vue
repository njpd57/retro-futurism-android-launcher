<script setup lang="ts">
import { computed, ref } from 'vue';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { assignToFolder, cleanFolderName, folderOf } from '@/utils/folders';
import TermInput from './TermInput.vue';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const props = defineProps<{ app: InstalledAppInfo }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const current = computed(() => folderOf(settings.folders, props.app.packageName));
const names = computed(() => Object.keys(settings.folders).sort());
const draft = ref('');

function move(name: string | null)
{
    settings.folders = assignToFolder(settings.folders, props.app.packageName, name);
    emit('close');
}

function create()
{
    if (cleanFolderName(draft.value)) move(draft.value);
}
</script>

<template>
    <TermMenu title="CARPETA" @close="emit('close')">
        <MenuItem v-for="n in names" :key="n" @click="move(n)">
            <span>» {{ n }}/</span><span>{{ n === current ? '[X]' : '[ ]' }}</span>
        </MenuItem>
        <MenuItem v-if="current" @click="move(null)"><span>[SACAR DE LA CARPETA]</span></MenuItem>
        <div class="label">NUEVA CARPETA</div>
        <TermInput v-model="draft" maxlength="16" placeholder="NOMBRE" @submit="create" />
        <MenuItem @click="create"><span>[CREAR Y MOVER]</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.label { color: var(--ph-dim); font-size: 0.85em; padding: 6px 0 2px; }

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

    &::placeholder { color: var(--ph-dim); }
}
</style>
