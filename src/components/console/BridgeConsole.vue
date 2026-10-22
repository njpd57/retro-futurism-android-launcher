<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useAlarmStore } from '@/stores/useAlarmStore';
import { useBridgeConsoleStore } from '@/stores/useBridgeConsoleStore';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { fitLamps, type LampId, type TickerTarget } from '@/utils/bridgeConsole';
import { cameraGap, cutoutSpan } from '@/utils/statusBar';
import Annunciator from './Annunciator.vue';
import MotherEye from './MotherEye.vue';
import Teletype from './Teletype.vue';
import TelemetryRotor from './TelemetryRotor.vue';

// The bridge console, our status bar. Line 1 sits in the status bar inset, split by the camera:
// telemetry on the left, MOTHER's eye around the camera, the annunciator lamps on the right.
// Line 2 is MOTHER's teletype.
defineProps<{ deckHeight: number }>();
const emit = defineEmits<{ (e: 'open'): void; (e: 'mother'): void }>();

const CHAR_PX = 7;

const console$ = useBridgeConsoleStore();
const settings = useSettingsStore();
const alarm = useAlarmStore();
const calendar = useCalendarStore();
const bridgeEvents = useBridgeEventStore();

const deck = ref<HTMLElement | null>(null);
const { width } = useElementSize(deck);

const cutoutPath = ref<string | null>(null);
function readCutout()
{
    const bridge = Bridge as unknown as { getDisplayCutoutPath?: () => unknown };
    try
    {
        const path = typeof bridge.getDisplayCutoutPath === 'function' ? bridge.getDisplayCutoutPath() : null;
        cutoutPath.value = typeof path === 'string' ? path : null;
    }
    catch (err)
    {
        console.error(err);
        cutoutPath.value = null;
    }
}
onMounted(readCutout);
bridgeEvents.addEventListener(ev => { if (ev.name === 'afterResume') readCutout(); });

const gap = computed(() => cameraGap(settings.cameraWidth / 100, cutoutSpan(cutoutPath.value, window.innerWidth)));

const lamps = computed(() => fitLamps(console$.lamps, Math.floor(width.value * (1 - gap.value) / 2 / CHAR_PX) - 1));

// a tapped lamp: MSG opens the signals, the others put their message first on the tape
const restart = ref(0);
function pressLamp(id: LampId)
{
    if (id === 'MSG') { emit('open'); return; }
    console$.focus = id;
    restart.value++;
}

function openTelemetry()
{
    if (alarm.supported) alarm.openAlarms();
    else emit('mother');
}

function openTarget(t: TickerTarget)
{
    if (t.kind === 'notifications') emit('open');
    else if (t.kind === 'alarms') openTelemetry();
    else if (t.kind === 'event')
    {
        const ev = calendar.events.find(e => e.eventId === t.id);
        if (ev) calendar.openEvent(ev);
    }
    else emit('mother');
}
</script>

<template>
    <div class="bridge-console">
        <div ref="deck" class="deck" :style="{ height: `${deckHeight}px`, '--gap': `${gap * 100}%` }">
            <TelemetryRotor :weather="console$.weatherLine" :storage="console$.storageLine" :stress="console$.alert" />
            <MotherEye :busy="console$.busy" :alert="console$.alert" :pulse="console$.pulse" @open="emit('mother')" />
            <Annunciator class="lamps" :lamps="lamps" @press="pressLamp" />
        </div>
        <Teletype
            v-if="settings.ticker"
            :messages="console$.queue"
            :restart="restart"
            @target="openTarget"
            @pass="console$.nextPass()" />
    </div>
</template>

<style scoped lang="scss">
.bridge-console {
    flex: none;
    font-size: 0.8em;
    white-space: nowrap;
}

.deck {
    display: grid;
    grid-template-columns: 1fr var(--gap) 1fr;
    align-items: center;
    padding: 0 10px;
    border-bottom: 1px solid var(--ph-dim);

    .lamps { justify-content: flex-end; min-width: 0; overflow: hidden; }
}
</style>
