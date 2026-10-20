<script setup lang="ts">
import { ref } from 'vue';
import { drawShapes } from '@/components/wire/drawShapes';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { LOW_HEALTH, TRACKER, grabbed, lockTarget, type MarinesState, type Player } from '@/games/marines/game';
import { MARINE } from '@/games/marines/squad';
import { buildMarinesView } from '@/games/marines/view';
import { WEAPONS, spreadAt, type WeaponId } from '@/games/marines/weapons';
import type { Pose } from '@/games/wire/camera';
import { bar } from '@/utils/tui';

/** Everything one frame needs; the game loop calls `draw` with it. */
export interface Frame
{
    state: MarinesState;
    pose: Pose;
    bob: number;
    now: number;
    /** ms since the last tracker ping */
    sincePing: number;
    /** no shaking, no static (prefers-reduced-motion) */
    reduced: boolean;
}

const canvas = ref<HTMLCanvasElement | null>(null);
const settings = useSettingsStore();

const TAU = Math.PI * 2;
const METERS_PER_CELL = 2;
const MAX_DPR = 2;

function draw(f: Frame)
{
    const el = canvas.value;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;

    // the canvas is bigger than it looks on a dense screen; past 2x it only costs
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
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
    const p = s.player;

    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // the picture breaks up as health runs out
    const faint = f.reduced || s.phase !== 'playing' ? 0 : Math.max(0, (LOW_HEALTH - p.health) / LOW_HEALTH);

    const shapes = buildMarinesView({
        grid: s.grid, closed: s.closed, signs: s.signs, pickups: s.pickups, enemies: s.enemies, fx: s.fx,
        marines: s.marines, acid: s.acid, projectiles: s.projectiles, turrets: s.turrets, spits: s.spits, dark: s.dark, lockId: lockTarget(s),
        pose: f.pose, bob: f.bob, time: s.timeMs, pulse: (Math.sin(f.now / 260) + 1) / 2, w, h,
    });
    drawShapes(ctx, shapes, { ph, bg, font, dim: s.phase === 'dead' ? 0.45 : 1, interference: faint * 0.6, bloom: settings.bloom, h });

    if (grabbed(s)) drawGrab(ctx, w, h, ph, bg, f);
    if (s.phase === 'playing')
    {
        drawWeapon(ctx, w, h, ph, bg, font, p, f);
        drawCrosshair(ctx, w, h, ph, p);
        if (p.reloadMs > 0) drawReload(ctx, w, h, ph, bg, font, p);
    }
    drawSquad(ctx, w, h, ph, bg, font, s);
    drawTracker(ctx, w, h, ph, bg, font, f);
    if (p.hurtMs > 0) drawHurt(ctx, w, h, ph, p.hurtMs / 350);
    if (faint > 0) drawStatic(ctx, w, h, ph, faint);
}

type Pt = [number, number];
type Seg = [number, number, number, number];
/** The drawing of a weapon, in order: `part` is a filled outline, `lines` loose strokes at an opacity. */
type Op = { part: Pt[] } | { lines: Seg[]; alpha?: number };

interface Art
{
    ops: Op[];
    /** where the round counter sits, and where the muzzle flash starts */
    counter: Pt;
    muzzle: Pt;
    /** how big the flash is and how hard the weapon kicks, against the rifle's 1 */
    flash: number;
    kick: number;
}

