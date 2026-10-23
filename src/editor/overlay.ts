import type { ShipData } from '@/ship3d/shipData';
import { centroid, type V2 } from '@/ship3d/world';
import { isHall } from '@/ship3d/zones';
import { nearestEdge } from './geometry';
import type { Scene } from './scene';
import { same, type Sel } from './selection';
import type { PlanView } from './view';

/** Which layers are drawn. */
export interface Layers { grid: boolean; names: boolean; lamps: boolean; points: boolean; issues: boolean }

export interface Marker { x: number; y: number; text: string; level: 'error' | 'warn' }

const f = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function pts(view: PlanView, poly: readonly V2[]) { return poly.map(p => view.toScreen(p[0], p[1]).map(f).join(',')).join(' '); }

function gridLines(view: PlanView): string
{
    const [x0, y0] = view.toWorld(0, 0);
    const [x1, y1] = view.toWorld(view.width, view.height);
    const step = view.scale >= 30 ? 1 : view.scale >= 8 ? 5 : 10;
    let out = '';
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step)
    {
        const [sx] = view.toScreen(x, 0);
        out += `<line class="g${x % 10 === 0 ? ' g10' : ''}" x1="${f(sx)}" y1="0" x2="${f(sx)}" y2="${view.height}"/>`;
        if (x % 10 === 0) out += `<text class="gl" x="${f(sx + 3)}" y="11">${x}</text>`;
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step)
    {
        const [, sy] = view.toScreen(0, y);
        out += `<line class="g${y % 10 === 0 ? ' g10' : ''}" x1="0" y1="${f(sy)}" x2="${view.width}" y2="${f(sy)}"/>`;
        if (y % 10 === 0) out += `<text class="gl" x="3" y="${f(sy - 3)}">${y}</text>`;
    }
    return out;
}

const handle = (view: PlanView, x: number, y: number, kind: string, extra = '', cls = '') =>
{
    const [sx, sy] = view.toScreen(x, y);
    return `<circle class="h ${cls}" data-h="${kind}" ${extra} cx="${f(sx)}" cy="${f(sy)}" r="6"/>`;
};

