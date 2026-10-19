<script setup lang="ts">
import { computed } from 'vue';
import { useAppsStore, type InstalledAppInfo } from '@/stores/useAppsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import AppRow from '../AppRow.vue';
import TuiPanel from '../TuiPanel.vue';

const props = defineProps<{ mode: 'favorites' | 'recent' }>();
defineEmits<{ (e: 'menu', app: InstalledAppInfo): void }>();

const appsStore = useAppsStore();
const launchStore = useLaunchStore();
const settings = useSettingsStore();

const apps = computed(() =>
{
    const packages = props.mode === 'favorites' ? settings.favorites : launchStore.recents;
    return packages
        .map(p => appsStore.apps.get(p))
        .filter((a): a is InstalledAppInfo => a !== undefined && !settings.hiddenApps.includes(a.packageName))
        .slice(0, 5);
});
</script>

<template>
    <TuiPanel :title="mode === 'favorites' ? 'FAVORITAS' : 'RECIENTES'">
        <div class="rows">
            <AppRow
                v-for="app in apps"
                :key="app.packageName"
                :app="app"
                :highlighted="false"
                @launch="launchStore.launch(app.packageName, app.label)"
                @menu="$emit('menu', app)" />
            <div v-if="!apps.length" class="hint">
                {{ mode === 'favorites' ? 'MANTÉN UNA APP › FIJAR' : 'SIN ACTIVIDAD' }}
            </div>
        </div>
    </TuiPanel>
</template>

<style scoped lang="scss">
.rows { margin: 0 -8px; }
.hint { padding: 3px 10px; color: var(--ph-dim); }
</style>
