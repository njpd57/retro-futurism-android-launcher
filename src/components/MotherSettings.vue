<script setup lang="ts">
import { ref } from 'vue';
import { maskKey } from '@/mother/chat';
import { useMotherStore } from '@/stores/useMotherStore';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const mother = useMotherStore();

// the key is never shown again after saving: only a masked version
const keyDraft = ref('');
const modelDraft = ref(mother.model);

function save()
{
    if (keyDraft.value.trim()) mother.apiKey = keyDraft.value.trim();
    mother.model = modelDraft.value.trim() || mother.model;
    emit('close');
}
</script>

<template>
    <TermMenu title="MOTHER" @close="emit('close')">
        <div class="field">
            <div class="label">CLAVE API {{ mother.hasKey ? `· ${maskKey(mother.apiKey)}` : '· SIN CONFIGURAR' }}</div>
            <input v-model="keyDraft" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-…" />
        </div>
        <div class="field">
            <div class="label">MODELO</div>
            <input v-model="modelDraft" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" />
        </div>

        <MenuItem @click="save"><span>GUARDAR</span></MenuItem>
        <MenuItem v-if="mother.hasKey" @click="mother.clearKey()"><span>BORRAR CLAVE</span></MenuItem>
        <MenuItem @click="mother.clear()"><span>BORRAR REGISTRO</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.field { padding: 4px 0; }
.label { color: var(--ph-dim); font-size: 0.85em; letter-spacing: 1px; }

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

    &::placeholder { color: var(--ph-dim); }
}
</style>
