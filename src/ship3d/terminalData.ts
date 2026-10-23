/**
 * The shape of `terminals.json`: the catalogue of terminals (a body, a glass and some lit controls) that the plan
 * places by variant name. A variant knows nothing about where it will stand; it is drawn in its own frame: `u` to
 * the viewer's right, `v` toward the viewer from the back (the wall, for a wall-mounted one), `z` up from its base.
 */

/** A box (`kind: 'box'`) or a cylinder, centred at `(u, v)` with its base at `z0`; a box can lean back `tilt` radians about its own `u` axis. */
export interface TerminalPart
{
    kind: 'box' | 'cyl';
    u?: number;
    v?: number;
    z0?: number;
    /** box: across; cylinder: diameter */
    w: number;
    /** box only: deep */
    d?: number;
    h: number;
    tilt?: number;
    /** id of a material in `materials.json`; `prop` when left out */
    material?: string;
    glow?: number;
}

/** A grid of lit cells on a plane (keys, a row of LEDs, a cluster of buttons), leaning back `tilt` about its `u` axis. */
export interface TerminalLights
{
    u?: number;
    v?: number;
    z: number;
    w: number;
    d: number;
    cols: number;
    rows: number;
    tilt?: number;
    /** ids of glow materials (`amber`, `green`, `red`, `blue`), used in turn */
    colors: string[];
    /** 0..1 how much they shine; 0.35 when left out */
    glow?: number;
}

/** The glass: the picture's rectangle in the variant's frame, leaning back `tilt` (a sunk screen looks up). */
export interface TerminalGlass
{
    u?: number;
    v: number;
    z: number;
    w: number;
    h: number;
    tilt?: number;
    /** margin of dark bezel round the picture; 0.06 when left out */
    bezel?: number;
}

export interface TerminalVariant
{
    id: string;
    name: string;
    glass: TerminalGlass;
    body?: TerminalPart[];
    lights?: TerminalLights[];
}

export interface TerminalsFile { variants: TerminalVariant[] }
