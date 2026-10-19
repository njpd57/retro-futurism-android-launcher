<script setup lang="ts">
import { ref } from 'vue';
import { createBackup, parseBackup, serializeBackup } from '@/utils/backup';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const text = ref('');
const message = ref('');
const area = ref<HTMLTextAreaElement | null>(null);

async function exportBackup()
{
    text.value = serializeBackup(createBackup(localStorage));
    try
    {
        await navigator.clipboard.writeText(text.value);
        message.value = 'COPIADO AL PORTAPAPELES';
    }
    catch
    {
        area.value?.select();
        message.value = 'SELECCIONADO: COPIA A MANO';
    }
}

function importBackup()
{
    const parsed = parseBackup(text.value);
    if (!parsed.ok) { message.value = parsed.error; return; }
    for (const [key, value] of Object.entries(parsed.data)) localStorage.setItem(key, value);
    message.value = `APLICADO · REINICIANDO`;
    window.setTimeout(() => window.location.reload(), 600);
}
</script>

<template>
    <TermMenu title="RESPALDO" @close="emit('close')">
        <div class="hint">AJUSTES, DISPOSICIÓN, NOTAS Y FAVORITOS. NO INCLUYE LA CLAVE NI EL REGISTRO DE MOTHER.</div>
        <textarea ref="area" v-model="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="PEGA AQUÍ UN RESPALDO" />
        <div v-if="message" class="msg">» {{ message }}</div>
        <MenuItem @click="exportBackup"><span>[EXPORTAR]</span></MenuItem>
        <MenuItem @click="importBackup"><span>[APLICAR]</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.hint { color: var(--ph-dim); font-size: 0.85em; padding: 4px 0; }
.msg { padding: 4px 0; }

textarea {
    width: 100%;
    min-height: 6em;
    background: transparent;
    border: 1px solid var(--ph);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
    resize: none;

    &::placeholder { color: var(--ph-dim); }
}
</style>
