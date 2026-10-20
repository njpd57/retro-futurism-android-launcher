<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAppsStore } from '@/stores/useAppsStore';
import { useMotherStore } from '@/stores/useMotherStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUsageStore } from '@/stores/useUsageStore';
import { buildReport, formatDelta, reportLines } from '@/utils/weeklyReport';
import { formatUsage } from '@/utils/usage';
import GaugeBar from '../gauges/GaugeBar.vue';
import Sparkline from '../gauges/Sparkline.vue';

defineProps<{ id: string }>();

const usage = useUsageStore();
const appsStore = useAppsStore();
const mother = useMotherStore();
const settings = useSettingsStore();

onMounted(() => usage.loadHistory());

const labelOf = (pkg: string) => (appsStore.apps.get(pkg)?.label ?? pkg).toUpperCase();
const report = computed(() => usage.history.length ? buildReport(usage.history, appsStore.firstSeen, new Date()) : null);
const max = computed(() => report.value?.top[0]?.ms ?? 1);

// the summary goes to the API only when this is tapped
function comment()
{
    if (!report.value) return;
    const lines = reportLines(report.value, labelOf, formatUsage);
    settings.activeTab = 'mother';
    mother.send(`COMENTA MI INFORME SEMANAL DE USO DEL TELÉFONO:\n${lines.join('\n')}`);
}
</script>

<template>
    <div class="weekly">
        <div v-if="!usage.supported" class="dim">NO DISPONIBLE EN ESTE BRIDGE</div>
        <template v-else-if="!usage.canRead">
            <div class="dim">SIN ACCESO AL USO DE APPS</div>
            <div class="action" @click="usage.requestAccess()">[CONCEDER]</div>
        </template>
        <div v-else-if="!report" class="dim">{{ usage.loadingHistory ? 'CONSULTANDO…' : 'SIN DATOS' }}</div>
        <template v-else>
            <div>7 DÍAS {{ formatUsage(report.totalMs) }}</div>
            <div class="dim delta">{{ formatDelta(report.deltaPct) }}</div>
            <Sparkline :values="report.days.map(d => d.ms)" :min="0" />
            <div class="letters dim"><span v-for="d in report.days" :key="d.day">{{ d.letter }}</span></div>
            <div class="top">
                <div v-for="t in report.top" :key="t.packageName" class="row">
                    <span class="name">{{ labelOf(t.packageName) }}</span>
                    <GaugeBar class="bar" :fraction="t.ms / max" :segments="6" />
                    <span class="time">{{ formatUsage(t.ms) }}</span>
                </div>
            </div>
            <div v-if="report.newApps.length" class="dim news">NUEVAS: {{ report.newApps.map(labelOf).join(', ') }}</div>
            <div class="action comment" @click="comment">[COMENTAR]</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.weekly { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.dim { color: var(--ph-dim); }
.action { padding: 2px 0; &:active { @include inverse; } }
.letters { display: flex; justify-content: space-around; font-size: 0.8em; }
.row { display: flex; align-items: center; gap: 8px; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar { flex: none; width: 3.5em; }
.time { flex: none; min-width: 4.5em; text-align: right; }
.news { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@container (max-height: 200px) { .top, .news, .letters { display: none; } }
@container (max-height: 120px) { .delta, .comment { display: none; } }
</style>
