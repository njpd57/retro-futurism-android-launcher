<script setup lang="ts">
import { computed } from 'vue';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useAnimStore } from '@/stores/useAnimStore';

const store = useAlertsStore();
const anim = useAnimStore();
const first = computed(() => store.alerts[0] ?? null);
const more = computed(() => store.alerts.length - 1);
</script>

<template>
    <div v-if="first" :key="first.id" class="alert-strip pressable" :class="{ critical: first.kind === 'battery', glitch: anim.transitions }" @click="store.dismiss(first)">
        <span class="text">! {{ first.text }}</span>
        <span v-if="more > 0" class="more">+{{ more }}</span>
        <span class="close">[X]</span>
    </div>
</template>

<style scoped lang="scss">
.alert-strip {
    @include inverse;
    display: flex;
    gap: 8px;
    padding: 2px 10px;
    flex: none;
    white-space: nowrap;
    font-weight: bold;
    // a new alert glitches sideways once; a critical one (battery) glitches again every few seconds
    animation: strip-blink 1.2s steps(1) infinite;
    &.glitch { animation: strip-blink 1.2s steps(1) infinite, strip-glitch 0.4s linear; }
    &.glitch.critical { animation: strip-blink 1.2s steps(1) infinite, strip-glitch-loop 6s linear infinite; }

    > .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
}

@keyframes strip-blink { 50% { opacity: 0.6; } }

@keyframes strip-glitch {
    0% { transform: translateX(0); }
    12% { transform: translateX(-9px) skewX(-6deg); }
    24% { transform: translateX(7px) skewX(4deg); }
    36% { transform: translateX(-4px); }
    48% { transform: translateX(10px) skewX(-3deg); }
    60% { transform: translateX(-2px); }
    100% { transform: none; }
}

@keyframes strip-glitch-loop {
    0% { transform: translateX(0); }
    1% { transform: translateX(-9px) skewX(-6deg); }
    2% { transform: translateX(7px) skewX(4deg); }
    3% { transform: translateX(-4px); }
    4% { transform: translateX(10px) skewX(-3deg); }
    5%, 100% { transform: none; }
}

@media (prefers-reduced-motion: reduce) { .alert-strip, .alert-strip.glitch, .alert-strip.glitch.critical { animation: none; } }
</style>
