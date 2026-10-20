import type { BridgeNotification } from '@/types/bridge-fork';
import { groupByApp } from './notifications';

export interface RadarBlip
{
    /** Radians, 0 = east, counter-clockwise on screen is negative. */
    angle: number;
    /** 0 (center) to 1 (edge). */
    radius: number;
    /** A heavy contact (several signals) is drawn bigger. */
    heavy?: boolean;
}

/** An app on the radar: one blip, however many notifications it has. */
export interface RadarContact
{
    packageName: string;
    notifications: BridgeNotification[];
    blip: RadarBlip;
}

/** Signals at which a contact is drawn heavy. */
export const HEAVY_CONTACT = 3;
export const MAX_CONTACTS = 12;

/** One contact per app, the busiest-recent first (up to `limit`). Its position depends only on the package, so it stays put. */
export function radarContacts(list: readonly BridgeNotification[], limit = MAX_CONTACTS): RadarContact[]
{
    return groupByApp(list).slice(0, limit).map(g => ({
        packageName: g.packageName,
        notifications: g.items,
        blip: { ...blipFromKey(g.packageName), heavy: g.items.length >= HEAVY_CONTACT },
    }));
}

const TAU = Math.PI * 2;

/** A stable position for a string (a notification key, a package name). */
export function blipFromKey(key: string): RadarBlip
{
    let h = 2166136261;
    for (let i = 0; i < key.length; i++)
        h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    h >>>= 0;
    return { angle: (h % 3600) / 3600 * TAU, radius: 0.3 + ((h >>> 12) % 700) / 1000 };
}

/** A wedge of the sweep, as an SVG path in a viewBox centred on the radar (radius 1), and how bright it is (1 = the beam). */
export interface RadarWedge
{
    d: string;
    opacity: number;
}

/** A contact placed in the same viewBox; `brightness` is high right after the beam passed over it and fades. */
export interface RadarDot
{
    x: number;
    y: number;
    brightness: number;
    heavy: boolean;
}

export const SWEEP_WEDGES = 7;
const WEDGE_ANGLE = 0.17;

const point = (angle: number, radius = 1) => `${(Math.cos(angle) * radius).toFixed(3)} ${(Math.sin(angle) * radius).toFixed(3)}`;

/**
 * The radar as vector shapes for a viewBox of `-1 -1 2 2`: the beam is the first wedge, behind it come dimmer ones
 * (the fading phosphor trail), and a blip lights up when the beam passes it. Angles grow clockwise on screen.
 */
export function radarScene(sweep: number, blips: readonly RadarBlip[]): { wedges: RadarWedge[]; dots: RadarDot[] }
{
    const wedges: RadarWedge[] = [];
    for (let i = 0; i < SWEEP_WEDGES; i++)
    {
        const to = sweep - i * WEDGE_ANGLE;
        const from = to - WEDGE_ANGLE;
        wedges.push({ d: `M0 0 L${point(from)} A1 1 0 0 1 ${point(to)} Z`, opacity: i === 0 ? 0.55 : 0.3 * (1 - i / SWEEP_WEDGES) });
    }

    const dots = blips.map(blip =>
    {
        const behind = norm(sweep - blip.angle);
        return {
            x: Math.cos(blip.angle) * blip.radius,
            y: Math.sin(blip.angle) * blip.radius,
            brightness: behind < 1 ? 1 : behind < 3 ? 0.55 : 0.25,
            heavy: !!blip.heavy,
        };
    });

    return { wedges, dots };
}

const norm = (a: number) => ((a % TAU) + TAU) % TAU;
