import { cellAt, mountWall, type Grid, type Sign } from '../isolation/grid';
import { createCamera, depthAlpha, hash, visibleCells, type Face, type Pose, type Shape, type V3 } from '../wire/camera';
import { ALIEN_OUTLINE, ALIEN_TAIL } from '../wire/creature';
import { buildLevel, ventDetail } from '../wire/level';
import { depthBuffer, openSpans } from '../wire/occlusion';
import { ENEMIES, type Enemy } from './enemies';
import type { Spit, Turret } from './defenses';
import type { Acid, Fx, Pickup, Projectile } from './game';
import { HUGGER_BODY, HUGGER_LEGS, HUGGER_TAIL, MARINE_OUTLINE, MARINE_VISOR } from './sprites';
import { forward } from './physics';
import type { Marine } from './squad';

/**
 * First-person wireframe view of an arena, as flat shapes for a canvas. Pure: no DOM. The walls come from the shared
 * `wire` module; the creatures and the marines stand at continuous positions, so each is clipped by a depth buffer to
 * the columns where no nearer wall hides it.
 */

export interface MarinesScene
{
    grid: Grid;
    closed: readonly number[];
    signs: readonly Sign[];
    pickups: readonly Pickup[];
    enemies: readonly Enemy[];
    fx: readonly Fx[];
    /** the squad, the pools of acid and the grenades in flight; none when left out */
    marines?: readonly Marine[];
    acid?: readonly Acid[];
    projectiles?: readonly Projectile[];
    /** per cell, no light: only what the shoulder lamp reaches shows; none when the arena is lit */
    dark?: readonly boolean[];
    turrets?: readonly Turret[];
    spits?: readonly Spit[];
    /** the creature the sights mark (smartgun), which gets brackets round it */
    lockId?: number | null;
    pose: Pose;
    /** vertical offset of the eye (walking bob) */
    bob: number;
    /** ms of game time: animates the creatures' gait */
    time: number;
    /** 0..1, makes the pickups throb */
    pulse: number;
    w: number;
    h: number;
}

/** Cells seen in any direction. The arenas are open, so this is longer than AISLAMIENTO's corridors. */
export const VIEW_CELLS = 9;

/** Cells the shoulder lamp lights around the player in the dark. */
export const LAMP = 3.4;

/** The least a creature fades with distance: it has to stay readable. */
const MIN_ENEMY_ALPHA = 0.5;
/** Where the rounds leave the rifle, in camera space (right, down, forward). */
const MUZZLE: V3 = [0.14, 0.2, 0.3];
/** Size of each creature relative to its sprite box. */
const SCALE = { drone: 0.85, runner: 0.72, hugger: 1, marine: 0.9, spitter: 0.95, queen: 1.55 };

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Something drawn clipped by the walls, with its depth for ordering and the creature it is, if any. */
interface Sprite { d: number; z: number; shapes: Shape[]; lock?: boolean }

