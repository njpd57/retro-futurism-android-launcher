<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useElementSize, useNow } from '@vueuse/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { tick } from '@/utils/haptics';
import { bendK as bendCoef, bendOffset, correctPoint } from '@/utils/curvature';
import { isNight, NIGHT_MAX_BLOOM } from '@/utils/nightShift';

const settings = useSettingsStore();
const sound = useSoundStore();

// night shift: red phosphor and less bloom by schedule, without touching the user's own choice
const now = useNow({ interval: 60_000 });
const night = computed(() => settings.nightShift && isNight(now.value));
const phosphor = computed(() => night.value ? 'red' : settings.phosphor);
const bloom = computed(() => night.value ? Math.min(settings.bloom, NIGHT_MAX_BLOOM) : settings.bloom);

// barrel distortion through an SVG displacement map. It bends what is painted, not where the touches land,
// so clicks are redirected to the element that is drawn under the finger (see onClickCapture)
const bendK = computed(() => bendCoef(settings.curvatureBend));
const MAP_SCALE = 4; // the map is built at 1/4 resolution and stretched
const tubeEl = ref<HTMLElement | null>(null);
const { width: tubeW, height: tubeH } = useElementSize(tubeEl);
const bendMap = ref('');
const bendScale = ref(1);

function buildBendMap()
{
    const w = Math.round(tubeW.value), h = Math.round(tubeH.value);
    if (w < 2 || h < 2) return;
    if (bendK.value <= 0) { bendMap.value = ''; return; }
    const mw = Math.max(2, Math.round(w / MAP_SCALE)), mh = Math.max(2, Math.round(h / MAP_SCALE));
    const canvas = document.createElement('canvas');
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(mw, mh);
    // output pixel p samples the source at p * (1 + k r^2): content bulges and compresses towards the edges
    const box = { left: 0, top: 0, width: w, height: h };
    const maxD = bendK.value * Math.max(w, h); // displacement at the corners (r^2 = 2)
    const scale = maxD * 2;
    for (let y = 0; y < mh; y++)
    {
        for (let x = 0; x < mw; x++)
        {
            const { dx, dy } = bendOffset((x + 0.5) / mw * w, (y + 0.5) / mh * h, box, bendK.value);
            const i = (y * mw + x) * 4;
            img.data[i] = Math.max(0, Math.min(255, Math.round((0.5 + dx / scale) * 255)));
            img.data[i + 1] = Math.max(0, Math.min(255, Math.round((0.5 + dy / scale) * 255)));
            img.data[i + 2] = 128;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    bendScale.value = scale;
    bendMap.value = canvas.toDataURL('image/png');
}

watch([tubeW, tubeH, bendK, () => settings.curvature], () => { if (settings.curvature) buildBendMap(); });
onBeforeUnmount(() => { bendMap.value = ''; });

// one delegated listener instead of a handler per component
const PRESSABLE = '.menu-item, .soft-keys button, .tab, .btn, .app-row, .action, .pressable';

// the filter moves what is painted but not the hit-testing: find the element drawn under the finger
function elementUnder(e: MouseEvent): Element | null
{
    const target = e.target as Element | null;
    if (!settings.curvature || !tubeEl.value || bendK.value <= 0) return target;
    const r = tubeEl.value.getBoundingClientRect();
    const p = correctPoint(e.clientX, e.clientY, r, bendK.value);
    return document.elementFromPoint(p.x, p.y) ?? target;
}

function onClickCapture(e: MouseEvent)
{
    if (!e.isTrusted) return; // our own redirected click
    const target = elementUnder(e);
    if (!target || target === e.target) return;
    e.stopPropagation();
    e.preventDefault();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, view: window }));
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus();
}

function onPointerDown(e: PointerEvent)
{
    if (!elementUnder(e)?.closest?.(PRESSABLE)) return;
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
        :style="{ '--bloom': bloom, '--tube-radius-vmin': 2 + settings.curvatureCorners / 100 * 14, '--shade-k': settings.curvatureShade / 50 }"
        @pointerdown.capture="onPointerDown"
        @click.capture="onClickCapture"
        @input.capture="onInput">

        <svg v-if="settings.curvature && bendMap" class="bend-defs" width="0" height="0" aria-hidden="true">
            <filter id="crt-bend" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" :width="tubeW" :height="tubeH">
                <feImage :href="bendMap" x="0" y="0" :width="tubeW" :height="tubeH" preserveAspectRatio="none" result="map" />
                <feDisplacementMap in="SourceGraphic" in2="map" :scale="bendScale" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </svg>

        <div ref="tubeEl" class="tube"><slot /></div>

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

    // tube curvature: a black bezel with a rounded glass inside it. the bend itself is the SVG filter on .tube
    &.curved {
        --bezel: #000;
        --tube-inset: 1.6vmin;
        --tube-radius: calc(var(--tube-radius-vmin) * 1vmin) / calc(var(--tube-radius-vmin) * 0.78vmin);
        background-color: var(--bezel);
        padding: var(--tube-inset);
    }
}

.tube {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: var(--ph-bg);

    .curved > & { border-radius: var(--tube-radius); filter: url(#crt-bend); }
}

.bend-defs { position: absolute; pointer-events: none; }

.crt-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;

    &.scanlines {
        background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.28) 3px);
    }

    // same box as the tube; the shadows bulge the glass
    &.curved {
        inset: var(--tube-inset);
        border-radius: var(--tube-radius);
        box-shadow:
            inset 0 0 1.5vmin #000,
            inset 0 0 5vmin rgba(0, 0, 0, calc(0.5 * var(--shade-k)));
        // faint glass reflection, off-center towards the top left
        background-image: radial-gradient(ellipse at 25% 15%, color-mix(in srgb, var(--ph-glow) 8%, transparent) 0, transparent 55%);
    }

    &.curved.scanlines {
        background-image:
            radial-gradient(ellipse at 25% 15%, color-mix(in srgb, var(--ph-glow) 8%, transparent) 0, transparent 55%),
            repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0) 2px, rgba(0, 0, 0, 0.28) 3px);
    }

    &.curved.vignette::before {
        border-radius: inherit;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, calc(0.45 * var(--shade-k))) 100%);
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
