<script setup lang="ts">
import { useMotherStore } from '@/stores/useMotherStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

const mother = useMotherStore();
const settings = useSettingsStore();
</script>

<template>
    <div class="mother-widget" @click="settings.activeTab = 'mother'">
        <div v-if="mother.lastAnswer" class="answer">MOTHER: {{ mother.lastAnswer }}</div>
        <div v-else class="dim">{{ mother.hasKey ? 'ESPERANDO CONSULTA' : 'CLAVE API NO CONFIGURADA' }}</div>
        <div class="dim">TOCA PARA ABRIR TERMINAL ›</div>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.answer {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    text-transform: uppercase;
}
</style>