export function buildMarinesView(s: MarinesScene): Shape[]
{
    const g = s.grid;
    const camera = createCamera({ pose: s.pose, bob: s.bob, w: s.w, h: s.h });
    const { cam, line, poly, box, distTo, sin, cos } = camera;
    const keep = (xs: (Shape | null)[]): Shape[] => xs.filter((x): x is Shape => x !== null);

    /** A point of a sprite: `u` across the view, `v` from the top of the sprite to the floor, at `scale`, standing at (x, y). */
    const billboard = (x: number, y: number, scale: number, flip = 1, shake = 0, lift = 0) =>
        ([u, v]: [number, number]): V3 => cam(x + cos * (u * scale * flip + shake), y + sin * (u * scale * flip + shake), 0.5 - (0.5 - v) * scale - lift);

    function flames(e: Enemy, at: (p: [number, number]) => V3, alpha: number): Shape[]
    {
        // fire licking up from a burning body: a few short lines that flicker
        const tick = Math.floor(s.time / 70);
        return keep([-0.12, 0, 0.12].map((u, k) =>
        {
            const h = hash(e.id * 17 + k * 5 + tick);
            return line('flame', at([u, -0.3]), at([u + (h % 7 - 3) * 0.02, -0.5 - (h % 5) * 0.03]), alpha);
        }));
    }

    function enemyShapes(e: Enemy, alpha: number): Shape[]
    {
        const def = ENEMIES[e.kind];
        // it faces the way it runs; side on to the camera, mirrored when it runs to the left
        const flip = e.dirX * cos + e.dirY * sin < 0 ? -1 : 1;
        const shake = e.hitMs > 0 ? (hash(e.id * 31 + Math.floor(s.time / 40)) / 997 - 0.5) * 0.08 : 0;
        const out: Shape[] = [];

        if (e.kind === 'hugger')
        {
            // the crouch before the leap: it rises on its legs
            const crouch = e.windMs >= 0 ? 1 - e.windMs / def.windupMs : 0;
            const hop = e.moving ? Math.abs(Math.sin(s.time / 70 + e.id)) * 0.05 : 0;
            const at = billboard(e.x, e.y, SCALE.hugger, flip, shake, hop + crouch * 0.07);
            const ground = billboard(e.x, e.y, SCALE.hugger, flip, shake);
            const body = poly('enemy', HUGGER_BODY.map(at), true, alpha);
            if (body) out.push(body);
            // the legs reach for the floor, spreading as it gets ready
            for (const leg of HUGGER_LEGS)
            {
                const pts = leg.map(([u, v], i) => (i === leg.length - 1 ? ground([u * (1 + crouch * 0.3), v]) : at([u, v])));
                for (let i = 1; i < pts.length; i++)
                {
                    const l = line('enemy', pts[i - 1], pts[i], alpha);
                    if (l) out.push(l);
                }
            }
            for (let i = 1; i < HUGGER_TAIL.length; i++)
            {
                const t = line('enemy', at(HUGGER_TAIL[i - 1]), at(HUGGER_TAIL[i]), alpha);
                if (t) out.push(t);
            }
            if (e.burnMs > 0) out.push(...flames(e, at, alpha));
            return out;
        }

        // the swing back before a blow, so it can be seen coming
        const lunge = e.windMs >= 0 ? 1 + 0.25 * (1 - e.windMs / def.windupMs) : 1;
        const scale = SCALE[e.kind] * lunge;
        const pace = e.kind === 'runner' ? 55 : 90;
        const gait = e.moving ? -Math.abs(Math.sin(s.time / pace + e.id)) * (e.kind === 'runner' ? 0.07 : 0.04) : 0;
        const at = billboard(e.x, e.y, scale, flip, shake, -gait);
        const body = poly('enemy', ALIEN_OUTLINE.map(at), true, alpha);
        if (body) out.push(body);
        for (let i = 1; i < ALIEN_TAIL.length; i++)
        {
            const t = line('enemy', at(ALIEN_TAIL[i - 1]), at(ALIEN_TAIL[i]), alpha);
            if (t) out.push(t);
        }
        // the spitter carries its acid in a sac on the chest, which glows brighter as it winds up
        if (e.kind === 'spitter')
        {
            const heat = e.windMs >= 0 ? 0.6 + 0.4 * (1 - e.windMs / def.windupMs) : 0.6;
            const sac = poly('acid', ([[0, -0.08], [0.07, 0.03], [0, 0.14], [-0.07, 0.03]] as [number, number][]).map(at), true, alpha * heat);
            if (sac) out.push(sac);
        }
        // the queen's crest: a fan of spines swept back from her head
        if (e.kind === 'queen')
        {
            for (const [u, v] of [[0.12, -0.5], [0.2, -0.46], [0.28, -0.4]] as [number, number][])
            {
                const l = line('enemy', at([u * 0.4, -0.3]), at([u, v]), alpha);
                if (l) out.push(l);
            }
        }
        if (e.burnMs > 0) out.push(...flames(e, at, alpha));
        return out;
    }

    function marineShapes(m: Marine, alpha: number): Shape[]
    {
        const shake = m.hitMs > 0 ? (hash(m.id * 31 + Math.floor(s.time / 40)) / 997 - 0.5) * 0.06 : 0;
        const stride = m.moving ? -Math.abs(Math.sin(s.time / 110 + m.id)) * 0.025 : 0;
        const at = billboard(m.x, m.y, SCALE.marine, 1, shake, -stride);
        const out: Shape[] = [];
        const body = poly('marine', MARINE_OUTLINE.map(at), true, alpha);
        if (body) out.push(body);
        const visor = line('marine', at(MARINE_VISOR[0]), at(MARINE_VISOR[1]), alpha);
        if (visor) out.push(visor);
        // the rifle, held across the chest and pointing the way it aims: drawn in the map, so it foreshortens
        const chest = 0.5 - 0.5 * SCALE.marine;
        const gun = line('marine', cam(m.x - m.dirX * 0.1, m.y - m.dirY * 0.1, chest), cam(m.x + m.dirX * 0.42, m.y + m.dirY * 0.42, chest - 0.02), alpha);
        if (gun) out.push(gun);
        if (m.flashMs < 70)
        {
            const tip = cam(m.x + m.dirX * 0.46, m.y + m.dirY * 0.46, chest - 0.02);
            const r = 0.07;
            for (const [dx, dy] of [[r, 0], [0, r], [r * 0.7, r * 0.7], [r * 0.7, -r * 0.7]])
            {
                const l = line('muzzle', [tip[0] - dx, tip[1] - dy, tip[2]], [tip[0] + dx, tip[1] + dy, tip[2]], alpha * (1 - m.flashMs / 70));
                if (l) out.push(l);
            }
        }
        return out;
    }

    /** A ring of acid on the floor, thickening and flickering a little while it lasts, fading as it dries. */
    function acidShapes(a: Acid): Shape[]
    {
        const fade = Math.min(1, a.ms / 1500);
        const wobble = 1 + 0.08 * Math.sin(s.time / 130 + a.x * 7 + a.y * 3);
        const ring = (r: number) => Array.from({ length: 10 }, (_, k): V3 =>
            cam(a.x + Math.cos(k * Math.PI / 5) * r * wobble, a.y + Math.sin(k * Math.PI / 5) * r * wobble, 0.5));
        return keep([poly('acid', ring(a.r), false, 0.75 * fade), poly('acid', ring(a.r * 0.45), false, 0.55 * fade)]);
    }

    /** A sentry turret: a squat block with its gun pointing the way it aims; it flashes when it fires. */
    function turretShapes(t: Turret, alpha: number): Shape[]
    {
        const r = 0.12;
        const out = box([[t.x - r, t.y - r], [t.x + r, t.y - r], [t.x + r, t.y + r], [t.x - r, t.y + r]], 0.3, 0.5, 'marine', alpha);
        const [dx, dy] = forward(t.yaw);
        const spent = t.ammo <= 0 ? 0.45 : 1;
        const gun = line('marine', cam(t.x, t.y, 0.26), cam(t.x + dx * 0.34, t.y + dy * 0.34, 0.26), alpha * spent);
        const flash = t.flashMs < 60 ? line('muzzle', cam(t.x + dx * 0.34, t.y + dy * 0.34, 0.26), cam(t.x + dx * 0.5, t.y + dy * 0.5, 0.26), alpha * (1 - t.flashMs / 60)) : null;
        return keep([...out, gun, flash]);
    }

    /** Acid in the air: a bright dot on an arc, and a ring on the floor that closes in on where it will land. */
    function spitShapes(sp: Spit): { air: Shape[]; mark: Shape[] }
    {
        const k = 1 - sp.ms / sp.totalMs;
        const x = sp.x + (sp.tx - sp.x) * k;
        const y = sp.y + (sp.ty - sp.y) * k;
        const z = 0.5 - (0.14 + 0.5 * 4 * k * (1 - k));
        const r = 0.05;
        const c = cam(x, y, z);
        const air = keep([
            line('acid', [c[0] - r, c[1], c[2]], [c[0] + r, c[1], c[2]], 1),
            line('acid', [c[0], c[1] - r, c[2]], [c[0], c[1] + r, c[2]], 1),
        ]);
        const ring = (rad: number) => Array.from({ length: 10 }, (_, i): V3 => cam(sp.tx + Math.cos(i * Math.PI / 5) * rad, sp.ty + Math.sin(i * Math.PI / 5) * rad, 0.5));
        return { air, mark: keep([poly('acid', ring(0.8 - 0.3 * k), false, 0.35 + 0.5 * k)]) };
    }

    function projectileShapes(pr: Projectile): Shape[]
    {
        // a bright dot with a short streak behind it
        const p = cam(pr.x, pr.y, 0.1);
        const tail = cam(pr.x - pr.dx * 0.5, pr.y - pr.dy * 0.5, 0.1);
        const r = 0.05;
        return keep([
            line('blast', p, tail, 1),
            line('blast', [p[0] - r, p[1], p[2]], [p[0] + r, p[1], p[2]], 1),
            line('blast', [p[0], p[1] - r, p[2]], [p[0], p[1] + r, p[2]], 1),
        ]);
    }

    function fxShapes(f: Fx): Shape[]
    {
        const a = f.ageMs / f.lifeMs;
        const out: (Shape | null)[] = [];
        if (f.kind === 'tracer' || f.kind === 'beam')
        {
            // a dash that travels from the muzzle (the marine's chest, for a beam) out to where the round landed
            const to = cam(f.x2, f.y2, f.kind === 'beam' ? 0.04 : 0);
            const from: V3 = f.kind === 'beam' ? cam(f.x, f.y, 0.04) : MUZZLE;
            const head = Math.min(1, 0.15 + 1.4 * a);
            out.push(line('tracer', lerp3(from, to, Math.max(0, head - 0.3)), lerp3(from, to, head), 1 - a * 0.6));
        }
        else if (f.kind === 'spark')
        {
            // a small star at the impact, facing the camera
            const p = cam(f.x2, f.y2, 0);
            const r = 0.05 + 0.1 * a;
            const k = r * 0.7;
            for (const [dx, dy] of [[r, 0], [0, r], [k, k], [k, -k]])
                out.push(line('muzzle', [p[0] - dx, p[1] - dy, p[2]], [p[0] + dx, p[1] + dy, p[2]], 1 - a));
        }
        else if (f.kind === 'flame')
        {
            // tongues of fire from the muzzle to the tip, fanning out as they go
            const len = Math.hypot(f.x2 - f.x, f.y2 - f.y);
            if (len < 0.01) return [];
            const px = -(f.y2 - f.y) / len;
            const py = (f.x2 - f.x) / len;
            const head = Math.min(1, 0.5 + 1.6 * a);
            const tick = Math.floor(f.ageMs / 40);
            for (let k = 0; k < 5; k++)
            {
                const t = (k - 2) / 2;
                const h = hash(Math.floor(f.x * 100) + Math.floor(f.y * 100) + k * 13 + tick) / 997;
                // a tongue ends spread across the cone, a little different each moment
                const side = t * len * 0.26 * (0.7 + 0.3 * h);
                const to = cam(f.x2 + px * side, f.y2 + py * side, 0.12 - Math.abs(t) * 0.05);
                const mid = cam(f.x + (f.x2 - f.x) * 0.5 * head + px * side * 0.3, f.y + (f.y2 - f.y) * 0.5 * head + py * side * 0.3, 0.14);
                out.push(line('flame', MUZZLE, mid, 1 - a * 0.5), line('flame', mid, lerp3(mid, to, head), 1 - a * 0.7));
            }
        }
        else if (f.kind === 'blast')
        {
            // a ring of fire that grows out to the blast's radius while it sinks, with spokes through it
            const R = (f.r ?? 2) * (0.25 + 0.75 * Math.min(1, a * 2.2));
            const hh = 0.35 - 0.2 * a;
            const n = 14;
            for (let k = 0; k < n; k++)
            {
                const a0 = k * 2 * Math.PI / n;
                const a1 = (k + 1) * 2 * Math.PI / n;
                out.push(line('blast', cam(f.x + Math.cos(a0) * R, f.y + Math.sin(a0) * R, hh), cam(f.x + Math.cos(a1) * R, f.y + Math.sin(a1) * R, hh), 1 - a));
                if (k % 2 === 0) out.push(line('blast', cam(f.x, f.y, hh + 0.1), cam(f.x + Math.cos(a0) * R, f.y + Math.sin(a0) * R, hh), (1 - a) * 0.7));
            }
        }
        else
        {
            // a burst where a creature fell, falling to the floor
            const hh = 0.15 + 0.35 * a;
            for (let k = 0; k < 8; k++)
            {
                const ang = k * Math.PI / 4;
                const r0 = 0.1 + 0.45 * a;
                out.push(line('blast', cam(f.x + Math.cos(ang) * r0, f.y + Math.sin(ang) * r0, hh), cam(f.x + Math.cos(ang) * (r0 + 0.18), f.y + Math.sin(ang) * (r0 + 0.18), hh - 0.05), 1 - a));
            }
        }
        return keep(out);
    }

    /** What lies on the floor: supplies, grenades and the weapon crates. */
    function pickupDetail(kind: Pickup['kind'], f: Face, al: number): (Shape | null)[]
    {
        switch (kind)
        {
            // a magazine: stripes
            case 'ammo': return [f.line('item', 0.15, 0.3, 0.85, 0.3, al), f.line('item', 0.15, 0.55, 0.85, 0.55, al), f.line('item', 0.15, 0.8, 0.85, 0.8, al)];
            // a medical kit: a cross
            case 'medkit': return [f.line('item', 0.5, 0.15, 0.5, 0.85, al), f.line('item', 0.15, 0.5, 0.85, 0.5, al)];
            // a grenade: a diamond
            case 'grenade': return [
                f.line('item', 0.5, 0.12, 0.88, 0.5, al), f.line('item', 0.88, 0.5, 0.5, 0.88, al),
                f.line('item', 0.5, 0.88, 0.12, 0.5, al), f.line('item', 0.12, 0.5, 0.5, 0.12, al),
            ];
            // a crate: braced with a cross, and a bar across it that tells them apart
            default: return [
                f.line('item', 0.08, 0.08, 0.92, 0.92, al), f.line('item', 0.92, 0.08, 0.08, 0.92, al),
                kind === 'shotgun' ? f.line('item', 0.08, 0.5, 0.92, 0.5, al)
                    : kind === 'smartgun' ? f.line('item', 0.5, 0.08, 0.5, 0.92, al)
                        : f.line('item', 0.08, 0.3, 0.92, 0.3, al),
            ];
        }
    }

    const cells = visibleCells(g, s.closed, s.pose, VIEW_CELLS);
    if (!cells) return [];

    const pickupAt = new Map<number, Pickup>();
    for (const p of s.pickups) if (!p.taken) pickupAt.set(p.cell, p);

    const level = buildLevel({
        grid: g, closed: s.closed, signs: s.signs, camera, cells, viewDepth: VIEW_CELLS,
        // in the dark only the lamp's pool shows, fading towards its edge
        light: (c) =>
        {
            if (!s.dark?.[c]) return 1;
            const d = distTo((c % g.w) + 0.5, Math.floor(c / g.w) + 0.5);
            return d > LAMP ? null : 1 - 0.65 * d / LAMP;
        },
        wall: (c, dir, f, fa) => cellAt(g, c) === 'vent' && dir === mountWall(g, s.closed, c) ? ventDetail(f, fa) : null,
        stand: (c, alpha, add) =>
        {
            const p = pickupAt.get(c);
            if (!p) return;
            const cx = (c % g.w) + 0.5;
            const cy = Math.floor(c / g.w) + 0.5;
            // a weapon crate is bigger than the small things
            const crate = p.kind === 'shotgun' || p.kind === 'smartgun' || p.kind === 'flamer';
            const r = crate ? 0.17 : 0.11;
            const a = alpha * (0.6 + 0.4 * s.pulse);
            add(distTo(cx, cy), box([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], crate ? 0.2 : 0.26, 0.5, 'item', a, (f, al) => pickupDetail(p.kind, f, al)));
        },
    });

    // pools, marines and creatures: far to near, each clipped to the columns where it is in front of the walls
    const marines = (s.marines ?? []).filter(m => m.hp > 0);
    const pools = s.acid ?? [];
    const sprites: Sprite[] = [];
    // the pools lie on the floor: they go first, under whatever stands on them
    /** In the dark a thing is seen only inside the lamp's reach. */
    const seen = (x: number, y: number) => !s.dark?.[Math.floor(y) * g.w + Math.floor(x)] || distTo(x, y) <= LAMP;
    for (const a of pools) if (seen(a.x, a.y)) sprites.push({ d: 1e9, z: cam(a.x, a.y, 0)[2], shapes: acidShapes(a) });
    for (const e of s.enemies)
    {
        // one on the player's face is drawn by the screen, not here
        if (e.clung || !seen(e.x, e.y)) continue;
        const d = distTo(e.x, e.y);
        sprites.push({ d, z: cam(e.x, e.y, 0)[2], shapes: enemyShapes(e, Math.max(MIN_ENEMY_ALPHA, depthAlpha(d, VIEW_CELLS))), lock: e.id === s.lockId });
    }
    for (const m of marines)
    {
        if (!seen(m.x, m.y)) continue;
        const d = distTo(m.x, m.y);
        sprites.push({ d, z: cam(m.x, m.y, 0)[2], shapes: marineShapes(m, Math.max(MIN_ENEMY_ALPHA, depthAlpha(d, VIEW_CELLS))) });
    }
    for (const t of s.turrets ?? [])
    {
        const d = distTo(t.x, t.y);
        sprites.push({ d, z: cam(t.x, t.y, 0)[2], shapes: turretShapes(t, Math.max(MIN_ENEMY_ALPHA, depthAlpha(d, VIEW_CELLS))) });
    }
    for (const sp of s.spits ?? [])
    {
        const shapes = spitShapes(sp);
        sprites.push({ d: 1e9, z: cam(sp.tx, sp.ty, 0)[2], shapes: shapes.mark });
        sprites.push({ d: distTo(sp.x + (sp.tx - sp.x) * (1 - sp.ms / sp.totalMs), sp.y + (sp.ty - sp.y) * (1 - sp.ms / sp.totalMs)), z: cam(sp.x, sp.y, 0)[2], shapes: shapes.air });
    }
    for (const pr of s.projectiles ?? []) sprites.push({ d: distTo(pr.x, pr.y), z: cam(pr.x, pr.y, 0)[2], shapes: projectileShapes(pr) });
    sprites.sort((p, q) => q.d - p.d);

    const buffer = sprites.length ? depthBuffer(g, s.closed, s.pose, s.w, Math.min(180, Math.floor(s.w / 2)), VIEW_CELLS + 2) : null;
    const clipped: Shape[] = [];
    for (const sp of sprites)
    {
        if (sp.z < 0.1 || !sp.shapes.length || !buffer) continue;
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (const sh of sp.shapes)
            if (sh.kind !== 'text')
                for (let i = 0; i < sh.pts.length; i += 2)
                {
                    x0 = Math.min(x0, sh.pts[i]);
                    x1 = Math.max(x1, sh.pts[i]);
                    y0 = Math.min(y0, sh.pts[i + 1]);
                    y1 = Math.max(y1, sh.pts[i + 1]);
                }
        // a little slack: the centre is never closer to a wall than the body is wide
        const spans = openSpans(buffer, x0, x1, sp.z - 0.1);
        if (!spans.length) continue;
        for (const sh of sp.shapes) if (sh.kind !== 'text') clipped.push({ ...sh, clip: spans });
        if (sp.lock) clipped.push(...brackets(x0, y0, x1, y1, spans));
    }

    return [...level, ...clipped, ...s.fx.flatMap(fxShapes)];
}

/** Four corner brackets round a box on the screen, the smartgun's mark on its target. */
function brackets(x0: number, y0: number, x1: number, y1: number, clip: readonly number[]): Shape[]
{
    const pad = 5;
    const left = x0 - pad;
    const right = x1 + pad;
    const top = y0 - pad;
    const bottom = y1 + pad;
    const l = Math.max(5, Math.min(14, (right - left) * 0.3));
    const corner = (pts: number[]): Shape => ({ kind: 'line', tag: 'muzzle', pts, alpha: 1, clip });
    return [
        corner([left, top + l, left, top, left + l, top]),
        corner([right - l, top, right, top, right, top + l]),
        corner([left, bottom - l, left, bottom, left + l, bottom]),
        corner([right - l, bottom, right, bottom, right, bottom - l]),
    ];
}