const box = (x0: number, y0: number, x1: number, y1: number): Seg[] => [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]];
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Every weapon in its own units: +x towards the muzzle, +y down. The butt is at the left, the muzzle at the right. */
const ART: Record<WeaponId, Art> = {
    // the butt, the launcher under the barrel, the receiver, the shroud with its cooling slots, the barrel, the
    // carrying handle and the pistol grip with its guard, and the housing of the counter
    rifle: {
        counter: [-65, -12], muzzle: [284, 0], flash: 1, kick: 1,
        ops: [
            { part: [[-120, -14], [-195, -4], [-195, 44], [-120, 36]] },
            { part: rect(30, 22, 185, 46) },
            { lines: [[105, 22, 105, 46], [50, 34, 90, 34], [120, 34, 170, 34]] },
            { part: rect(-120, -26, 40, 36) },
            { part: rect(40, -17, 175, 19) },
            { lines: Array.from({ length: 8 }, (_, i): Seg => [56 + i * 16, -11, 56 + i * 16, 11]), alpha: 0.6 },
            { lines: [[175, -5, 262, -5], [175, 5, 262, 5]], alpha: 1 },
            { part: rect(262, -9, 282, 9) },
            { lines: [[270, -9, 270, 9], [276, -9, 276, 9]], alpha: 0.8 },
            { part: [[-72, -26], [-56, -54], [8, -54], [24, -26]] },
            { lines: [[-52, -41, 4, -41]], alpha: 0.6 },
            { part: [[-88, 36], [-104, 96], [-64, 98], [-46, 36]] },
            { lines: [[-40, 36, -30, 62], [-30, 62, -4, 62], [-4, 62, 8, 36]], alpha: 0.8 },
            { lines: box(-104, -21, -26, -3), alpha: 0.9 },
        ],
    },
    // a long barrel over the magazine tube, the pump under it
    shotgun: {
        counter: [-70, -6], muzzle: [272, -8], flash: 1.8, kick: 2.2,
        ops: [
            { part: [[-120, -14], [-195, 2], [-195, 42], [-120, 30]] },
            { part: [[-88, 30], [-104, 92], [-64, 94], [-46, 30]] },
            { lines: [[-40, 30, -30, 56], [-30, 56, -4, 56], [-4, 56, 8, 30]], alpha: 0.8 },
            { part: rect(-120, -24, 30, 30) },
            { part: rect(30, 6, 225, 17) },
            { part: rect(30, -14, 270, -2) },
            { lines: [[30, -8, 262, -8]], alpha: 0.5 },
            { lines: [[262, -14, 262, -2], [268, -14, 268, -2]], alpha: 0.9 },
            { part: rect(80, 19, 178, 40) },
            { lines: [[98, 19, 98, 40], [112, 19, 112, 40], [126, 19, 126, 40], [140, 19, 140, 40]], alpha: 0.6 },
            { lines: box(-95, -17, -45, 5), alpha: 0.9 },
        ],
    },
    // heavy, with the ammunition box under the body and the gimbal arm out in front
    smartgun: {
        counter: [-70, -8], muzzle: [288, 0], flash: 0.8, kick: 0.5,
        ops: [
            { part: [[-150, -34], [-60, -44], [70, -44], [70, 40], [-150, 40]] },
            { part: [[-134, 40], [-96, 40], [-84, 96], [-124, 98]] },
            { part: rect(-60, 40, 36, 98) },
            { lines: [[-60, 58, 36, 58], [-60, 78, 36, 78]], alpha: 0.6 },
            { part: [[-90, -44], [-74, -72], [40, -72], [56, -44]] },
            { lines: [[-60, -58, 20, -58]], alpha: 0.6 },
            { part: [[70, -24], [135, -14], [135, 14], [70, 24]] },
            { part: rect(135, -18, 250, 18) },
            { lines: Array.from({ length: 6 }, (_, i): Seg => [150 + i * 16, -12, 150 + i * 16, 12]), alpha: 0.6 },
            { part: rect(250, -11, 288, 11) },
            { lines: [[266, -11, 266, 11]], alpha: 0.8 },
            { lines: box(-110, -20, -30, 4), alpha: 0.9 },
        ],
    },
    // a tank behind, a hose to the gun, a long nozzle with a pilot light at its tip
    flamer: {
        counter: [-10, -4], muzzle: [272, 0], flash: 0, kick: 0.3,
        ops: [
            { part: rect(-170, 10, -20, 104) },
            { lines: [[-170, 36, -20, 36], [-170, 78, -20, 78]], alpha: 0.6 },
            { lines: [[-20, 52, 12, 52], [12, 52, 34, 28]], alpha: 0.8 },
            { part: [[-30, 30], [-44, 88], [-6, 90], [8, 30]] },
            { part: rect(-60, -20, 40, 30) },
            { part: rect(40, -9, 240, 9) },
            { lines: [[90, -9, 90, 9], [150, -9, 150, 9]], alpha: 0.7 },
            { part: rect(240, -14, 268, 14) },
            { lines: [[254, -14, 254, 14]], alpha: 0.8 },
            { lines: box(-50, -14, 30, 6), alpha: 0.9 },
        ],
    },
};

