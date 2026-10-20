<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { prefersReducedMotion } from '@/composables/useReducedMotion';
import { idlePosition } from '@/utils/idle';
import { heartbeatLine, podTemp, vitals, wakeCountdown } from '@/utils/stasis';

const props = defineProps<{ wakeAt: number }>();
defineEmits<{ (e: 'wake'): void }>();

const TRACE_COLUMNS = 22;
const closedAt = Date.now();

// 250 ms steps for the trace; with reduced motion it ticks once a second and the trace stays still
const reduced = prefersReducedMotion();
const now = ref(Date.now());
const loop = usePausableInterval(() => { now.value = Date.now(); }, reduced ? 1000 : 250);
onMounted(() => { now.value = Date.now(); loop.start(); });

const vital = computed(() => vitals(now.value));
const trace = computed(() => heartbeatLine(reduced ? closedAt : now.value, vital.value.bpm, TRACE_COLUMNS));
const countdown = computed(() => wakeCountdown(now.value, props.wakeAt));
const temp = computed(() => podTemp(now.value, closedAt).toFixed(1).replace('.', ','));
// same anti burn-in drift as the plain idle clock; the block is tall, so it moves in a smaller band
const pos = computed(() => idlePosition(new Date(now.value)));
</script>

<template>
    <div class="pod" @click="$emit('wake')">
        <div class="block" :style="{ left: `${pos.x}%`, top: `${pos.y * 0.6}%` }">
            <div class="dim">HIPERSUEÑO · CÁPSULA 07</div>
            <div class="state">TRIPULANTE EN ESTASIS</div>
            <div class="wake">{{ countdown }}</div>
            <div class="dim">HASTA EL DESPERTAR</div>
            <div class="vitals">
                <div>PULSO {{ vital.bpm }} <span class="trace">{{ trace }}</span></div>
                <div>RESP {{ vital.resp }}/MIN</div>
                <div>CÁPSULA {{ temp }}°C</div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.pod {
    position: absolute;
    inset: 0;
    z-index: 60;
    background: var(--ph-bg);
    // a resting tube, like the idle clock
    --bloom: 0.25;

    > .block {
        position: absolute;
        opacity: 0.6;
        white-space: nowrap;
    }

    .state { @include glow; }
    .wake { font-size: 3.2rem; line-height: 1; @include glow; }
    .dim { color: var(--ph-dim); }
    .vitals { margin-top: 8px; }
    .trace { letter-spacing: 0; }
}
</style>
