<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { useAnimStore } from '@/stores/useAnimStore';
import { pressHoldLeft } from '@/utils/anim';
import { useTubeStore } from '@/stores/useTubeStore';
import { tick } from '@/utils/haptics';
import { bendK as bendCoef, bendOffset, correctPoint } from '@/utils/curvature';
import { useEffectiveSettings } from '@/stores/useEffectiveSettings';
import { nextDegaussMinutes } from '@/utils/degauss';
import { HANDOFF_MS, handoffFrame, handoffText } from '@/utils/handoff';
import { burnBands, burnOpacity, type BurnBand } from '@/utils/burnIn';
import { usePausableInterval } from '@/composables/usePausableInterval';

const settings = useSettingsStore();
const sound = useSoundStore();
const anim = useAnimStore();
const tube = useTubeStore();

// the colour and bloom the tube shows: the night shift and the active protocols laid over the user's own choice
const effective = useEffectiveSettings();
const phosphor = computed(() => effective.phosphor);
const bloom = computed(() => effective.bloom);

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

// degauss: the picture shakes and ripples for a moment, a damped oscillation of a turbulence displacement. It sits on
// .tube next to the bend filter and only lives while it plays, so the touch correction (which follows the bend) is not
// touched for longer than that
const DEGAUSS_MS = 600;
const DEGAUSS_MAX_PX = 22;
const degaussing = ref(false);
const degaussScale = ref(0);
const degaussSeed = ref(1);
const degaussFlash = ref(1);
let degaussFrame = 0;

function playDegauss()
{
    cancelAnimationFrame(degaussFrame);
    degaussing.value = true;
    sound.play('thunk');
    const start = performance.now();
    const frame = (t: number) =>
    {
        const p = Math.min(1, (t - start) / DEGAUSS_MS);
        const decay = Math.exp(-4 * p);
        degaussScale.value = DEGAUSS_MAX_PX * decay * Math.cos(p * Math.PI * 7);
        degaussSeed.value = 1 + Math.floor(p * DEGAUSS_MS / 60); // the noise changes in steps, not smoothly
        degaussFlash.value = 1 + 0.5 * Math.exp(-6 * p);
        if (p < 1) degaussFrame = requestAnimationFrame(frame); else degaussing.value = false;
    };
    degaussFrame = requestAnimationFrame(frame);
}

// the handoff before leaving for an app: MOTHER types the transfer inside the tube (so it folds with the picture).
// Only the typed text is driven per frame; the bar is CSS
const handoffMs = ref(0);
let handoffFrameId = 0;
const handoffLines = computed(() => tube.handoff ? handoffText(tube.handoff.label) : null);
const handoffNow = computed(() => handoffLines.value ? handoffFrame(handoffLines.value, handoffMs.value) : null);

function playHandoff()
{
    cancelAnimationFrame(handoffFrameId);
    handoffMs.value = 0;
    if (!tube.handoff) return;
    sound.play('chirp');
    const start = performance.now();
    const frame = (t: number) =>
    {
        handoffMs.value = Math.min(HANDOFF_MS, t - start);
        if (handoffMs.value < HANDOFF_MS) handoffFrameId = requestAnimationFrame(frame);
    };
    handoffFrameId = requestAnimationFrame(frame);
}

watch(() => tube.degaussPulse, playDegauss);
watch(() => tube.handoff?.id, playHandoff);
// a new phosphor is a new tube colour: degauss it (the first value is not a change)
watch(phosphor, () => tube.degauss());
onBeforeUnmount(() => { cancelAnimationFrame(degaussFrame); cancelAnimationFrame(handoffFrameId); });

const tubeStyle = computed(() => degaussing.value
    ? { filter: `${settings.curvature && bendMap.value ? 'url(#crt-bend) ' : ''}url(#crt-degauss) brightness(${degaussFlash.value.toFixed(3)})` }
    : undefined);

// switching on after a pause is a short flash; the class is dropped once it has played
let warmTimer = 0;
watch(() => tube.power, power =>
{
    window.clearTimeout(warmTimer);
    if (power === 'warming') warmTimer = window.setTimeout(() => tube.warmed(), 400);
});
onBeforeUnmount(() => window.clearTimeout(warmTimer));

// the tube degausses by itself every now and then: minutes of visible screen, counted only while the launcher is on
let minutesToDegauss = nextDegaussMinutes(Math.random);
const autoDegaussTimer = usePausableInterval(() =>
{
    if (--minutesToDegauss > 0) return;
    minutesToDegauss = nextDegaussMinutes(Math.random);
    tube.degauss();
}, 60_000);
watch(() => settings.autoDegauss, on => { if (on) autoDegaussTimer.start(); else autoDegaussTimer.stop(); });
onMounted(() => { if (settings.autoDegauss) autoDegaussTimer.start(); });

// phosphor persistence: minutes of use are counted while the launcher is on screen, and the ghost bands follow the
// frame lines (under the top bar, over the soft keys), which are measured so they fit any device
const burnOn = computed(() => settings.phosphorBurn && settings.burnMinutes > 0);
const burn = computed(() => burnOpacity(settings.burnMinutes));
const bands = ref<BurnBand[]>([]);

function measureBands()
{
    const root = tubeEl.value;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const topBar = root.querySelector('.top-bar')?.getBoundingClientRect();
    const keys = root.querySelector('.soft-keys')?.getBoundingClientRect();
    bands.value = burnBands(topBar ? topBar.bottom - box.top : null, keys ? keys.top - box.top : null, box.height);
}

const burnTimer = usePausableInterval(() =>
{
    settings.burnMinutes++;
    measureBands();
}, 60_000);