/**
 * The weapon in hand, held low at the right, its barrel towards the middle; the round counter is an inverse-video
 * block. Drawn in its own units (+x towards the muzzle, +y down) under a transform that tips it into the corner.
 */
function drawWeapon(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, p: Player, f: Frame)
{
    const art = ART[p.weapon];
    const k = Math.max(0, 1 - p.firedMs / 90) * art.kick;
    // the launcher under the barrel kicks when a grenade leaves
    const launch = Math.max(0, 1 - p.launchMs / 180);
    // recoil kicks it back and down; walking sways it
    const sway = f.reduced ? 0 : p.moveAmt;
    // foreshortened (the barrel is squeezed along its length) and only slightly tilted, so that it points into the screen
    const s = h * 0.0013;
    const sx = s * 0.7;
    const a = 0.5;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const ox = w * 0.82 + k * 5 + launch * 4 + Math.sin(f.now / 180) * sway * 4;
    const oy = h * 0.95 + k * 8 + launch * 9 + Math.abs(Math.cos(f.now / 180)) * sway * 3;
    const toScreen = (x: number, y: number): [number, number] => [ox + (-cos * sx * x - sin * s * y), oy + (-sin * sx * x + cos * s * y)];

    ctx.save();
    ctx.transform(-cos * sx, -sin * sx, -sin * s, cos * s, ox, oy);
    const trace = (pts: Pt[], close = true) =>
    {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (close) ctx.closePath();
    };
    const part = (pts: Pt[]) =>
    {
        trace(pts);
        ctx.globalAlpha = 1;
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = ph;
        ctx.globalAlpha = 0.25 * settings.bloom;
        ctx.lineWidth = 4 / s;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4 / s;
        ctx.stroke();
    };
    const lines = (segs: Seg[], alpha = 0.75) =>
    {
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of segs)
        {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
        }
        ctx.strokeStyle = ph;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.2 / s;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
    for (const op of art.ops)
    {
        if ('part' in op) part(op.part);
        else lines(op.lines, op.alpha);
    }
    ctx.restore();

    // the round counter, upright so that it can be read
    const [cx, cy] = toScreen(art.counter[0], art.counter[1]);
    const size = Math.max(13, Math.round(h * 0.03));
    ctx.font = `${size}px ${font}`;
    const text = String(p.mag).padStart(2, '0');
    const bw = ctx.measureText(text).width + 8;
    ctx.globalAlpha = 1;
    ctx.fillStyle = ph;
    ctx.fillRect(cx - bw / 2, cy - size * 0.5, bw, size);
    ctx.fillStyle = bg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 1);

    ctx.strokeStyle = ph;
    ctx.lineWidth = 1.6;
    // the muzzle flash: small, and only while a round leaves
    if (art.flash > 0 && p.firedMs < 55)
    {
        const [mx, my] = toScreen(art.muzzle[0], art.muzzle[1]);
        ctx.globalAlpha = 1 - p.firedMs / 55;
        const spin = Math.floor(f.now / 40) * 0.7;
        ctx.beginPath();
        for (let i = 0; i < 6; i++)
        {
            const t = spin + i * TAU / 6;
            const len = (9 + (i % 2) * 8) * art.flash;
            ctx.moveTo(mx + Math.cos(t) * 3, my + Math.sin(t) * 3);
            ctx.lineTo(mx + Math.cos(t) * len, my + Math.sin(t) * len);
        }
        ctx.stroke();
    }
    // the flamethrower's pilot light, always lit and always flickering
    if (p.weapon === 'flamer')
    {
        const [mx, my] = toScreen(art.muzzle[0] + 6, art.muzzle[1]);
        const flick = f.reduced ? 0.5 : (Math.sin(f.now / 55) + Math.sin(f.now / 83) + 2) / 4;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - 5 - flick * 9, my - 2);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - 3 - flick * 6, my - 6 - flick * 4);
        ctx.stroke();
    }
    // a grenade leaving the launcher under the barrel
    if (p.launchMs < 90)
    {
        const [mx, my] = toScreen(150, 40);
        ctx.globalAlpha = 1 - p.launchMs / 90;
        ctx.beginPath();
        for (let i = 0; i < 5; i++)
        {
            const t = i * TAU / 5 + f.now / 60;
            ctx.moveTo(mx + Math.cos(t) * 3, my + Math.sin(t) * 3);
            ctx.lineTo(mx + Math.cos(t) * 11, my + Math.sin(t) * 11);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/** A facehugger on the face: its body at the top of the view and its legs reaching round the edges. */
function drawGrab(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, f: Frame)
{
    const cx = w / 2;
    const cy = h * 0.2;
    const rx = w * 0.2;
    const ry = h * 0.08;
    // it squirms, unless motion is reduced
    const squirm = f.reduced ? 0 : Math.sin(f.now / 90) * 3;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ph;
    // the legs: from the body out and down to the edges of the view
    ctx.beginPath();
    for (const side of [-1, 1])
        for (let k = 0; k < 4; k++)
        {
            const y0 = cy + (k - 1.5) * ry * 0.55;
            ctx.moveTo(cx + side * rx * 0.85, y0);
            ctx.lineTo(cx + side * (rx + w * (0.1 + k * 0.025)), y0 - ry * 0.6 + squirm * (k % 2 ? 1 : -1));
            ctx.lineTo(cx + side * w * (0.45 - k * 0.01), h * (0.42 + k * 0.1));
        }
    ctx.globalAlpha = 0.25 * settings.bloom;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // the body, over them
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.55, ry * 0.5, 0, 0, TAU);
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
}

/** The squad's biomonitors, top left: a bar of health for each marine, a flat line for one who is down. */
function drawSquad(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, s: MarinesState)
{
    const size = Math.max(13, Math.round(h * 0.03));
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    s.marines.forEach((m, i) =>
    {
        const down = m.hp <= 0;
        const text = down ? `${m.name} ──────` : `${m.name} ${bar(m.hp / MARINE.hp, 6)}`;
        const y = 6 + i * (size + 3);
        const tw = ctx.measureText(text).width + 8;
        // a marine badly hurt shows in inverse video, blinking
        const flag = !down && m.hp / MARINE.hp < 0.3 && Math.floor(s.timeMs / 400) % 2 === 0;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = flag ? ph : bg;
        ctx.fillRect(6, y - 1, tw, size + 2);
        ctx.globalAlpha = down ? 0.5 : 1;
        ctx.fillStyle = flag ? bg : ph;
        ctx.fillText(text, 10, y);
    });
    ctx.globalAlpha = 1;
}

/** A cross with a gap, which opens with the spread. */
function drawCrosshair(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, p: Player)
{
    const cx = w / 2;
    const cy = h / 2;
    const spread = spreadAt(WEAPONS[p.weapon], p.heat);
    // the spread as it looks on the screen: the angle times the focal length
    const gap = 5 + Math.tan(spread) * w * 0.62;
    const len = 7;
    ctx.strokeStyle = ph;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + len, cy);
    ctx.moveTo(cx, cy - gap - len);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + len);
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawReload(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, p: Player)
{
    const def = WEAPONS[p.weapon];
    const size = Math.max(14, Math.round(h * 0.032));
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `RECARGANDO ${bar(1 - p.reloadMs / def.reloadMs, 8)}`;
    const y = h / 2 + h * 0.09;
    // on a block of the background, so the creatures' lines don't cross the letters
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = bg;
    ctx.fillRect(w / 2 - ctx.measureText(text).width / 2 - 6, y - size * 0.6, ctx.measureText(text).width + 12, size * 1.2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ph;
    ctx.fillText(text, w / 2, y);
}

/** The motion tracker: the front half of the circle, what moved since the last ping, and the nearest contact's distance. */
function drawTracker(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, f: Frame)
{
    const s = f.state;
    const r = Math.min(w * 0.3, h * 0.26);
    const cx = r + 12;
    const cy = h - 12;
    const k = r / TRACKER.range;

    ctx.save();
    // a block of the background under it, so the scene doesn't cross the lines
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r + 2, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.82;
    ctx.fill();

    ctx.strokeStyle = ph;
    ctx.fillStyle = ph;
    ctx.lineWidth = 1;
    ctx.shadowColor = ph;
    ctx.shadowBlur = 5 * settings.bloom;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const m of [1, 2 / 3, 1 / 3])
    {
        ctx.moveTo(cx + r * m, cy);
        ctx.arc(cx, cy, r * m, TAU / 2, TAU, false);
    }
    // spokes every 45 degrees, and the base line
    for (let i = 0; i <= 4; i++)
    {
        const a = Math.PI + i * Math.PI / 4;
        ctx.moveTo(cx + Math.cos(a) * r * 0.08, cy + Math.sin(a) * r * 0.08);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();

    // the ping wave
    if (f.sincePing < 700)
    {
        ctx.globalAlpha = 1 - f.sincePing / 700;
        ctx.beginPath();
        ctx.arc(cx, cy, r * f.sincePing / 700, Math.PI, TAU);
        ctx.stroke();
    }

    // the player, a notch pointing up
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.closePath();
    ctx.fill();

    // contacts ahead: those behind are not on the screen, only in the distance below
    const sin = Math.sin(f.pose.yaw);
    const cos = Math.cos(f.pose.yaw);
    for (const b of s.tracker.blips)
    {
        const dx = b.x - f.pose.x;
        const dy = b.y - f.pose.y;
        const side = dx * cos + dy * sin;
        const ahead = dx * sin - dy * cos;
        if (ahead < 0) continue;
        ctx.globalAlpha = Math.max(0, 1 - b.ageMs / TRACKER.blipMs);
        ctx.beginPath();
        ctx.arc(cx + side * k, cy - ahead * k, Math.max(3, r * 0.045), 0, TAU);
        ctx.fill();
    }
    ctx.restore();

    // the readout, over the arc
    const n = s.tracker.nearest;
    const label = n === null ? 'SIN MOVIMIENTO' : `MOVIMIENTO ${String(Math.round(n * METERS_PER_CELL)).padStart(2, '0')} M`;
    ctx.font = `${Math.max(13, Math.round(r * 0.14))}px ${font}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width + 8;
    const ty = cy - r - r * 0.22;
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(6, ty - 2, tw, r * 0.2);
    ctx.fillStyle = ph;
    ctx.fillText(label, 10, ty);
}

/** A blow taken: the four edges light up and fade. Never the whole screen. */
function drawHurt(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, level: number)
{
    ctx.fillStyle = ph;
    ctx.globalAlpha = Math.min(1, level) * 0.7;
    const t = 7;
    ctx.fillRect(0, 0, w, t);
    ctx.fillRect(0, h - t, w, t);
    ctx.fillRect(0, t, t, h - 2 * t);
    ctx.fillRect(w - t, t, t, h - 2 * t);
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

defineExpose({ draw });
</script>

<template>
    <canvas ref="canvas" class="marines-view" />
</template>

<style scoped lang="scss">
.marines-view { display: block; width: 100%; height: 100%; }
</style>
