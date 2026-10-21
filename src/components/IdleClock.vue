<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { formatClock, formatDateTui } from '@/utils/tui';
import { idlePosition } from '@/utils/idle';
import { useAnimStore } from '@/stores/useAnimStore';

const anim = useAnimStore();
// one period of a slow heartbeat trace, 12 characters: the strip below repeats it and slides one period at a time
const WAVE = '▁▁▁▂▁▁▃▇▂▁▁▁'.repeat(4);

defineEmits<{ (e: 'wake'): void }>();

const now = useNow({ interval: 1000 });
const pos = computed(() => idlePosition(now.value));
</script>

<template>
    <div class="idle" @click="$emit('wake')">
        <div class="clock" :style="{ left: `${pos.x}%`, top: `${pos.y}%` }">
            <div class="time">{{ formatClock(now) }}</div>
            <div class="date">{{ formatDateTui(now) }}</div>
            <div v-if="anim.ambient" class="wave" aria-hidden="true"><span>{{ WAVE }}</span></div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.idle {
    position: absolute;
    inset: 0;
    z-index: 60;
    background: var(--ph-bg);
    // dimmed: the whole screen is a resting tube
    --bloom: 0.25;

    > .clock {
        position: absolute;
        opacity: 0.55;
        transition: none;
    }
    .time { font-size: 4.5rem; line-height: 1; @include glow; }
    .date { color: var(--ph-dim); }

    // monospaced font: a period is exactly 12ch, so sliding by 12ch loops without a seam
    .wave {
        width: 24ch;
        overflow: hidden;
        margin-top: 0.3em;
        white-space: nowrap;
        > span { display: inline-block; animation: wave 5s linear infinite; }
    }
}

@keyframes wave {
    from { transform: translateX(0); }
    to { transform: translateX(-12ch); }
}

@media (prefers-reduced-motion: reduce) {
    .idle .wave > span { animation: none; }
}
</style>
