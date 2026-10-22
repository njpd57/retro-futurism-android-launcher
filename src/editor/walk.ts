import { stepDoors } from '@/ship3d/doors';
import type { ShipGL } from '@/ship3d/gl';
import { nearestLights, packLights } from '@/ship3d/lights';
import { eyeHeight, stepWalk, walker, type Walker } from '@/ship3d/walk';
import { LIGHTS, roomAt, type Seg } from '@/ship3d/world';

export interface WalkDeps
{
    canvas: HTMLCanvasElement;
    gl: ShipGL;
    /** the walls and solid props of the ship as it is built now */
    segs(): Seg[];
    /** the walk ended where the camera stood */
    onExit(x: number, y: number): void;
    hud(text: string): void;
}

/** First person through the ship as the launcher walks it: same body, same collisions, same doors. */
export class WalkMode
{
    active = false;
    private body: Walker = walker(0, 0);
    private keys = new Set<string>();
    private doors: number[] = [];
    private raf = 0;
    private last = 0;
    private time = 0;
    private look = { turn: 0, tilt: 0 };
    private dragging = false;

    constructor(private d: WalkDeps)
    {
        const c = d.canvas;
        c.addEventListener('pointerdown', e => { if (this.active) { this.dragging = true; c.setPointerCapture(e.pointerId); } });
        c.addEventListener('pointerup', () => { this.dragging = false; });
        c.addEventListener('pointermove', e =>
        {
            if (!this.active || !(this.dragging || document.pointerLockElement === c)) return;
            this.look.turn += e.movementX * 0.004;
            this.look.tilt -= e.movementY * 0.004;
        });
        c.addEventListener('dblclick', () => { if (this.active) void c.requestPointerLock?.(); });
        window.addEventListener('keydown', e =>
        {
            if (!this.active || (e.target as HTMLElement).closest('input, select, textarea')) return;
            if (e.code === 'Escape' || e.code === 'Tab') { e.preventDefault(); this.stop(); return; }
            this.keys.add(e.code);
            if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
        });
        window.addEventListener('keyup', e => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.keys.clear());
    }

    start(x: number, y: number, yaw: number)
    {
        this.body = walker(x, y, yaw, 0);
        this.doors = [];
        this.active = true;
        this.last = performance.now();
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(this.frame);
    }

    stop()
    {
        if (!this.active) return;
        this.active = false;
        this.keys.clear();
        cancelAnimationFrame(this.raf);
        if (document.pointerLockElement === this.d.canvas) document.exitPointerLock();
        this.d.onExit(this.body.x, this.body.y);
    }

    private frame = (now: number) =>
    {
        if (!this.active) return;
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.time += dt;
        const k = (code: string) => (this.keys.has(code) ? 1 : 0);
        const slow = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 0.4 : 1;
        const forward = (k('KeyW') - k('KeyS')) * slow;
        const strafe = (k('KeyD') - k('KeyA')) * slow;
        const turn = this.look.turn + (k('ArrowRight') - k('ArrowLeft')) * 1.8 * dt;
        const tilt = this.look.tilt + (k('ArrowUp') - k('ArrowDown')) * 1.2 * dt;
        this.look = { turn: 0, tilt: 0 };

        this.body = stepWalk(this.body, { forward, strafe, turn, tilt }, dt, this.d.segs());
        this.doors = stepDoors(this.doors, this.body.x, this.body.y, dt);
        const still = Math.hypot(this.body.vx, this.body.vy) < 0.2;
        const eye = eyeHeight(this.body, still);
        this.d.gl.render({
            eye: [this.body.x, eye, this.body.y], yaw: this.body.yaw, pitch: this.body.pitch,
            lights: packLights(LIGHTS, nearestLights(LIGHTS, this.body.x, this.body.y, eye)),
            time: this.time, doors: this.doors, sweep: -1000, holo: 0.6, grain: 0.04,
        });
        const room = roomAt(this.body.x, this.body.y);
        this.d.hud(`x ${this.body.x.toFixed(2)}  y ${this.body.y.toFixed(2)} m  ·  ${room ? room.name : 'FUERA DE LA NAVE'}`);
        this.raf = requestAnimationFrame(this.frame);
    };
}
