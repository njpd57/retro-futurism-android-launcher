<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useLaunchStore } from '@/stores/useLaunchStore';
import { useLogStore } from '@/stores/useLogStore';
import { useQuarantineStore } from '@/stores/useQuarantineStore';
import { budgetLine, budgetState, canAuthorize, cleanReason, countdownLeft, MAX_REASON } from '@/utils/quarantine';
import GaugeBar from './gauges/GaugeBar.vue';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const quarantine = useQuarantineStore();
const launch = useLaunchStore();
const log = useLogStore();

const reason = ref('');
const now = ref(Date.now());
const timer = window.setInterval(() => { now.value = Date.now(); }, 250);
onBeforeUnmount(() => window.clearInterval(timer));

const pending = computed(() => quarantine.pending);
const budgetMin = computed(() => pending.value ? quarantine.budgetOf(pending.value.packageName) : 0);
const usedMs = computed(() => pending.value ? quarantine.usedMs(pending.value.packageName) : 0);
const state = computed(() => budgetState(usedMs.value, budgetMin.value));
const left = computed(() => pending.value ? countdownLeft(pending.value.startedAt, now.value) : 0);
const ready = computed(() => pending.value ? canAuthorize(pending.value.startedAt, now.value, reason.value) : false);

function authorize()
{
    const p = pending.value;
    if (!p || !ready.value) return;
    log.push('QRT', `${p.label.toUpperCase()} AUTORIZADO · MOTIVO: ${cleanReason(reason.value).toUpperCase()}`);
    quarantine.cancel();
    launch.launchNow(p.packageName, p.label);
}
</script>

<template>
    <TermMenu v-if="pending" title="AUTORIZACIÓN REQUERIDA" @close="quarantine.cancel()">
        <div class="line">APP EN CUARENTENA</div>
        <div class="line" :class="{ alert: state.exceeded }">{{ budgetLine(pending.label, usedMs, budgetMin) }}</div>
        <div v-if="budgetMin" class="line"><GaugeBar :fraction="state.fraction" :segments="16" /></div>
        <div class="field">
            <span>MOTIVO:</span>
            <TermInput v-model="reason" :maxlength="MAX_REASON" @submit="authorize" />
        </div>
        <div class="line dim">{{ left > 0 ? `ESPERA ${left} S` : reason.trim() ? 'LISTO' : 'ESCRIBE UN MOTIVO' }}</div>
        <div class="actions">
            <span class="btn pressable" :class="{ off: !ready }" @click="authorize">[AUTORIZAR]</span>
            <span class="btn pressable" @click="quarantine.cancel()">[CANCELAR]</span>
        </div>
    </TermMenu>
</template>

<style scoped lang="scss">
.line { padding: 3px 10px; }
.alert { font-weight: bold; }
.dim { color: var(--ph-dim); }
.field {
    display: flex;
    gap: 10px;
    padding: 4px 10px;

    > :deep(input) { flex: 1; min-width: 0; background: transparent; border: none; border-bottom: 1px solid var(--ph-dim); outline: none; color: inherit; font: inherit; text-shadow: inherit; user-select: text; }
}
.actions { display: flex; gap: 16px; padding: 6px 10px; }
.btn { &:active { @include inverse; } &.off { color: var(--ph-dim); } }
</style>
