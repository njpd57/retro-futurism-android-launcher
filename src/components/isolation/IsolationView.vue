<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { TRACKER, type GameState } from '@/games/isolation/game';
import { cellX, cellY } from '@/games/isolation/grid';
import { ALIEN_OUTLINE, buildView, type Pose, type Shape } from '@/games/isolation/view';

/** Everything one frame needs; the game loop calls `draw` with it. */
export interface Frame
{
    state: GameState;
    pose: Pose;
    bob: number;
    now: number;
    /** 0..1 picture breaking up as the creature gets close (0 with reduced motion) */
    interference: number;
    /** ms since the last tracker ping */
    sincePing: number;
    /** 0..1 the death flash */
    flash: number;
}

const canvas = ref<HTMLCanvasElement | null>(null);
const settings = useSettingsStore();

const TAU = Math.PI * 2;
const METERS_PER_CELL = 2;

function draw(f: Frame)
{
    const el = canvas.value;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr))
    {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(el);
    const ph = css.getPropertyValue('--ph').trim() || '#ffb000';
    const bg = css.getPropertyValue('--ph-bg').trim() || '#000';
    const font = css.fontFamily || 'monospace';
    const s = f.state;

    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (f.flash > 0)
    {
        drawDeath(ctx, w, h, ph, bg, f.flash);
        return;
    }

    const shapes = buildView({
        grid: s.grid, closed: s.closed, items: s.items, signs: s.signs, pose: f.pose,
        alien: s.alien.cell, hiddenIn: s.player.hidden ? s.player.cell : null,
        pulse: (Math.sin(f.now / 260) + 1) / 2, bob: f.bob, w, h,
    });

    ctx.save();
    if (f.interference > 0)
        ctx.translate((Math.random() - 0.5) * 8 * f.interference, (Math.random() - 0.5) * 4 * f.interference);
    drawShapes(ctx, shapes, ph, bg, font, s.tracker.raised ? 0.22 : 1, f.interference);
    ctx.restore();

    if (s.player.hidden) drawSlats(ctx, w, h, ph, bg);
    if (f.interference > 0) drawStatic(ctx, w, h, ph, f.interference);
    if (s.tracker.raised) drawTracker(ctx, w, h, ph, bg, font, f);
}

function drawShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], ph: string, bg: string, font: string, dim: number, interference: number)
{
    const glow = 0.22 * settings.bloom;
    ctx.lineJoin = 'round';
    for (const sh of shapes)
    {
        if (sh.kind === 'text')
        {
            ctx.globalAlpha = sh.alpha * dim;
            ctx.fillStyle = ph;
            ctx.font = `${Math.round(sh.size)}px ${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.save();
            ctx.transform(sh.a, sh.b, 0, 1, sh.x, sh.y);
            ctx.fillText(sh.text, 0, 0);
            ctx.restore();
            continue;
        }

        ctx.beginPath();
        ctx.moveTo(sh.pts[0], sh.pts[1]);
        for (let i = 2; i < sh.pts.length; i += 2) ctx.lineTo(sh.pts[i], sh.pts[i + 1]);
        if (sh.kind === 'poly') ctx.closePath();
        if (sh.kind === 'poly' && sh.fill)
        {
            ctx.globalAlpha = 1;
            ctx.fillStyle = bg;
            ctx.fill();
        }
        // the picture drops lines when the creature is close
        if (interference > 0 && Math.random() < interference * 0.15) continue;
        ctx.strokeStyle = ph;
        // glow: a wide faint stroke under the thin one (cheaper than shadowBlur on every line)
        if (glow > 0)
        {
            ctx.globalAlpha = sh.alpha * dim * glow;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.globalAlpha = sh.alpha * dim;
        ctx.lineWidth = sh.tag === 'alien' ? 1.6 : 1.2;
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/** Looking out through the slats of a locker. */
function drawSlats(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string)
{
    for (let y = 0; y < h; y += 22)
    {
        ctx.globalAlpha = 1;
        ctx.fillStyle = bg;
        ctx.fillRect(0, y, w, 14);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = ph;
        ctx.fillRect(0, y + 13, w, 1);
    }
    ctx.globalAlpha = 1;
}

function drawStatic(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, level: number)
{
    ctx.fillStyle = ph;
    for (let i = 0; i < Math.ceil(level * 10); i++)
    {
        ctx.globalAlpha = 0.15 + Math.random() * 0.35 * level;
        const x = Math.random() * w;
        ctx.fillRect(x, Math.random() * h, Math.random() * (w - x), 1 + Math.random() * 2);
    }
    ctx.globalAlpha = 1;
}

function drawTracker(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, f: Frame)
{
    const s = f.state;
    const cx = w / 2;
    const cy = h / 2 + 6;
    const r = Math.min(w, h) * 0.4;
    const glow = settings.bloom;

    ctx.strokeStyle = ph;
    ctx.fillStyle = ph;
    ctx.lineWidth = 1;
    ctx.shadowColor = ph;
    ctx.shadowBlur = 6 * glow;

    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const k of [1, 2 / 3, 1 / 3])
    {
        ctx.moveTo(cx + r * k, cy);
        ctx.arc(cx, cy, r * k, 0, TAU);
    }
    for (let i = 0; i < 12; i++)
    {
        const a = i * TAU / 12;
        ctx.moveTo(cx + Math.cos(a) * r * 0.08, cy + Math.sin(a) * r * 0.08);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();

    // the ping wave
    if (f.sincePing < 700)
    {
        ctx.globalAlpha = 1 - f.sincePing / 700;
        ctx.beginPath();
        ctx.arc(cx, cy, r * f.sincePing / 700, 0, TAU);
        ctx.stroke();
    }

    // the player: a notch pointing forward
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.lineTo(cx - 5, cy + 4);
    ctx.closePath();
    ctx.fill();

    ctx.font = `${Math.round(r * 0.14)}px ${font}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const blip = s.tracker.blip;
    const fade = blip ? Math.max(0, 1 - blip.ageMs / 1600) : 0;
    let label = 'SIN MOVIMIENTO';
    if (blip && fade > 0)
    {
        const dx = cellX(s.grid, blip.cell) + 0.5 - f.pose.x;
        const dy = cellY(s.grid, blip.cell) + 0.5 - f.pose.y;
        const right = dx * Math.cos(f.pose.yaw) + dy * Math.sin(f.pose.yaw);
        const ahead = dx * Math.sin(f.pose.yaw) - dy * Math.cos(f.pose.yaw);
        const k = r / TRACKER.range;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(cx + right * k, cy - ahead * k, Math.max(4, r * 0.05), 0, TAU);
        ctx.fill();
        label = `${String(Math.round(Math.hypot(dx, dy) * METERS_PER_CELL)).padStart(2, '0')} M`;
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(6, 6, ctx.measureText(label).width + 8, r * 0.16);
    ctx.fillStyle = ph;
    ctx.fillText(label, 10, 8);
}

/** The end: the screen lights up and the creature fills it. */
function drawDeath(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, flash: number)
{
    ctx.globalAlpha = flash;
    ctx.fillStyle = ph;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const size = Math.max(w, h) * 1.3;
    ctx.beginPath();
    ALIEN_OUTLINE.forEach(([x, y], i) =>
    {
        const px = w / 2 + x * size;
        const py = h * 0.55 + y * size;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
}

defineExpose({ draw });
</script>

<template>
    <canvas ref="canvas" class="isolation-view" />
</template>

<style scoped lang="scss">
.isolation-view { display: block; width: 100%; height: 100%; }
</style>
