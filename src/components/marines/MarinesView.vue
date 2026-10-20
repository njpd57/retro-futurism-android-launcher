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
type V3 = [number, number, number];
/** A box of the weapon: x0, x1, y0, y1, z0, z1 in metres from the bore axis (x right, y down, z forward). */
type Cuboid = [number, number, number, number, number, number];
/** The drawing of a weapon, far to near: `box` is a solid block, `lines` are loose strokes on it at an opacity. */
type Op = { box: Cuboid } | { lines: [number, number, number, number, number, number][]; alpha?: number };

interface Art
{
    ops: Op[];
    /** where the round counter sits on the weapon, and where the muzzle flash starts */
    counter: V3;
    muzzle: V3;
    /** where a grenade leaves (the launcher under the barrel), if it has one */
    launcher?: V3;
    /** how big the flash is and how hard the weapon kicks, against the rifle's 1 */
    flash: number;
    kick: number;
}

/**
 * Every weapon as it is held: seen from behind and to the right, pointing at the middle of the view, the way the
 * hands carry it in a shooter. Coordinates are from the bore axis, which the carry offset then moves to the lower
 * right; +x is to the right, +y down and +z forward. The barrel runs away from the viewer and so shortens in
 * perspective, with the front sight just under the crosshair.
 */
const ART: Record<WeaponId, Art> = {
    // the barrel with its flash hider, the launcher under the handguard, the receiver with the carrying handle and
    // the sight, the magazine and the pistol grip
    rifle: {
        counter: [-0.046, 0.0, 0.26], muzzle: [0, 0, 1.08], launcher: [0, 0.058, 0.8], flash: 1, kick: 1,
        ops: [
            { box: [-0.012, 0.012, -0.012, 0.012, 0.62, 1.0] },
            { box: [-0.02, 0.02, -0.02, 0.02, 1.0, 1.08] },
            { box: [-0.004, 0.004, -0.04, -0.012, 0.95, 0.97] },
            { box: [-0.03, 0.03, 0.04, 0.075, 0.42, 0.8] },
            { box: [-0.04, 0.04, -0.03, 0.035, 0.36, 0.64] },
            { lines: Array.from({ length: 6 }, (_, i): [number, number, number, number, number, number] => { const z = 0.4 + i * 0.04; return [-0.04, -0.015, z, -0.04, 0.02, z]; }), alpha: 0.6 },
            { box: [-0.025, 0.025, 0.05, 0.15, 0.22, 0.3] },
            { box: [-0.02, 0.02, 0.05, 0.13, 0.12, 0.17] },
            { box: [-0.045, 0.045, -0.05, 0.05, 0.12, 0.38] },
            { box: [-0.02, 0.02, -0.085, -0.05, 0.12, 0.34] },
            { box: [-0.004, 0.004, -0.115, -0.085, 0.3, 0.32] },
        ],
    },
    // a long barrel over the magazine tube, the pump under it, a bead at the end
    shotgun: {
        counter: [-0.042, 0.0, 0.27], muzzle: [0, -0.02, 1.02], flash: 1.8, kick: 2.2,
        ops: [
            { box: [-0.014, 0.014, -0.034, -0.006, 0.4, 1.0] },
            { box: [-0.004, 0.004, -0.046, -0.034, 0.98, 1.0] },
            { box: [-0.012, 0.012, 0.006, 0.03, 0.4, 0.95] },
            { box: [-0.03, 0.03, 0.0, 0.05, 0.55, 0.75] },
            { lines: Array.from({ length: 4 }, (_, i): [number, number, number, number, number, number] => { const z = 0.58 + i * 0.04; return [-0.03, 0.005, z, -0.03, 0.045, z]; }), alpha: 0.6 },
            { box: [-0.02, 0.02, 0.05, 0.13, 0.14, 0.19] },
            { box: [-0.04, 0.04, -0.04, 0.05, 0.14, 0.4] },
        ],
    },
    // heavy: the body, the ammunition box under it, the sensor on top and the gimbal arm out in front
    smartgun: {
        counter: [-0.062, 0.0, 0.3], muzzle: [0, 0, 1.06], flash: 0.8, kick: 0.5,
        ops: [
            { box: [-0.02, 0.02, -0.02, 0.02, 0.95, 1.05] },
            { box: [-0.03, 0.03, -0.03, 0.03, 0.75, 0.95] },
            { lines: Array.from({ length: 4 }, (_, i): [number, number, number, number, number, number] => { const z = 0.78 + i * 0.045; return [-0.03, -0.02, z, -0.03, 0.02, z]; }), alpha: 0.6 },
            { box: [-0.03, 0.03, -0.03, 0.03, 0.5, 0.75] },
            { box: [-0.05, 0.05, 0.06, 0.14, 0.2, 0.45] },
            { box: [-0.03, 0.03, -0.09, -0.05, 0.2, 0.45] },
            { box: [-0.06, 0.06, -0.05, 0.06, 0.15, 0.5] },
        ],
    },
    // a nozzle with a pilot light at its tip, a hose back to the tank, a guard over the trigger
    flamer: {
        counter: [-0.04, 0.0, 0.25], muzzle: [0, 0, 1.04], flash: 0, kick: 0.3,
        ops: [
            { lines: [[-0.03, 0.04, 0.2, -0.16, 0.2, 0.12], [-0.03, 0.05, 0.22, -0.15, 0.22, 0.14]], alpha: 0.8 },
            { box: [-0.015, 0.015, -0.015, 0.015, 0.4, 0.96] },
            { lines: [[-0.015, -0.015, 0.6, -0.015, 0.015, 0.6], [-0.015, -0.015, 0.8, -0.015, 0.015, 0.8]], alpha: 0.7 },
            { box: [-0.025, 0.025, -0.025, 0.025, 0.96, 1.03] },
            { box: [-0.02, 0.02, 0.04, 0.12, 0.15, 0.2] },
            { box: [-0.035, 0.035, -0.04, 0.04, 0.14, 0.4] },
        ],
    },
};

