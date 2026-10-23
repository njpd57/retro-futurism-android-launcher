import type { V2 } from './shapes';

/** The ship's records: what a room, a doorway, a prop, a light and a monitor are once the plan is expanded (see `world.ts`). */

export type { V2 };

/** A kind of room: one of the files in `zones/` (`puente`, `pasillo`...). */
export type RoomId = string;
export type Zone = string;

export interface Room
{
    id: string;
    zone: Zone;
    name: string;
    /** convex outline */
    poly: V2[];
    height: number;
    /** material index (`materials.json`) of each surface, or -1 for the kind's own */
    surface: { floor: number; wall: number; ceiling: number };
}

/** A doorway on the line where two rooms meet. */
export interface Portal { x: number; y: number; width: number; height: number }

export type PropKind = 'box' | 'cyl';

export interface Prop
{
    kind: PropKind;
    x: number;
    y: number;
    /** box: across; cylinder: diameter */
    w: number;
    /** box: deep (cylinders ignore it) */
    d: number;
    h: number;
    /** rotation of a box, plan yaw */
    yaw: number;
    /** height of its base above the floor */
    z0: number;
    /** 0..1 how much it shines by itself */
    glow: number;
    solid: boolean;
    /** a cylinder's sides in the mesh (16 when left out); its first corner is at `yaw` */
    sides?: number;
    /** index into `MATERIALS`; the kind's own when left out */
    material?: number;
}

export interface Light { x: number; y: number; z: number; power: number }

/** A monitor hung on a wall, facing `yaw` (the way its picture looks, into the room). */
export interface ScreenDef
{
    id: string;
    /** the room whose card it opens; the ship's terminal (`hub`, over the mess table) opens the search and MOTHER instead */
    zone: RoomId | 'hub';
    x: number;
    y: number;
    /** height of its centre above the floor */
    z: number;
    w: number;
    h: number;
    yaw: number;
    /** the glass leans back this many radians (a sunk screen looks up); 0 when left out */
    tilt?: number;
    /** the variant of `terminals.json` whose body stands round it; none for a plain monitor */
    variant?: string;
    /** the size of that body, 1 when left out */
    scale?: number;
    /** hangs in the room (the crown over the mess table) instead of on a wall */
    hung?: boolean;
}
