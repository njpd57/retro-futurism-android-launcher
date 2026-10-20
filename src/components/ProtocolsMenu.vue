<script setup lang="ts">
import { ref } from 'vue';
import { useProtocolsStore } from '@/stores/useProtocolsStore';
import { describeCondition, describeEffect, MAX_RULES, TEMPLATES } from '@/protocols/rules';
import MenuItem from './MenuItem.vue';
import ProtocolEditor from './ProtocolEditor.vue';
import TermMenu from './TermMenu.vue';

defineEmits<{ (e: 'close'): void }>();

const protocols = useProtocolsStore();
const editing = ref<string | null>(null);

function create(template?: number)
{
    const id = protocols.add(template);
    if (id) editing.value = id;
}

const summary = (id: string) =>
{
    const r = protocols.rules.find(x => x.id === id);
    return r ? `${r.when.map(describeCondition).join(' + ') || 'SIN CONDICIONES'} » ${r.then.map(describeEffect).join(', ') || 'SIN EFECTOS'}` : '';
};
</script>

<template>
    <TermMenu title="PROTOCOLOS DE TURNO" large @close="$emit('close')">
        <div class="note">LOS PROTOCOLOS NO CAMBIAN TUS AJUSTES: SE SUPERPONEN MIENTRAS SE CUMPLEN.</div>

        <div v-for="r in protocols.rules" :key="r.id" class="rule">
            <MenuItem @click="editing = r.id">
                <span><span class="check pressable" @click.stop="protocols.update(r.id, { enabled: !r.enabled })">{{ r.enabled ? '[X]' : '[ ]' }}</span> {{ r.name }}</span>
                <span>{{ protocols.active.includes(r.id) ? 'ACTIVO' : '›' }}</span>
            </MenuItem>
            <div class="summary">{{ summary(r.id) }}</div>
        </div>
        <div v-if="!protocols.rules.length" class="note">SIN PROTOCOLOS. ELIGE UNA PLANTILLA.</div>

        <template v-if="protocols.rules.length < MAX_RULES">
            <div class="note">PLANTILLAS</div>
            <MenuItem v-for="(t, i) in TEMPLATES" :key="t.name" @click="create(i)"><span>[+] {{ t.name }}</span><span>›</span></MenuItem>
            <MenuItem @click="create()"><span>[+] PROTOCOLO VACÍO</span><span>›</span></MenuItem>
        </template>
        <MenuItem @click="$emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>

        <ProtocolEditor v-if="editing" :rule-id="editing" @close="editing = null" />
    </TermMenu>
</template>

<style scoped lang="scss">
.note { padding: 4px 10px; color: var(--ph-dim); }
.summary { padding: 0 10px 4px 36px; color: var(--ph-dim); font-size: 0.8em; }
.check { &:active { @include inverse; } }
</style>
