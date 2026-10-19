<script setup lang="ts">
import { computed, ref } from 'vue';
import { maskKey, MODEL_PRESETS } from '@/mother/chat';
import { useShipSnapshot } from '@/composables/useShipSnapshot';
import { contextBlock } from '@/mother/local';
import { useSpeechStore } from '@/stores/useSpeechStore';
import { useMotherStore } from '@/stores/useMotherStore';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const emit = defineEmits<{ (e: 'close'): void }>();

const mother = useMotherStore();
const snapshot = useShipSnapshot();
const onOff = (v: boolean) => v ? '[X]' : '[ ]';
const preview = computed(() => contextBlock(snapshot()));
const speech = useSpeechStore();

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

        <div class="presets">
            <span v-for="m in MODEL_PRESETS" :key="m" class="preset pressable" :class="{ on: modelDraft === m }" @click="modelDraft = m">{{ m }}</span>
        </div>
        <div class="dim">TOKENS ESTA SESIÓN: {{ mother.tokens.prompt }} ENTRADA · {{ mother.tokens.completion }} SALIDA</div>

        <MenuItem @click="mother.useContext = !mother.useContext"><span>CONTEXTO DE A BORDO</span><span>{{ onOff(mother.useContext) }}</span></MenuItem>
        <div class="dim notice">
            <template v-if="mother.useContext">CADA CONSULTA ENVÍA A LA API LOS DATOS DE ABAJO:<pre>{{ preview }}</pre></template>
            <template v-else>SOLO SE ENVÍA TU TEXTO.</template>
        </div>
        <MenuItem @click="mother.actionsEnabled = !mother.actionsEnabled"><span>ACCIONES (CON CONFIRMACIÓN)</span><span>{{ onOff(mother.actionsEnabled) }}</span></MenuItem>
        <MenuItem @click="speech.available && (mother.voice = !mother.voice)"><span>VOZ</span><span>{{ speech.available ? onOff(mother.voice) : 'NO DISPONIBLE' }}</span></MenuItem>
        <div class="dim">{{ speech.message }} · VER AJUSTES › PERMISOS</div>

        <MenuItem @click="save"><span>GUARDAR</span></MenuItem>
        <MenuItem v-if="mother.hasKey" @click="mother.clearKey()"><span>BORRAR CLAVE</span></MenuItem>
        <MenuItem @click="mother.clear()"><span>BORRAR REGISTRO</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.field { padding: 4px 0; }
.dim { color: var(--ph-dim); font-size: 0.85em; padding: 2px 0; }
.notice pre { margin: 2px 0 0; white-space: pre-wrap; font: inherit; }
.presets { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0; }
.preset { padding: 0 6px; border: 1px solid var(--ph); font-size: 0.85em; &.on, &:active { @include inverse; } }
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
