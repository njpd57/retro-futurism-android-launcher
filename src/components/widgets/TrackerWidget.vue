<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useSoundStore } from '@/stores/useSoundStore';
import { MAX_DOORS, SECTORS, newGame, seal, step, type TrackerState } from '@/games/tracker';
import { bar } from '@/utils/tui';

defineProps<{ id: string }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const settings = useSettingsStore();
const bridgeEvents = useBridgeEventStore();
const sound = useSoundStore();

const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 30;
const PING_FADE_MS = 1500;
const rng = Math.random;

const best = useLocalStorage('widget.tracker.best', 0);
const state = ref<TrackerState>(newGame(rng));
const started = ref(false);
const flash = ref<'hit' | 'miss' | null>(null);

let raf = 0;
let last = 0;
let paused = false;
let flashTimer: number | undefined;

function draw()
{
    const el = canvas.value;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr))
    {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const s = state.value;
    const color = getComputedStyle(el).getPropertyValue('--ph').trim() || '#ffb000';
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 4;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * settings.bloom;
    ctx.lineWidth = 1;

    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.arc(cx, cy, r / 2, 0, TAU);
    for (let i = 0; i < SECTORS; i++)
    {
        const a = -Math.PI / 2 + i * TAU / SECTORS;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();

    if (s.ping && s.phase === 'playing')
    {
        const fade = Math.max(0, 1 - s.pingAgeMs / PING_FADE_MS);
        const a = -Math.PI / 2 + (s.ping.sector + 0.5) * TAU / SECTORS;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * s.ping.dist, cy + Math.sin(a) * r * s.ping.dist, 5, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (paused || now - last < FRAME_MS) return;
    const dt = Math.min(100, now - last);
    last = now;

    if (started.value && state.value.phase === 'playing')
    {
        const r = step(state.value, dt, rng);
        state.value = r.state;
        if (r.events.includes('ping')) sound.play('ping');
        if (r.events.includes('lost'))
        {
            sound.play('alert');
            best.value = Math.max(best.value, state.value.score);
        }
    }
    draw();
}

function onTap(e: MouseEvent)
{
    const el = canvas.value;
    if (!el) return;

    if (!started.value) { started.value = true; return; }
    if (state.value.phase === 'lost')
    {
        state.value = newGame(rng);
        return;
    }

    const rect = el.getBoundingClientRect();
    const angle = Math.atan2(e.clientY - rect.top - rect.height / 2, e.clientX - rect.left - rect.width / 2);
    const sector = Math.floor((((angle + Math.PI / 2) % TAU) + TAU) % TAU / (TAU / SECTORS));

    const r = seal(state.value, sector, rng);
    state.value = r.state;
    if (r.result === 'none') return;

    flash.value = r.result;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => { flash.value = null; }, 300);
    sound.play(r.result === 'hit' ? 'select' : 'back');
}

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause') paused = true;
    else if (ev.name === 'afterResume') { paused = false; last = performance.now(); }
}

onMounted(() =>
{
    draw();
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
});

onBeforeUnmount(() =>
{
    cancelAnimationFrame(raf);
    window.clearTimeout(flashTimer);
    bridgeEvents.removeEventListener(onBridgeEvent);
});
</script>

<template>
    <div>
        <div class="hud">
            <span>PUERTAS {{ bar(state.doors / MAX_DOORS, MAX_DOORS) }}</span>
            <span>SELLADAS {{ state.score }} · MEJOR {{ best }}</span>
        </div>
        <div class="stage" :class="flash">
            <canvas ref="canvas" class="radar" @click="onTap" />
            <div v-if="!started" class="overlay">TOCA PARA INICIAR<br />SELLA LA PUERTA DONDE APAREZCA EL BLIP</div>
            <div v-else-if="state.phase === 'lost'" class="overlay">EL ALIEN TE ALCANZÓ<br />TOCA PARA REINTENTAR</div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.hud { display: flex; justify-content: space-between; gap: 8px; font-size: 0.85em; color: var(--ph-dim); }
.stage {
    position: relative;
    &.hit { background: var(--ph-glow); }
    &.miss { outline: 1px solid var(--ph-dim); }
}
.radar { display: block; width: 100%; height: 180px; touch-action: pan-y; }
.overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: var(--ph-bg);
    opacity: 0.88;
    pointer-events: none;
    font-size: 0.9em;
}
</style>
