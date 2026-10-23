import type { RoomId } from './world';
import { ZONES, type CardWidget } from './zones';

export type { CardWidget } from './zones';

/** What opens when a monitor of each room is tapped: the existing dashboard widgets, in the order they show (`zones/*.json`). */
export const CARDS: Readonly<Record<RoomId, readonly CardWidget[]>> = Object.fromEntries(Object.values(ZONES).filter(z => z.widgets.length).map(z => [z.id, z.widgets]));

/** What each monitor shows when it is in focus; a monitor missing here shows its room's card. */
export const MONITORS: Readonly<Record<string, readonly CardWidget[]>> = {
    'puente.hora': [{ kind: 'clock', rows: 1 }],
    'puente.rumbo': [{ kind: 'compass', rows: 2 }],
    'puente.clima': [{ kind: 'forecast', rows: 2 }],
    'puente.turno': [{ kind: 'protocol', rows: 2 }],
    'comms.senales': [{ kind: 'radar', rows: 2 }],
    'comms.mother': [{ kind: 'mother', rows: 2 }],
    'motor.reserva': [{ kind: 'power', rows: 1 }],
    'motor.enlace': [{ kind: 'link', rows: 1 }, { kind: 'telemetry', rows: 1 }],
    'bodega.almacen': [{ kind: 'storage', rows: 1 }],
    'bodega.pantalla': [{ kind: 'screentime', rows: 1 }],
    'hipersueno.alarma': [{ kind: 'alarm', rows: 1 }, { kind: 'reminders', rows: 2 }],
    'hipersueno.agenda': [{ kind: 'agenda', rows: 2 }],
    'comedor.pista': [{ kind: 'media', rows: 2 }],
    'comedor.rancho': [{ kind: 'contacts', rows: 2 }],
    'camarotes.tripulacion': [{ kind: 'notes', rows: 2 }],
    'hangar.flota': [{ kind: 'favorites', rows: 2 }, { kind: 'recent', rows: 1 }],
};

/** The widgets of a monitor in focus. */
export const monitorWidgets = (id: string, zone: string): readonly CardWidget[] =>
    MONITORS[id] ?? CARDS[zone as RoomId] ?? [];
