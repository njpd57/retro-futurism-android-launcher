import type { RoomId } from './world';

/** A widget in a room's card and how tall it is, in dashboard rows. */
export interface CardWidget { kind: string; rows: number }

/** What opens when a monitor of each room is tapped: the existing dashboard widgets, in the order they show. */
export const CARDS: Readonly<Record<RoomId, readonly CardWidget[]>> = {
    puente: [{ kind: 'clock', rows: 1 }, { kind: 'compass', rows: 2 }, { kind: 'forecast', rows: 2 }],
    comms: [{ kind: 'radar', rows: 2 }],
    motor: [{ kind: 'power', rows: 1 }, { kind: 'link', rows: 1 }, { kind: 'telemetry', rows: 1 }],
    bodega: [{ kind: 'storage', rows: 1 }, { kind: 'screentime', rows: 1 }],
    hipersueno: [{ kind: 'alarm', rows: 1 }, { kind: 'agenda', rows: 2 }, { kind: 'reminders', rows: 2 }],
    comedor: [{ kind: 'media', rows: 2 }, { kind: 'contacts', rows: 2 }],
    camarotes: [{ kind: 'notes', rows: 2 }, { kind: 'protocol', rows: 2 }],
    enfermeria: [{ kind: 'log', rows: 2 }],
    hangar: [{ kind: 'favorites', rows: 2 }, { kind: 'recent', rows: 1 }],
};
