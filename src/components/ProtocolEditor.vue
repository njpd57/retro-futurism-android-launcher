<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PHOSPHORS, useSettingsStore } from '@/stores/useSettingsStore';
import { useProtocolsStore } from '@/stores/useProtocolsStore';
import { deckIndex } from '@/utils/dashboardLayout';
import { formatDays, formatMinutes, type Condition, type Effect } from '@/protocols/rules';
import MenuItem from './MenuItem.vue';
import TermInput from './TermInput.vue';
import TermMenu from './TermMenu.vue';

const props = defineProps<{ ruleId: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const settings = useSettingsStore();
const protocols = useProtocolsStore();
const rule = computed(() => protocols.rules.find(r => r.id === props.ruleId) ?? null);
// the rule can disappear (deleted here): close
watch(rule, r => { if (!r) emit('close'); });

const name = ref(rule.value?.name ?? '');
const onOff = (v: boolean) => v ? '[X]' : '[ ]';

function setWhen(i: number, c: Condition) { if (rule.value) protocols.update(props.ruleId, { when: rule.value.when.map((x, j) => j === i ? c : x) }); }
function removeWhen(i: number) { if (rule.value) protocols.update(props.ruleId, { when: rule.value.when.filter((_, j) => j !== i) }); }
function addWhen(c: Condition) { if (rule.value) protocols.update(props.ruleId, { when: [...rule.value.when, c] }); }
function setThen(i: number, e: Effect) { if (rule.value) protocols.update(props.ruleId, { then: rule.value.then.map((x, j) => j === i ? e : x) }); }
function removeThen(i: number) { if (rule.value) protocols.update(props.ruleId, { then: rule.value.then.filter((_, j) => j !== i) }); }
function addThen(e: Effect) { if (rule.value) protocols.update(props.ruleId, { then: [...rule.value.then, e] }); }

const HALF_HOUR = 30;
const DAY_OPTIONS: number[][] = [[], [1, 2, 3, 4, 5], [6, 0]];
const nextDays = (days: number[]) => DAY_OPTIONS[(DAY_OPTIONS.findIndex(o => formatDays(o) === formatDays(days)) + 1) % DAY_OPTIONS.length];
const wrapMinutes = (m: number) => (m + 24 * 60) % (24 * 60);

const folderNames = computed(() => Object.keys(settings.folders).sort());
function nextFolder(current: string)
{
    const names = folderNames.value;
    return names.length ? names[(names.indexOf(current) + 1) % names.length] : current;
}
// a rule shows a deck by id; one deleted since falls back to the index it was made with
type PanelEffect = Extract<Effect, { type: 'panel' }>;
const deckAt = (e: PanelEffect) => { const byId = e.deck ? deckIndex(settings.layouts, e.deck) : -1; return byId >= 0 ? byId : Math.min(e.index, settings.layouts.panels.length - 1); };
const deckLabel = (e: PanelEffect) => settings.layouts.names[deckAt(e)];
function nextDeck(e: PanelEffect): PanelEffect
{
    const index = (deckAt(e) + 1) % settings.layouts.panels.length;
    return { type: 'panel', index, deck: settings.layouts.ids[index] };
}
const nextPhosphor = (id: string) => PHOSPHORS[(PHOSPHORS.findIndex(p => p.id === id) + 1) % PHOSPHORS.length].id;

const adding = ref<'when' | 'then' | null>(null);
const CONDITION_CHOICES: { label: string; make: () => Condition }[] = [
    { label: 'HORA Y DÍAS', make: () => ({ type: 'time', from: 22 * 60, to: 7 * 60, days: [] }) },
    { label: 'CARGANDO', make: () => ({ type: 'charging', on: true }) },
    { label: 'BATERÍA BAJA', make: () => ({ type: 'battery', below: 20 }) },
    { label: 'WI-FI', make: () => ({ type: 'wifi', on: true }) },
];
const EFFECT_CHOICES: { label: string; make: () => Effect }[] = [
    { label: 'CAMBIAR DE CUBIERTA', make: () => ({ type: 'panel', index: 0, deck: settings.layouts.ids[0] }) },
    { label: 'CAMBIAR DE FÓSFORO', make: () => ({ type: 'phosphor', phosphor: 'red' }) },
    { label: 'TURNO NOCTURNO', make: () => ({ type: 'nightShift' }) },
    { label: 'OCULTAR UNA CARPETA', make: () => ({ type: 'hideFolder', folder: folderNames.value[0] ?? 'JUEGOS' }) },
    { label: 'RELOJ GRANDE EN REPOSO', make: () => ({ type: 'bigClock' }) },
];

// deleting takes two taps
const deleteArmed = ref(false);
function remove()
{
    if (!deleteArmed.value) { deleteArmed.value = true; return; }
    protocols.remove(props.ruleId);
}
</script>

<template>
    <TermMenu v-if="rule" title="PROTOCOLO" large @close="emit('close')">
        <div class="field"><span>NOMBRE</span><TermInput v-model="name" maxlength="20" @update:model-value="protocols.update(ruleId, { name: $event })" @submit="emit('close')" /></div>
        <MenuItem @click="protocols.update(ruleId, { enabled: !rule.enabled })"><span>ACTIVADO</span><span>{{ onOff(rule.enabled) }}</span></MenuItem>

        <div class="head">SI (TODAS)</div>
        <div v-if="!rule.when.length" class="note">SIN CONDICIONES: NO SE ACTIVA NUNCA.</div>
        <div v-for="(c, i) in rule.when" :key="i" class="block">
            <template v-if="c.type === 'time'">
                <MenuItem><span>DESDE {{ formatMinutes(c.from) }}</span><span><span class="step pressable" @click.stop="setWhen(i, { ...c, from: wrapMinutes(c.from - HALF_HOUR) })">[-]</span> <span class="step pressable" @click.stop="setWhen(i, { ...c, from: wrapMinutes(c.from + HALF_HOUR) })">[+]</span></span></MenuItem>
                <MenuItem><span>HASTA {{ formatMinutes(c.to) }}</span><span><span class="step pressable" @click.stop="setWhen(i, { ...c, to: wrapMinutes(c.to - HALF_HOUR) })">[-]</span> <span class="step pressable" @click.stop="setWhen(i, { ...c, to: wrapMinutes(c.to + HALF_HOUR) })">[+]</span></span></MenuItem>
                <MenuItem @click="setWhen(i, { ...c, days: nextDays(c.days) })"><span>DÍAS</span><span>{{ formatDays(c.days) }}</span></MenuItem>
            </template>
            <MenuItem v-else-if="c.type === 'charging'" @click="setWhen(i, { ...c, on: !c.on })"><span>ENERGÍA</span><span>{{ c.on ? 'CARGANDO' : 'SIN CARGA' }}</span></MenuItem>
            <MenuItem v-else-if="c.type === 'battery'"><span>BATERÍA MENOR DE {{ c.below }}%</span><span><span class="step pressable" @click.stop="setWhen(i, { ...c, below: Math.max(5, c.below - 5) })">[-]</span> <span class="step pressable" @click.stop="setWhen(i, { ...c, below: Math.min(95, c.below + 5) })">[+]</span></span></MenuItem>
            <MenuItem v-else-if="c.type === 'wifi'" @click="setWhen(i, { ...c, on: !c.on })"><span>WI-FI</span><span>{{ c.on ? 'CONECTADO' : 'SIN WI-FI' }}</span></MenuItem>
            <MenuItem @click="removeWhen(i)"><span class="dim">[QUITAR CONDICIÓN]</span></MenuItem>
        </div>
        <MenuItem @click="adding = 'when'"><span>[+] CONDICIÓN</span><span>›</span></MenuItem>

        <div class="head">ENTONCES</div>
        <div v-if="!rule.then.length" class="note">SIN EFECTOS.</div>
        <div v-for="(e, i) in rule.then" :key="i" class="block">
            <MenuItem v-if="e.type === 'panel'" @click="setThen(i, nextDeck(e))"><span>MUESTRA LA CUBIERTA</span><span>{{ deckLabel(e) }}</span></MenuItem>
            <MenuItem v-else-if="e.type === 'phosphor'" @click="setThen(i, { ...e, phosphor: nextPhosphor(e.phosphor) })"><span>FÓSFORO</span><span>{{ PHOSPHORS.find(p => p.id === e.phosphor)?.label }}</span></MenuItem>
            <MenuItem v-else-if="e.type === 'hideFolder'" @click="setThen(i, { ...e, folder: nextFolder(e.folder) })"><span>OCULTA LA CARPETA</span><span>{{ e.folder }}</span></MenuItem>
            <MenuItem v-else-if="e.type === 'nightShift'"><span>TURNO NOCTURNO</span><span>ROJO + MENOS BLOOM</span></MenuItem>
            <MenuItem v-else><span>RELOJ GRANDE EN REPOSO</span><span>2 MIN</span></MenuItem>
            <MenuItem @click="removeThen(i)"><span class="dim">[QUITAR EFECTO]</span></MenuItem>
        </div>
        <MenuItem @click="adding = 'then'"><span>[+] EFECTO</span><span>›</span></MenuItem>

        <MenuItem @click="remove"><span>{{ deleteArmed ? '¿CONFIRMAR? PULSA OTRA VEZ' : '[BORRAR PROTOCOLO]' }}</span></MenuItem>
        <MenuItem @click="emit('close')"><span>LISTO</span><span>ESC</span></MenuItem>

        <TermMenu v-if="adding === 'when'" title="AÑADIR CONDICIÓN" @close="adding = null">
            <MenuItem v-for="c in CONDITION_CHOICES" :key="c.label" @click="addWhen(c.make()); adding = null"><span>{{ c.label }}</span></MenuItem>
        </TermMenu>
        <TermMenu v-if="adding === 'then'" title="AÑADIR EFECTO" @close="adding = null">
            <MenuItem v-for="e in EFFECT_CHOICES" :key="e.label" @click="addThen(e.make()); adding = null"><span>{{ e.label }}</span></MenuItem>
        </TermMenu>
    </TermMenu>
</template>

<style scoped lang="scss">
.field {
    display: flex;
    gap: 10px;
    padding: 4px 10px;

    > :deep(input) { flex: 1; min-width: 0; background: transparent; border: none; border-bottom: 1px solid var(--ph-dim); outline: none; color: inherit; font: inherit; text-shadow: inherit; user-select: text; }
}
.head { padding: 6px 10px 0; @include glow; letter-spacing: 1px; }
.note, .dim { color: var(--ph-dim); padding: 0 10px; }
.block { border-left: 2px solid var(--ph-dim); margin-left: 6px; }
.step { &:active { @include inverse; } }
</style>
