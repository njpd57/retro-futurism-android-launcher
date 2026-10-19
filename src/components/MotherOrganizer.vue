<script setup lang="ts">
import { ref } from 'vue';
import { useMotherStore } from '@/stores/useMotherStore';
import { useOrganizerStore } from '@/stores/useOrganizerStore';
import { ORGANIZE_EXAMPLES } from '@/utils/commandRegistry';
import MenuItem from './MenuItem.vue';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const mother = useMotherStore();
const organizer = useOrganizerStore();

const draft = ref(organizer.request);
const run = (text: string) => { draft.value = text; organizer.run(text); };
</script>

<template>
    <TermMenu title="MOTHER · ORGANIZAR APPS" @close="organizer.close()">
        <template v-if="organizer.phase === 'ask' || organizer.phase === 'error'">
            <div class="dim">DILE A MOTHER CÓMO ORDENAR TUS APPS. SE ENVÍAN A LA API SOLO LOS NOMBRES, NUMERADOS. NADA CAMBIA SIN TU [APLICAR].</div>
            <div v-if="!mother.hasKey" class="error">CLAVE API NO CONFIGURADA: AJUSTES › MOTHER</div>
            <TermInput v-model="draft" enterkeyhint="go" placeholder="p. ej. agrupa por tipo" @submit="run" />
            <div class="chips">
                <span v-for="e in ORGANIZE_EXAMPLES" :key="e" class="chip pressable" @click="run(e)">{{ e.toUpperCase() }}</span>
            </div>
            <div v-if="organizer.error" class="error">» {{ organizer.error }}</div>
            <MenuItem @click="run(draft)"><span>[ENVIAR A MOTHER]</span></MenuItem>
            <MenuItem v-if="organizer.canUndo" @click="organizer.undo()"><span>[DESHACER LO ÚLTIMO]</span></MenuItem>
        </template>

        <template v-else-if="organizer.phase === 'thinking'">
            <div class="processing">MOTHER ESTÁ PROCESANDO</div>
            <MenuItem @click="organizer.abort()"><span>[ANULAR]</span></MenuItem>
        </template>

        <template v-else-if="organizer.phase === 'preview'">
            <div class="dim">PROPUESTA PARA: {{ organizer.request.toUpperCase() }}</div>
            <div v-for="line in organizer.lines" :key="line" class="line">» {{ line }}</div>
            <MenuItem @click="organizer.apply()"><span>[APLICAR]</span></MenuItem>
            <MenuItem @click="organizer.close()"><span>[ANULAR]</span></MenuItem>
        </template>

        <template v-else>
            <div>PROPUESTA APLICADA. LAS CARPETAS ESTÁN EN APPS.</div>
            <MenuItem @click="organizer.undo()"><span>[DESHACER]</span></MenuItem>
            <MenuItem @click="organizer.close()"><span>[CERRAR]</span></MenuItem>
        </template>
    </TermMenu>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); font-size: 0.85em; padding: 2px 0 6px; }
.error { padding: 4px 0; animation: blink 1.2s steps(2) infinite; }
.line { padding: 1px 0; word-break: break-word; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 0; font-size: 0.85em; }
.chip { padding: 0 6px; border: 1px solid var(--ph-dim); color: var(--ph-dim); &:active { @include inverse; } }
.processing::after { content: ''; animation: dots 1.2s steps(4) infinite; }

@keyframes blink { 50% { opacity: 0.5; } }
@keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
@media (prefers-reduced-motion: reduce) { .error, .processing::after { animation: none; } }
</style>
