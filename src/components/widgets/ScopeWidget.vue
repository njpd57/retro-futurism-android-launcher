<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useBridgeEventStore } from '@/stores/useBridgeEventStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import TuiPanel from '../TuiPanel.vue';

const canvas = ref<HTMLCanvasElement | null>(null);
const settings = useSettingsStore();
const bridgeEvents = useBridgeEventStore();

const FRAME_MS = 1000 / 30;
const BARS = 24;

let raf = 0;
let paused = false;
let last = 0;
let t = 0;
let resizeObserver: ResizeObserver | null = null;
const bars = Array.from({ length: BARS }, () => Math.random());

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    const color = getComputedStyle(el).getPropertyValue('--ph').trim() || '#ffb000';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * settings.bloom;
    ctx.lineWidth = 1.5;

    // oscilloscope: two summed sines plus a little noise
    const mid = h * 0.32;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2)
    {
        const y = mid + Math.sin(x * 0.045 + t * 2.2) * h * 0.14 + Math.sin(x * 0.13 - t * 3.1) * h * 0.07 + (Math.random() - 0.5) * 2;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // spectrum bars drifting towards random targets
    const base = h - 2;
    const bw = w / BARS;
    for (let i = 0; i < BARS; i++)
    {
        bars[i] += (Math.random() - bars[i]) * 0.2 * (1 - i / (BARS * 1.4));
        const bh = Math.max(2, bars[i] * h * 0.4);
        ctx.fillRect(i * bw + 1, base - bh, bw - 3, bh);
    }
}

function frame(now: number)
{
    raf = requestAnimationFrame(frame);
    if (paused || now - last < FRAME_MS) return;
    last = now;
    t += FRAME_MS / 1000;
    draw();
}

function onBridgeEvent(ev: { name: string })
{
    if (ev.name === 'beforePause') paused = true;
    else if (ev.name === 'afterResume') paused = false;
}

onMounted(() =>
{
    draw();
    if (reducedMotion) // one static frame, redrawn when the size changes
    {
        resizeObserver = new ResizeObserver(draw);
        if (canvas.value) resizeObserver.observe(canvas.value);
        return;
    }
    raf = requestAnimationFrame(frame);
    bridgeEvents.addEventListener(onBridgeEvent);
});

onBeforeUnmount(() =>
{
    cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    bridgeEvents.removeEventListener(onBridgeEvent);
});
</script>

<template>
    <TuiPanel title="SEÑAL">
        <canvas ref="canvas" class="scope" />
    </TuiPanel>
</template>

<style scoped lang="scss">
.scope {
    display: block;
    width: 100%;
    height: 90px;
}
</style>
