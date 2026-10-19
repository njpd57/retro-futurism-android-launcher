<script setup lang="ts">
import { computed } from 'vue';
import { useLocalStorage, useNow } from '@vueuse/core';
import { useShipSnapshot } from '@/composables/useShipSnapshot';
import { dayKey, shiftReport } from '@/mother/local';
import { useMotherStore } from '@/stores/useMotherStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

const props = defineProps<{ id: string }>();

const mother = useMotherStore();
const settings = useSettingsStore();
const snapshot = useShipSnapshot();

// the first time the panel is seen each day it shows the shift report instead of the last answer
const now = useNow({ interval: 60_000 });
const seenDay = useLocalStorage(`widget.mother.${props.id}.shiftDay`, '');
const showReport = computed(() => seenDay.value !== dayKey(now.value));
const report = computed(() => shiftReport(snapshot(now.value)));

function onClick()
{
    if (showReport.value) seenDay.value = dayKey(now.value);
    else settings.activeTab = 'mother';
}
</script>

<template>
    <div class="mother-widget" @click="onClick">
        <template v-if="showReport">
            <div v-for="line in report" :key="line" class="line">{{ line }}</div>
            <div class="dim">TOCA PARA ENTERADO ›</div>
        </template>
        <template v-else>
            <div v-if="mother.lastAnswer" class="answer">MOTHER: {{ mother.lastAnswer }}</div>
            <div v-else class="dim">{{ mother.hasKey ? 'ESPERANDO CONSULTA' : 'CLAVE API NO CONFIGURADA' }}</div>
            <div class="dim">TOCA PARA ABRIR TERMINAL ›</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.line { white-space: pre-wrap; }
.answer {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    text-transform: uppercase;
}
</style>
