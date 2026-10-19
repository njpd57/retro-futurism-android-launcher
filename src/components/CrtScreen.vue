<script setup lang="ts">
import { computed } from 'vue';
import { useNow } from '@vueuse/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { tick } from '@/utils/haptics';
import { isNight, NIGHT_MAX_BLOOM } from '@/utils/nightShift';

const settings = useSettingsStore();
const sound = useSoundStore();

// night shift: red phosphor and less bloom by schedule, without touching the user's own choice
const now = useNow({ interval: 60_000 });
const night = computed(() => settings.nightShift && isNight(now.value));
const phosphor = computed(() => night.value ? 'red' : settings.phosphor);
const bloom = computed(() => night.value ? Math.min(settings.bloom, NIGHT_MAX_BLOOM) : settings.bloom);

// one delegated listener instead of a handler per component
const PRESSABLE = '.menu-item, .soft-keys button, .tab, .btn, .app-row, .action, .pressable';

function onPointerDown(e: PointerEvent)
{
    if (!(e.target as Element | null)?.closest?.(PRESSABLE)) return;
    sound.play('select');
    if (settings.haptics) tick();
}

function onInput(e: Event)
{
    if ((e.target as Element | null)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') sound.play('key');
}
</script>

<template>
    <div
        class="launcher-root crt-screen"
        :class="{ curved: settings.curvature }"
        :data-phosphor="phosphor"
        :style="{ '--bloom': bloom }"
        @pointerdown.capture="onPointerDown"
        @input.capture="onInput">

        <slot />

        <div class="crt-overlay" :class="{ scanlines: settings.scanlines, flicker: settings.flicker, vignette: settings.vignette, curved: settings.curvature }">
            <div v-if="settings.sweep" class="sweep" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.crt-screen {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;

    // approximate tube curvature: rounded corners only, so touches are never displaced
    &.curved {
        border-radius: 4vmin;
        padding: 0 1.2vmin;
    }
}

.crt-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;

    &.scanlines {
        background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.28) 3px);
    }

    &.curved {
        border-radius: 4vmin;
        box-shadow: inset 0 0 6vmin rgba(0, 0, 0, 0.8);
    }

    &.curved.vignette::before {
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.75) 100%);
    }

    > .sweep {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 18%;
        background: linear-gradient(to bottom, transparent, var(--ph-glow) 60%, transparent);
        opacity: 0.1;
        mix-blend-mode: screen;
        will-change: transform;
        animation: sweep $dur-sweep linear infinite;
    }

    &.vignette::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.55) 100%);
    }

    &.flicker::after {
        content: '';
        position: absolute;
        inset: 0;
        background: var(--ph-glow);
        opacity: 0;
        mix-blend-mode: screen;
        animation: flicker $dur-flicker infinite alternate steps(2);
    }
}

@keyframes sweep {
    from { transform: translateY(-100%); }
    to { transform: translateY(560%); }
}

@keyframes flicker {
    from { opacity: 0.015; }
    to { opacity: 0.045; }
}

@media (prefers-reduced-motion: reduce) {
    .crt-overlay.flicker::after,
    .crt-overlay > .sweep { animation: none; }
}
</style>
