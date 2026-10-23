/**
 * What each kind of room is, as data: `zones/<id>.json`, found by name so a new room type is one file and nothing
 * else (see `docs/SHIP_ASSETS.md`). Everything that used to ask `zone === 'motor'` reads it from here.
 */

export type Wave = 'sine' | 'sawtooth' | 'square' | 'triangle';
export type Filter = 'lowpass' | 'highpass' | 'bandpass';

/** The continuous sound of a room: a tone, a band of noise, and how much both swell and fade. */
export interface Voice
{
    /** loudness of the whole voice when it is right next to you, 0..1 */
    level: number;
    tone?: { freq: number; wave: Wave; gain: number };
    hush?: { filter: Filter; freq: number; q: number; gain: number };
    /** the amplitude breathes `hz` times a second by up to `depth` (0..0.5) */
    wobble?: { hz: number; depth: number };
}

/** A widget in a room's card and how tall it is, in dashboard rows. */
export interface CardWidget { kind: string; rows: number }

export interface ZoneDef
{
    id: string;
    /** the validator and the hud expect a room of this zone to exist */
    required: boolean;
    /** a corridor: no card, no name on the hud, lit more sparsely, with its own trim */
    hall?: boolean;
    /** what the hud calls it when no room gives it a name */
    label?: string;
    voice: Voice;
    /** what the floor sounds like */
    step: 'plate' | 'grate';
    /** open work area: hazard chevrons at its doorways */
    work: boolean;
    /** what opens when a monitor of this room has no card of its own */
    widgets: CardWidget[];
    /** the monitors whose first line sums the room up on the hud, in order */
    keyScreens: string[];
}

const found = import.meta.glob<ZoneDef>('./zones/*.json', { eager: true, import: 'default' });

export const ZONES: Readonly<Record<string, ZoneDef>> = Object.fromEntries(Object.values(found).map(z => [z.id, z]));

export const zoneDef = (zone: string | undefined): ZoneDef | undefined => (zone ? ZONES[zone] : undefined);
export const isHall = (zone: string | undefined): boolean => !!zoneDef(zone)?.hall;
