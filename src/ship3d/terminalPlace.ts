import json from './terminals.json';
import { round } from './shapes';
import type { TerminalData } from './shipData';
import type { TerminalsFile, TerminalVariant } from './terminalData';
import type { ScreenDef } from './worldTypes';

/** The variants at run time, filled from `terminals.json`. */
export const TERMINAL_VARIANTS: TerminalVariant[] = [];

export function applyTerminals(data: TerminalsFile): void
{
    TERMINAL_VARIANTS.length = 0;
    TERMINAL_VARIANTS.push(...structuredClone(data.variants));
}

export const variantById = (id: string): TerminalVariant | undefined => TERMINAL_VARIANTS.find(v => v.id === id);

applyTerminals(json as unknown as TerminalsFile);

/** A point `(u, v)` of a terminal's own frame in the plan: `u` to the viewer's right, `v` toward the viewer. */
export function localToPlan(t: Pick<TerminalData, 'x' | 'y' | 'yaw'>, u: number, v: number): [number, number]
{
    const [rx, ry] = [-Math.cos(t.yaw), -Math.sin(t.yaw)];
    const [nx, ny] = [Math.sin(t.yaw), -Math.cos(t.yaw)];
    return [t.x + rx * u + nx * v, t.y + ry * u + ny * v];
}

/** The monitor a terminal's glass makes (so picking, focus and the cards work on it by id); null if its variant is unknown. */
export function terminalOf(t: TerminalData): ScreenDef | null
{
    const variant = variantById(t.variant);
    if (!variant) return null;
    const k = t.scale ?? 1;
    const g = variant.glass;
    const [x, y] = localToPlan(t, (g.u ?? 0) * k, g.v * k);
    return {
        id: t.id,
        zone: t.zone as ScreenDef['zone'],
        x: round(x),
        y: round(y),
        z: round((t.z ?? 0) + g.z * k),
        w: round(g.w * k),
        h: round(g.h * k),
        yaw: t.yaw,
        ...(g.tilt ? { tilt: g.tilt } : {}),
        variant: variant.id,
        ...(k !== 1 ? { scale: k } : {}),
    };
}
