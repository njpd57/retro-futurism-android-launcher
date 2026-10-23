import type { AssetPlacement } from './assets';
/**
 * The shape of `ship.json`, the ship's plan as data. `world.ts` expands it into rooms, props and screens (`applyWorld`);
 * the map editor reads and writes it. Metres, `(x east, y south)`.
 */

type V2 = [number, number];

/** How a room's outline is made: a literal polygon or a generator with its parameters. */
export type ShapeData =
    | { rect: [number, number, number, number] }
    /** `[x0, y0, x1, y1, corner]` */
    | { chamfer: [number, number, number, number, number] }
    /** `[cx, cy, apothem, sides]` */
    | { ngon: [number, number, number, number] }
    /** `[cx, baseY, rx, ry, steps]` */
    | { dome: [number, number, number, number, number] }
    | { poly: V2[] };

export interface RoomData
{
    id: string;
    zone: string;
    name: string;
    height: number;
    shape: ShapeData;
    /** ids in `materials.json` for this room's surfaces; the kind's own when left out */
    floor?: string;
    wall?: string;
    ceiling?: string;
}

/** A prop with the defaults left out (`yaw`, `z0`, `glow` = 0, `solid` = true). */
export interface PropData
{
    kind: 'box' | 'cyl';
    x: number;
    y: number;
    /** box: across; cylinder: diameter */
    w: number;
    /** box only: deep */
    d?: number;
    h: number;
    yaw?: number;
    z0?: number;
    glow?: number;
    solid?: boolean;
    /** a bridge console: the mesh puts a slanted keyboard on it */
    keyboard?: boolean;
    /** id of a material in `materials.json`; the kind's own when left out */
    material?: string;
}

/** A prefab (`prefabs.json`) set down at `(x, y)`, turned `yaw`. */
export interface PrefabInstance { prefab: string; x: number; y: number; yaw?: number }

/** Props that a function makes from a few numbers. The order in `props` is the order in the world. */
export type PropEntry = PropData | PrefabInstance | { gen: 'mess' } | { gen: 'pods'; cx: number; cy: number; radius: number };

export type Face = 'N' | 'E' | 'S' | 'W';

export type ScreenData =
    | { id: string; zone: string; on: 'wall'; x: number; y: number; face: Face; w?: number; h?: number; z?: number }
    | { id: string; zone: string; on: 'crown'; face: Face }
    /** the middle of side `k` of a dome-shaped room (`room`, or the screen's `zone` when left out) */
    | { id: string; zone: string; on: 'dome'; k: number; room?: string; w?: number; h?: number; z?: number };

/** A terminal of a variant in `terminals.json`, set down with its back at `(x, y)` and its face looking `yaw` (like a monitor); `z` lifts its base. */
export interface TerminalData { id: string; zone: string; variant: string; x: number; y: number; yaw: number; z?: number; scale?: number }

export interface MessData
{
    /** id of the room the mess is built in, `comedor` when left out */
    room?: string;
    tableR: number;
    tableTop: number;
    chairR: number;
    chairs: number;
    crownR: number;
    crownZ0: number;
    /** diameter of the sunken ring the table stands in */
    ringD: number;
    bird: { x: number; y: number; yaw: number; glass: number };
}

export interface HangarData
{
    max: number;
    /** the `y` of each pair of shuttles */
    rows: number[];
    /** distance from the aisle to the middle of a shuttle */
    x: number;
    w: number;
    d: number;
    h: number;
    z0: number;
}

/** The ceiling lamps: a grid in each room, `step` metres apart (`corridorStep` in the corridors). */
export interface LampData { step: number; corridorStep: number; power: number }

export interface ShipData
{
    door: { width: number; height: number };
    start: { x: number; y: number; yaw: number; pitch: number };
    rooms: RoomData[];
    portals: { x: number; y: number }[];
    props: PropEntry[];
    mess: MessData;
    hangar: HangarData;
    screens: ScreenData[];
    /** free-standing terminals (`terminals.json`); each also makes a monitor that is picked and focused like a screen */
    terminals?: TerminalData[];
    lamps: LampData;
    /** lights placed by hand, on top of the lamps and of what shines by itself; at `height - 0.3` they are drawn as lamps */
    extraLights: { x: number; y: number; z: number; power: number }[];
    /** where the minimap takes the camera in each room */
    stands: Record<string, V2>;
    /** points to route round what stands in the way inside a room */
    vias: Record<string, V2[]>;
    signalSlots: { x: number; y: number; yaw: number }[];
    stencils: { room: string; text: string }[];
    /** printed labels on the walls (`LECHE` over a dispenser): light letters on a dark strip, `w` wide, centred on `(x, z, y)`, facing `(nx, ny)` */
    signs?: SignData[];
    /** panels of switches, levers and lamps that work the phone (see `controls.ts`) */
    panels?: PanelData[];
    controls?: ControlData[];
    stations?: StationData[];
    /** pieces made by an asset folder (`assets/<kind>/`): the kind and the parameters this one overrides */
    assets?: AssetPlacement[];
    /** the phone's flashlight, as a floodlight in the room of kind `zone`: `power` at `(x, y, z)` */
    floodlight?: { x: number; y: number; z: number; power: number; zone: string };
}

/** A panel of controls: a plate centred at `(x, z, y)`, its face looking `yaw` (like a monitor), leaning back `tilt` radians. */
export interface PanelData { id: string; x: number; y: number; z: number; w: number; h: number; yaw: number; tilt?: number }

export type ControlKind = 'toggle' | 'lever' | 'selector' | 'button' | 'lamp' | 'gauge';

/** A control on `panel`, `u` metres to the viewer's right of its middle and `v` up its face; `action` names what it does on the phone. */
export interface ControlData { id: string; panel: string; u: number; v: number; kind: ControlKind; action: string; label?: string }

/**
 * A place to sit or lie down: the eye goes to `(x, z, y)` looking `yaw`, and can turn `arc` radians either way and
 * tilt between `pitchMin` and `pitchMax`. A tap within `r` metres of `(x, y)` and under `h` takes it.
 */
export interface StationData
{
    id: string;
    x: number;
    y: number;
    z: number;
    yaw: number;
    arc: number;
    pitch?: number;
    pitchMin?: number;
    pitchMax?: number;
    r?: number;
    h?: number;
    /** lying in a hypersleep capsule rather than sitting */
    lying?: boolean;
}

export interface SignData { text: string; x: number; y: number; z: number; w: number; nx: number; ny: number }
