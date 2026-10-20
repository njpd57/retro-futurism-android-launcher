<script setup lang="ts">
import { computed } from 'vue';
import type { InstalledAppInfo } from '@/stores/useAppsStore';
import { useQuarantineStore } from '@/stores/useQuarantineStore';
import { stepBudget } from '@/utils/quarantine';
import MenuItem from './MenuItem.vue';
import TermMenu from './TermMenu.vue';

const props = defineProps<{ app: InstalledAppInfo }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const quarantine = useQuarantineStore();
const on = computed(() => quarantine.has(props.app.packageName));
const budget = computed(() => quarantine.budgetOf(props.app.packageName));
const pkg = () => props.app.packageName;
</script>

<template>
    <TermMenu title="CUARENTENA" @close="emit('close')">
        <div class="line">{{ app.label.toUpperCase() }}</div>
        <div class="line dim">{{ on ? 'ABRIRLA PIDE AUTORIZACIÓN Y UN MOTIVO, CON 10 S DE ESPERA.' : 'MARCA LA APP COMO CONTAMINADA: ABRIRLA PEDIRÁ AUTORIZACIÓN.' }}</div>
        <template v-if="on">
            <MenuItem>
                <span>PRESUPUESTO {{ budget ? `${budget} MIN/DÍA` : 'SIN PRESUPUESTO' }}</span>
                <span><span class="step pressable" @click.stop="quarantine.set(pkg(), stepBudget(budget, -1))">[-]</span> <span class="step pressable" @click.stop="quarantine.set(pkg(), stepBudget(budget, 1))">[+]</span></span>
            </MenuItem>
            <MenuItem @click="quarantine.release(pkg()); emit('close')"><span>[LIBERAR]</span></MenuItem>
        </template>
        <MenuItem v-else @click="quarantine.set(pkg()); emit('close')"><span>[PONER EN CUARENTENA]</span></MenuItem>
        <MenuItem @click="emit('close')"><span>CERRAR</span><span>ESC</span></MenuItem>
    </TermMenu>
</template>

<style scoped lang="scss">
.line { padding: 3px 10px; }
.dim { color: var(--ph-dim); }
.step { &:active { @include inverse; } }
</style>
