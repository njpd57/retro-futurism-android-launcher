<script setup lang="ts">
import { ref } from 'vue';
import { useMotherStore } from '@/stores/useMotherStore';
import { sessionToText, type Session } from '@/mother/sessions';
import { formatClock, formatDateTui } from '@/utils/tui';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const mother = useMotherStore();
const selected = ref<Session | null>(null);
const exported = ref('');
const area = ref<HTMLTextAreaElement | null>(null);
const message = ref('');

const stamp = (s: Session) => `${formatDateTui(new Date(s.at))} ${formatClock(new Date(s.at))}`;

function newSession()
{
    mother.newSession();
    emit('close');
}

function restore()
{
    if (selected.value) mother.restore(selected.value.id);
    emit('close');
}

async function exportText()
{
    if (!selected.value) return;
    exported.value = sessionToText(selected.value);
    try
    {
        await navigator.clipboard.writeText(exported.value);
        message.value = 'COPIADO AL PORTAPAPELES';
    }
    catch
    {
        area.value?.select();
        message.value = 'SELECCIONADO: COPIA A MANO';
    }
}

function remove()
{
    if (selected.value) mother.deleteSession(selected.value.id);
    selected.value = null;
    exported.value = '';
}
</script>

<template>
    <TermMenu v-if="!selected" title="SESIONES" @close="emit('close')">
        <MenuItem @click="newSession"><span>[NUEVA SESIÓN]</span><span>ARCHIVA LA ACTUAL</span></MenuItem>
        <div v-if="!mother.sessions.length" class="dim">SIN SESIONES GUARDADAS</div>
        <MenuItem v-for="s in mother.sessions" :key="s.id" @click="selected = s">
            <span>{{ s.title }}</span><span class="dim">{{ stamp(s) }}</span>
        </MenuItem>
    </TermMenu>

    <TermMenu v-else :title="selected.title" @close="selected = null; exported = ''; message = ''">
        <MenuItem @click="restore"><span>[RECUPERAR]</span></MenuItem>
        <MenuItem @click="exportText"><span>[EXPORTAR COMO TEXTO]</span></MenuItem>
        <MenuItem @click="remove"><span>[BORRAR]</span></MenuItem>
        <div v-if="message" class="dim">» {{ message }}</div>
        <textarea v-if="exported" ref="area" :value="exported" readonly />
    </TermMenu>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); font-size: 0.85em; padding: 2px 0; }

textarea {
    width: 100%;
    min-height: 8em;
    background: transparent;
    border: 1px solid var(--ph);
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
    resize: none;
    outline: none;
}
</style>
