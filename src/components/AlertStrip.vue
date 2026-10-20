<script setup lang="ts">
import { computed } from 'vue';
import { useAlertsStore } from '@/stores/useAlertsStore';

const store = useAlertsStore();
const first = computed(() => store.alerts[0] ?? null);
const more = computed(() => store.alerts.length - 1);
</script>

<template>
    <div v-if="first" class="alert-strip pressable" @click="store.dismiss(first)">
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
    animation: strip-blink 1.2s steps(1) infinite;

    > .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
}

@keyframes strip-blink { 50% { opacity: 0.6; } }
@media (prefers-reduced-motion: reduce) { .alert-strip { animation: none; } }
</style>
