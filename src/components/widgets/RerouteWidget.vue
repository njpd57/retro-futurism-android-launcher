<script setup lang="ts">
import { ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { MAX_LEVEL, POWER, SYSTEMS, adjust, freePower, newGame, score, step, type RerouteState } from '@/games/reroute';
import { useSoundStore } from '@/stores/useSoundStore';
import { bar } from '@/utils/tui';

defineProps<{ id: string }>();

const sound = useSoundStore();
const best = useLocalStorage('widget.reroute.best', 0);

const state = ref<RerouteState>(newGame(Math.random));
const started = ref(false);

const TICK_MS = 250;
let last = 0;

const loop = usePausableInterval(() =>
{
    const now = performance.now();
    // after a pause the elapsed time is capped, so the game doesn't punish leaving the launcher
    const dt = Math.min(now - last, 500);
    last = now;

    const result = step(state.value, dt, Math.random);
    state.value = result.state;
    if (result.events.includes('demand')) sound.playAlways('ping');
    if (result.events.includes('lost'))
    {
        loop.stop();
        sound.playAlways('alert');
        best.value = Math.max(best.value, score(result.state));
    }
}, TICK_MS);

function start()
{
    state.value = newGame(Math.random);
    started.value = true;
    last = performance.now();
    loop.start();
}

const give = (i: number, d: 1 | -1) => { state.value = adjust(state.value, i, d); };
const levelBar = (n: number) => bar(n / MAX_LEVEL, MAX_LEVEL);
</script>

<template>
    <div>
        <template v-if="!started">
            <div class="dim">REPARTE {{ POWER }} UNIDADES DE ENERGÍA. CADA SISTEMA PIDE LO SUYO Y CAMBIA SIN AVISO.</div>
            <div class="action pressable" @click="start">[INICIAR]</div>
            <div v-if="best" class="dim">MEJOR: {{ best }} S</div>
        </template>

        <template v-else>
            <div class="head">
                <span>REENRUTAR · LIBRE {{ freePower(state) }}</span>
                <span>{{ score(state) }} S</span>
            </div>
            <div v-for="(name, i) in SYSTEMS" :key="name" class="sys" :class="{ short: state.need[i] > state.alloc[i], failing: state.integrity[i] < 35 }">
                <div class="name">
                    <span>{{ name }}</span>
                    <span>{{ Math.round(state.integrity[i]) }}%</span>
                </div>
                <div class="ctl">
                    <span class="btn pressable" @click="give(i, -1)">[-]</span>
                    <span class="lvl">{{ levelBar(state.alloc[i]) }}</span>
                    <span class="btn pressable" @click="give(i, 1)">[+]</span>
                    <span class="need">PIDE {{ levelBar(state.need[i]) }}</span>
                </div>
            </div>
            <template v-if="state.phase === 'lost'">
                <div class="lost">FALLO DE SISTEMA · {{ score(state) }} S</div>
                <div class="dim">MEJOR: {{ best }} S</div>
                <div class="action pressable" @click="start">[REINICIAR]</div>
            </template>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.head { display: flex; justify-content: space-between; color: var(--ph-dim); }
.sys { padding: 2px 0; &.short .need { animation: blink 0.8s steps(2) infinite; } &.failing .name { animation: blink 0.5s steps(2) infinite; } }
.name { display: flex; justify-content: space-between; }
.ctl { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.btn { padding: 0 4px; &:active { @include inverse; } }
.need { color: var(--ph-dim); margin-left: auto; }
.lost { padding-top: 4px; animation: blink 0.8s steps(2) infinite; }
.action { padding: 2px 0; &:active { @include inverse; } }

@keyframes blink { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .sys.short .need, .sys.failing .name, .lost { animation: none; } }
</style>
