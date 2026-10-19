<script setup lang="ts">
import { useSettingsStore } from '@/stores/useSettingsStore';

const settings = useSettingsStore();
</script>

<template>
    <div
        class="launcher-root crt-screen"
        :data-phosphor="settings.phosphor"
        :style="{ '--bloom': settings.bloom }">

        <slot />

        <div class="crt-overlay" :class="{ scanlines: settings.scanlines, flicker: settings.flicker, vignette: settings.vignette }" />
    </div>
</template>

<style scoped lang="scss">
.crt-screen {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.crt-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;

    &.scanlines {
        background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.28) 3px);
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

@keyframes flicker {
    from { opacity: 0.015; }
    to { opacity: 0.045; }
}

@media (prefers-reduced-motion: reduce) {
    .crt-overlay.flicker::after { animation: none; }
}
</style>
