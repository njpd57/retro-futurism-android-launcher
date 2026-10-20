<script setup lang="ts">
import { computed } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useUsageStore } from '@/stores/useUsageStore';
import GaugeBar from '../gauges/GaugeBar.vue';
import { formatUsage, topUsage, totalUsageMs } from '@/utils/usage';

const usage = useUsageStore();
const appsStore = useAppsStore();
const launchStore = useLaunchStore();

const top = computed(() => topUsage(usage.apps, 5));
const max = computed(() => top.value[0]?.totalTimeMs ?? 1);
const total = computed(() => totalUsageMs(usage.apps));

const labelOf = (pkg: string) => (appsStore.apps.get(pkg)?.label ?? pkg).toUpperCase();
</script>

<template>
    <div>
        <div v-if="!usage.supported" class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        <template v-else-if="!usage.canRead">
            <div class="dim">SIN ACCESO AL USO DE APPS</div>
            <div class="action" @click="usage.requestAccess()">[CONCEDER]</div>
        </template>
        <template v-else>
            <div class="dim">HOY {{ formatUsage(total) }}</div>
            <div v-for="a in top" :key="a.packageName" class="row" @click="launchStore.launch(a.packageName, labelOf(a.packageName))">
                <span class="name">{{ labelOf(a.packageName) }}</span>
                <GaugeBar class="bar" :fraction="a.totalTimeMs / max" :segments="8" />
                <span class="time">{{ formatUsage(a.totalTimeMs) }}</span>
            </div>
            <div v-if="!top.length" class="dim">SIN DATOS TODAVÍA</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.action { padding: 2px 0; &:active { @include inverse; } }
.row { display: flex; align-items: center; gap: 8px; &:active { @include inverse; } }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar { flex: none; width: 4.5em; }
.time { flex: none; min-width: 4.5em; text-align: right; }
</style>