/** Where the bore axis is carried, from the eye: to the right and down, so the barrel points at the middle of the view. */
const CARRY = { x: 0.085, y: 0.15 };
/** The parts are drawn at this share of their size and pushed this far from the eye, so the weapon stays slim and the back of it is not huge. */
const FIT = { scale: 0.75, push: 0.18 };

/**
 * The weapon in hand, drawn in perspective from behind it. Its parts are blocks, far to near; each block shows the
 * faces that look at the eye. The round counter is an inverse-video block on the side of the receiver.
 */
function drawWeapon(ctx: CanvasRenderingContext2D, w: number, h: number, ph: string, bg: string, font: string, p: Player, f: Frame)
{
    const art = ART[p.weapon];
    const k = Math.max(0, 1 - p.firedMs / 90) * art.kick;
    // the launcher under the barrel kicks when a grenade leaves
    const launch = Math.max(0, 1 - p.launchMs / 180);
    // recoil kicks it back and up; walking sways it
    const sway = f.reduced ? 0 : p.moveAmt;
    const dx = CARRY.x + Math.sin(f.now / 180) * sway * 0.006;
    const dy = CARRY.y - k * 0.012 + launch * 0.01 + Math.abs(Math.cos(f.now / 180)) * sway * 0.005;
    const dz = -k * 0.03 - launch * 0.015;
    const focal = w * 0.62;
    const cx = w / 2;
    const cy = h / 2;
    const project = (x: number, y: number, z: number): Pt =>
    {
        const zz = Math.max(0.05, z + FIT.push + dz);
        return [cx + (x * FIT.scale + dx) / zz * focal, cy + (y * FIT.scale + dy) / zz * focal];
    };
    const sx = (x: number) => x * FIT.scale + dx;
    const sy = (y: number) => y * FIT.scale + dy;

    const trace = (pts: Pt[]) =>
    {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
    };
    /** A face: filled with the background so what is behind it doesn't show, outlined with a soft stroke under a thin one. */
    const face = (pts: Pt[]) =>
    {
        trace(pts);
        ctx.globalAlpha = 1;
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = ph;
        ctx.globalAlpha = 0.25 * settings.bloom;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4;
        ctx.stroke();
    };
    const block = ([x0, x1, y0, y1, z0, z1]: Cuboid) =>
    {
        const P = (x: number, y: number, z: number) => project(x, y, z);
        // the faces that look at the eye, which sits at the origin: the side nearer to it, the top if it is below the
        // eye line, and always the back. Painted far to near so they cover each other right.
        if (sy(y1) < 0) face([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)]);
        if (sx(x1) < 0) face([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)]);
        if (sx(x0) > 0) face([P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)]);
        if (sy(y0) > 0) face([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)]);
        face([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)]);
    };
    const strokes = (segs: [number, number, number, number, number, number][], alpha = 0.75) =>
    {
        ctx.beginPath();
        for (const [x0, y0, z0, x1, y1, z1] of segs)
        {
            const a = project(x0, y0, z0);
            const b = project(x1, y1, z1);
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
        }
        ctx.strokeStyle = ph;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    for (const op of art.ops)
    {
        if ('box' in op) block(op.box);
        else strokes(op.lines, op.alpha);
    }

    // the round counter, upright so that it can be read, on the side of the receiver
    const [cxs, cys] = project(...art.counter);
    const size = Math.max(13, Math.round(h * 0.03));
    ctx.font = `${size}px ${font}`;
    const text = String(p.mag).padStart(2, '0');
    const bw = ctx.measureText(text).width + 8;
    ctx.globalAlpha = 1;
    ctx.fillStyle = ph;
    ctx.fillRect(cxs - bw / 2, cys - size * 0.5, bw, size);
    ctx.fillStyle = bg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cxs, cys + 1);

    ctx.strokeStyle = ph;
    ctx.lineWidth = 1.6;
    // the muzzle flash: small, and only while a round leaves
    if (art.flash > 0 && p.firedMs < 55)
    {
        const [mx, my] = project(...art.muzzle);
        ctx.globalAlpha = 1 - p.firedMs / 55;
        const spin = Math.floor(f.now / 40) * 0.7;
        ctx.beginPath();
        for (let i = 0; i < 6; i++)
        {
            const a = spin + i * TAU / 6;
            const len = (9 + (i % 2) * 8) * art.flash;
            ctx.moveTo(mx + Math.cos(a) * 3, my + Math.sin(a) * 3);
            ctx.lineTo(mx + Math.cos(a) * len, my + Math.sin(a) * len);
        }
        ctx.stroke();
    }
    // the flamethrower's pilot light, always lit and always flickering
    if (p.weapon === 'flamer')
    {
        const [mx, my] = project(art.muzzle[0], art.muzzle[1], art.muzzle[2] + 0.02);
        const flick = f.reduced ? 0.5 : (Math.sin(f.now / 55) + Math.sin(f.now / 83) + 2) / 4;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - 3 - flick * 5, my - 2);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - 2 - flick * 4, my - 5 - flick * 3);
        ctx.stroke();
    }
    // a grenade leaving the launcher under the barrel
    if (art.launcher && p.launchMs < 90)
    {
        const [mx, my] = project(...art.launcher);
        ctx.globalAlpha = 1 - p.launchMs / 90;
        ctx.beginPath();
        for (let i = 0; i < 5; i++)
        {
            const a = i * TAU / 5 + f.now / 60;
            ctx.moveTo(mx + Math.cos(a) * 3, my + Math.sin(a) * 3);
            ctx.lineTo(mx + Math.cos(a) * 11, my + Math.sin(a) * 11);
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
