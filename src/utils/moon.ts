const SYNODIC_DAYS = 29.530588853;
// a known new moon: 2000-01-06 18:14 UTC
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Fraction of the lunar cycle (0 = new moon, 0.5 = full), computed without network. */
export function moonCycle(date: Date)
{
    const days = (date.getTime() - REFERENCE_NEW_MOON) / 86_400_000;
    return ((days / SYNODIC_DAYS) % 1 + 1) % 1;
}

const NAMES = ['LUNA NUEVA', 'CRECIENTE', 'CUARTO CRECIENTE', 'GIBOSA CRECIENTE', 'LUNA LLENA', 'GIBOSA MENGUANTE', 'CUARTO MENGUANTE', 'MENGUANTE'];

export function moonName(cycle: number)
{
    return NAMES[Math.floor(((cycle % 1) * 8 + 0.5)) % 8];
}

/** Share of the disc that is lit, 0..1. */
export function moonIllumination(cycle: number)
{
    return (1 - Math.cos(2 * Math.PI * cycle)) / 2;
}

/** Which part of the disc is lit: the right side while waxing, the left while waning, bounded by a half-ellipse terminator. */
export interface MoonShape
{
    side: 'right' | 'left';
    /** Horizontal radius of the terminator, 0 (quarter) to 1 (new or full), on a disc of radius 1. */
    rx: number;
    /** True when the terminator bulges into the dark side, so more than half the disc is lit. */
    gibbous: boolean;
}

export function moonShape(cycle: number): MoonShape
{
    const cos = Math.cos(2 * Math.PI * cycle);
    return { side: cycle % 1 < 0.5 ? 'right' : 'left', rx: Math.abs(cos), gibbous: cos < 0 };
}

/** Area of the lit part of a disc of radius 1 (π is a full disc); matches `π × moonIllumination`. */
export function moonLitArea(shape: MoonShape)
{
    return Math.PI / 2 + (shape.gibbous ? 1 : -1) * Math.PI * shape.rx / 2;
}

/** The lit part of the moon as an SVG path on a disc of radius 1 centred on the origin. */
export function moonPath(cycle: number)
{
    const { side, rx, gibbous } = moonShape(cycle);
    const rim = side === 'right' ? 1 : 0; // top to bottom through the lit side
    // back from the bottom to the top the terminator bulges into the lit side (crescent) or the dark one (gibbous)
    const back = (side === 'right') === gibbous ? 1 : 0;
    return `M0 -1 A1 1 0 0 ${rim} 0 1 A${rx.toFixed(4)} 1 0 0 ${back} 0 -1 Z`;
}