watch(() => settings.phosphorBurn, on => { if (on) { burnTimer.start(); measureBands(); } else burnTimer.stop(); });
watch([tubeW, tubeH], measureBands);
onMounted(() => { if (settings.phosphorBurn) { burnTimer.start(); measureBands(); } });

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

// a pressed control is lit (data-pressed, styled in base.scss) while the finger is down and for at least PRESS_MIN_MS,
// so a quick tap is seen; a touch that turns into a scroll (pointercancel) drops it at once. A data attribute, not a
// class, because Vue rewrites the class of an element whenever its bindings change
let pressed: { el: Element; at: number } | null = null;
let releaseTimer = 0;

function unpress()
{
    window.clearTimeout(releaseTimer);
    pressed?.el.removeAttribute('data-pressed');
    pressed = null;
}

function onPointerDown(e: PointerEvent)
{
    const el = elementUnder(e)?.closest?.(PRESSABLE);
    if (!el) return;
    sound.play('select');
    if (settings.haptics) tick();
    if (!anim.transitions) return;
    unpress();
    el.setAttribute('data-pressed', '');
    pressed = { el, at: performance.now() };
}

function onPointerUp()
{
    if (!pressed) return;
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(unpress, pressHoldLeft(pressed.at, performance.now()));
}

onBeforeUnmount(unpress);

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
        @pointerup.capture="onPointerUp"
        @pointercancel.capture="unpress"
        @click.capture="onClickCapture"
        @input.capture="onInput">

        <svg v-if="settings.curvature && bendMap" class="bend-defs" width="0" height="0" aria-hidden="true">
            <filter id="crt-bend" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" :width="tubeW" :height="tubeH">
                <feImage :href="bendMap" x="0" y="0" :width="tubeW" :height="tubeH" preserveAspectRatio="none" result="map" />
                <feDisplacementMap in="SourceGraphic" in2="map" :scale="bendScale" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </svg>

        <svg v-if="degaussing && tubeW > 1" class="bend-defs" width="0" height="0" aria-hidden="true">
            <filter id="crt-degauss" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" :width="tubeW" :height="tubeH">
                <feTurbulence type="fractalNoise" baseFrequency="0.004 0.02" numOctaves="1" :seed="degaussSeed" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" :scale="degaussScale" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </svg>

        <div ref="tubeEl" class="tube" :class="{ 'tube-off': tube.power === 'off', 'tube-on': tube.power === 'warming' }" :style="tubeStyle">
            <slot />
            <div v-if="tube.handoff && handoffLines && handoffNow" class="handoff" aria-hidden="true">
                <div class="handoff-box">
                    <div class="handoff-title">MU-TH-UR 6000 · ENLACE</div>
                    <div class="handoff-line">{{ handoffLines.link.slice(0, handoffNow.link) }}<span v-if="!handoffNow.transfer" class="cursor">█</span></div>
                    <div class="handoff-line">{{ handoffLines.transfer.slice(0, handoffNow.transfer) }}<span v-if="handoffNow.transfer" class="cursor">█</span></div>
                    <div class="handoff-bar"><div class="fill" /></div>
                </div>
            </div>
        </div>

        <div v-if="burnOn" class="burn" aria-hidden="true" :style="{ opacity: burn }">
            <div v-for="b in bands" :key="b.top" class="band" :style="{ top: b.top + 'px', height: b.height + 'px' }" />
        </div>

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

// the ghost sits over the tube's box; it only ever lights the dark gap next to the bars, never a glyph
.burn {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 99;

    .curved > & { inset: var(--tube-inset); }

    .band {
        position: absolute;
        left: 0;
        right: 0;
        background: var(--ph);
        mix-blend-mode: screen;
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

// the handoff: drawn inside .tube, so the fold takes it with the picture
.handoff {
    position: absolute;
    inset: 0;
    z-index: 50;
    pointer-events: none;
}

.handoff-box {
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(86%, 22em);
    transform: translate(-50%, -50%);
    border: 2px solid var(--ph);
    background: var(--ph-bg);
    @include box-glow;
    @include glow;
}

.handoff-title {
    @include inverse;
    padding: 0 0.4em;
}

.handoff-line {
    min-height: 1.1em;
    padding: 0 0.4em;
    white-space: pre;
    overflow: hidden;
}

.handoff .cursor { animation: handoff-cursor 0.3s steps(1) infinite; }

// the bar fills smoothly (transform only) and ends just before the fold
.handoff-bar {
    margin: 0.3em 0.4em 0.45em;
    height: 0.55em;
    border: 1px solid var(--ph);
    padding: 2px;

    .fill {
        height: 100%;
        background: var(--ph);
        transform-origin: left center;
        animation: handoff-bar 0.42s linear 0.17s both;
    }
}

@keyframes handoff-bar {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
}

@keyframes handoff-cursor {
    50% { opacity: 0; }
}

// the tube switching off: the picture folds to a line, then to a dot, in a few steps
.tube-off {
    animation: tube-off 0.45s steps(6) forwards;
}

.tube-on {
    animation: tube-on 0.4s steps(5) both;
}

@keyframes tube-off {
    0% { transform: scale(1, 1); opacity: 1; }
    55% { transform: scale(1, 0.01); opacity: 1; }
    100% { transform: scale(0.01, 0.01); opacity: 0; }
}

@keyframes tube-on {
    0% { transform: scale(0.01, 0.01); opacity: 1; }
    40% { transform: scale(1, 0.01); opacity: 1; }
    100% { transform: scale(1, 1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
    .crt-overlay.flicker::after,
    .crt-overlay > .sweep { animation: none; }
    .tube-off, .tube-on, .handoff .cursor, .handoff-bar .fill { animation: none; }
}
</style>
