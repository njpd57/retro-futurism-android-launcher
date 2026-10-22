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
    /** the middle of side `k` of the `puente` dome */
    | { id: string; zone: string; on: 'dome'; k: number };

export interface MessData
{
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
    lamps: LampData;
    /** lights placed by hand, on top of the lamps and of what shines by itself; at `height - 0.3` they are drawn as lamps */
    extraLights: { x: number; y: number; z: number; power: number }[];
    /** where the minimap takes the camera in each room */
    stands: Record<string, V2>;
    /** points to route round what stands in the way inside a room */
    vias: Record<string, V2[]>;
    signalSlots: { x: number; y: number; yaw: number }[];
    stencils: { room: string; text: string }[];
}
