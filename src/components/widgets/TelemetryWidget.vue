<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import TermInput from '../TermInput.vue';
import { usePausableInterval } from '@/composables/usePausableInterval';
import { DEFAULT_HOST, latencyStats, normalizeHost, pushSample, TIMEOUT_MS, type Sample } from '@/utils/telemetry';
import Sparkline from '../gauges/Sparkline.vue';

const props = defineProps<{ id: string }>();

const host = useLocalStorage(`widget.telemetry.${props.id}`, DEFAULT_HOST);
const history = ref<Sample[]>([]);
const stats = computed(() => latencyStats(history.value));

const editing = ref(false);
const draft = ref('');
const bad = ref(false);

async function probe()
{
    const started = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try
    {
        // no-cors: the response is opaque, only the round trip time matters
        await fetch(host.value, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
        history.value = pushSample(history.value, Math.round(performance.now() - started));
    }
    catch
    {
        history.value = pushSample(history.value, null);
    }
    finally
    {
        window.clearTimeout(timeout);
    }
}

const loop = usePausableInterval(probe, 10_000);
onMounted(() => { probe(); loop.start(); });

function edit()
{
    draft.value = host.value;
    bad.value = false;
    editing.value = true;
}

function save()
{
    const url = normalizeHost(draft.value);
    if (!url) { bad.value = true; return; }
    host.value = url;
    history.value = [];
    editing.value = false;
    probe();
}

const hostLabel = computed(() => { try { return new URL(host.value).hostname.toUpperCase(); } catch { return host.value; } });
</script>

<template>
    <div>
        <template v-if="editing">
            <div class="dim">HOST A MEDIR</div>
            <TermInput v-model="draft" @submit="save" />
            <div v-if="bad" class="dim">HOST NO VÁLIDO</div>
            <span class="action pressable" @click="save">[FIJAR]</span>
            <span class="action pressable" @click="editing = false">[ANULAR]</span>
        </template>
        <template v-else>
            <div class="dim pressable" @click="edit">{{ hostLabel }} ›</div>
            <div class="big">{{ stats.last === null ? (history.length ? 'PERDIDO' : '…') : `${stats.last} MS` }}</div>
            <Sparkline v-if="history.length > 1" :values="history" :min="0" :max="TIMEOUT_MS" />
            <div class="dim">MED {{ stats.avg ?? '--' }} · MÁX {{ stats.max ?? '--' }} · PÉRD {{ stats.lossPct }}%</div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.dim { color: var(--ph-dim); }
.big { font-size: 1.4em; line-height: 1.1; }
.action { display: inline-block; padding: 2px 8px 2px 0; &:active { @include inverse; } }

input {
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--ph-dim);
    outline: none;
    color: inherit;
    font: inherit;
    text-shadow: inherit;
    user-select: text;
}
</style>