/** The SVG drawn over the GL view: outlines, markers and the handles of the selection. */
export function overlaySvg(scene: Scene, data: ShipData, view: PlanView, sel: Sel | null, layers: Layers, markers: Marker[]): string
{
    let out = layers.grid ? gridLines(view) : '';
    const polys = scene.rooms.map(r => r.poly);

    // rooms: the body is a hit target under everything else
    scene.rooms.forEach((r, i) =>
    {
        const on = same(sel, { t: 'room', i });
        const [mx] = centroid(r.poly);
        const [cx] = view.toScreen(mx, 0);
        const cy = view.toScreen(0, Math.min(...r.poly.map(p => p[1])))[1] + 16;
        out += `<polygon class="room${isHall(r.zone) ? ' corr' : ''}${on ? ' sel' : ''}" data-t="room" data-i="${i}" points="${pts(view, r.poly)}"/>`;
        if (layers.names && !isHall(r.zone)) out += `<text class="nm" x="${f(cx)}" y="${f(cy)}">${esc(r.name)}</text>`;
    });

    // props
    for (const { entry, prop, outline } of scene.props)
    {
        const on = sel?.t === 'prop' && sel.i === entry;
        out += `<polygon class="prop${prop.solid ? '' : ' soft'}${prop.glow > 0 ? ' glow' : ''}${on ? ' sel' : ''}" data-t="prop" data-i="${entry}" points="${pts(view, outline)}"/>`;
    }

    // screens: a bar on the wall and a tick toward where they look
    scene.screens.forEach((s, i) =>
    {
        const nx = Math.sin(s.yaw);
        const ny = -Math.cos(s.yaw);
        const a = view.toScreen(s.x - ny * (s.w / 2), s.y + nx * (s.w / 2));
        const b = view.toScreen(s.x + ny * (s.w / 2), s.y - nx * (s.w / 2));
        const t = view.toScreen(s.x + nx * 0.7, s.y + ny * 0.7);
        const m = view.toScreen(s.x, s.y);
        const on = same(sel, { t: 'screen', i });
        out += `<g class="scr${on ? ' sel' : ''}"><line class="hit" data-t="screen" data-i="${i}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`
            + `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/><line x1="${f(m[0])}" y1="${f(m[1])}" x2="${f(t[0])}" y2="${f(t[1])}"/></g>`;
    });

    // doorways: a bar along the wall they cut
    scene.portals.forEach((p, i) =>
    {
        const e = nearestEdge(polys, p.x, p.y);
        let dx = 1;
        let dy = 0;
        let bad = true;
        if (e && e.d < 0.06)
        {
            const poly = polys[e.room];
            const a = poly[e.edge];
            const b = poly[(e.edge + 1) % poly.length];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            dx = (b[0] - a[0]) / len;
            dy = (b[1] - a[1]) / len;
            bad = false;
        }
        const a = view.toScreen(p.x - (dx * p.width) / 2, p.y - (dy * p.width) / 2);
        const b = view.toScreen(p.x + (dx * p.width) / 2, p.y + (dy * p.width) / 2);
        const on = same(sel, { t: 'portal', i });
        out += `<g class="por${bad ? ' bad' : ''}${on ? ' sel' : ''}"><line class="hit" data-t="portal" data-i="${i}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`
            + `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/></g>`;
    });

    // lights
    if (layers.lamps)
        for (const l of scene.lights)
        {
            const [sx, sy] = view.toScreen(l.x, l.y);
            out += `<circle class="lamp" cx="${f(sx)}" cy="${f(sy)}" r="2"/>`;
        }
    data.extraLights.forEach((l, i) =>
    {
        const [sx, sy] = view.toScreen(l.x, l.y);
        out += `<circle class="lt${same(sel, { t: 'light', i }) ? ' sel' : ''}" data-t="light" data-i="${i}" cx="${f(sx)}" cy="${f(sy)}" r="7"/>`;
    });

    // points the crew uses
    if (layers.points)
    {
        for (const [room, p] of Object.entries(data.stands))
        {
            const [sx, sy] = view.toScreen(p[0], p[1]);
            out += `<path class="pt${same(sel, { t: 'stand', room }) ? ' sel' : ''}" data-t="stand" data-room="${room}" d="M${f(sx)},${f(sy - 7)}L${f(sx + 7)},${f(sy)}L${f(sx)},${f(sy + 7)}L${f(sx - 7)},${f(sy)}Z"/>`;
        }
        for (const [room, list] of Object.entries(data.vias))
            list.forEach((p, i) =>
            {
                const [sx, sy] = view.toScreen(p[0], p[1]);
                out += `<path class="pt via${same(sel, { t: 'via', room, i }) ? ' sel' : ''}" data-t="via" data-room="${room}" data-i="${i}" d="M${f(sx - 4)},${f(sy - 4)}L${f(sx + 4)},${f(sy + 4)}M${f(sx + 4)},${f(sy - 4)}L${f(sx - 4)},${f(sy + 4)}"/>`;
            });
        data.signalSlots.forEach((p, i) =>
        {
            const [sx, sy] = view.toScreen(p.x, p.y);
            const [tx, ty] = view.toScreen(p.x + Math.sin(p.yaw) * 0.7, p.y - Math.cos(p.yaw) * 0.7);
            out += `<g class="pt${same(sel, { t: 'signal', i }) ? ' sel' : ''}"><circle data-t="signal" data-i="${i}" cx="${f(sx)}" cy="${f(sy)}" r="5"/><line x1="${f(sx)}" y1="${f(sy)}" x2="${f(tx)}" y2="${f(ty)}"/></g>`;
        });
    }

    // handles of the selection
    if (sel?.t === 'room')
    {
        const poly = scene.rooms[sel.i]?.poly ?? [];
        poly.forEach((p, v) => { out += handle(view, p[0], p[1], 'vertex', `data-v="${v}"`); });
        poly.forEach((p, v) =>
        {
            const q = poly[(v + 1) % poly.length];
            if (Math.hypot(q[0] - p[0], q[1] - p[1]) * view.scale > 30) out += handle(view, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 'edge', `data-v="${v}"`, 'mid');
        });
    }
    if (sel?.t === 'prop')
    {
        const e = data.props[sel.i];
        if (e && 'prefab' in e)
        {
            const yaw = e.yaw ?? 0;
            out += handle(view, e.x + Math.sin(yaw) * 1.6, e.y - Math.cos(yaw) * 1.6, 'rotate', '', 'rot');
        }
        else if (e && !('gen' in e))
        {
            const yaw = e.yaw ?? 0;
            const c = Math.cos(yaw);
            const s = Math.sin(yaw);
            const d = e.kind === 'box' ? e.d ?? e.w : e.w;
            out += handle(view, e.x + (e.w / 2) * c, e.y + (e.w / 2) * s, 'size-w');
            if (e.kind === 'box') out += handle(view, e.x - (d / 2) * s, e.y + (d / 2) * c, 'size-d');
            if (e.kind === 'box') out += handle(view, e.x + s * (d / 2 + 0.9), e.y - c * (d / 2 + 0.9), 'rotate', '', 'rot');
        }
    }

    // problems
    if (layers.issues)
        for (const m of markers)
        {
            const [sx, sy] = view.toScreen(m.x, m.y);
            out += `<g class="mk ${m.level}"><circle cx="${f(sx)}" cy="${f(sy)}" r="9"/><text x="${f(sx)}" y="${f(sy + 4)}">!</text><title>${esc(m.text)}</title></g>`;
        }
    return out;
}
