import { LABEL_SLOTS } from './atlas';
import { fit } from './readings';

/**
 * Which name plate of the atlas holds what: the apps of the signals crew in COMMS, the starred contacts at their bunks
 * and the favourite apps on the shuttles. Pure.
 */

export const SIGNAL_PLATES = 0;
export const CONTACT_PLATES = 6;
export const SHUTTLE_PLATES = 10;
/** the stencil of each room beside its door, in `STENCIL_ROOMS` order */
export const STENCIL_PLATES = 16;

/** The rooms that have a stencil on their wall, and what it says. */
export const STENCILS: readonly { room: string; text: string }[] = [
    { room: 'comedor', text: 'C0 COMEDOR' },
    { room: 'puente', text: 'C1 PUENTE' },
    { room: 'comms', text: 'C2 COMMS' },
    { room: 'enfermeria', text: 'C3 ENFERMERÍA' },
    { room: 'bodega', text: 'C4 BODEGA' },
    { room: 'camarotes', text: 'C5 CAMAROTES' },
    { room: 'hipersueno', text: 'C6 HIPERSUEÑO' },
    { room: 'motor', text: 'C7 MOTOR' },
    { room: 'hangar', text: 'C8 HANGAR' },
];

/** How wide a plate's text may be, in characters. */
export const PLATE_CHARS = 14;

export interface Plates
{
    /** app name and how many notifications it has waiting, one per crew member of the signals */
    signals: readonly { label: string; count: number }[];
    contacts: readonly string[];
    shuttles: readonly string[];
}

/** `WHATSAPP 3`: the name shortened so the count always shows. */
export function signalPlate(label: string, count: number): string
{
    const n = ` ${count}`;
    return fit(label, PLATE_CHARS - n.length) + n;
}

/** The text of every plate, `LABEL_SLOTS` long; a slot nobody uses is undefined. */
export function plateTexts(p: Plates): (string | undefined)[]
{
    const out: (string | undefined)[] = Array.from({ length: LABEL_SLOTS }, () => undefined);
    p.signals.slice(0, CONTACT_PLATES - SIGNAL_PLATES).forEach((s, i) => { out[SIGNAL_PLATES + i] = signalPlate(s.label, s.count); });
    p.contacts.slice(0, SHUTTLE_PLATES - CONTACT_PLATES).forEach((c, i) => { out[CONTACT_PLATES + i] = fit(c, PLATE_CHARS); });
    p.shuttles.slice(0, STENCIL_PLATES - SHUTTLE_PLATES).forEach((s, i) => { out[SHUTTLE_PLATES + i] = fit(s, PLATE_CHARS); });
    return out;
}

/** `texts` with the rooms' stencils painted in their own plates. */
export function withStencils(texts: readonly (string | undefined)[]): (string | undefined)[]
{
    const out = [...texts];
    STENCILS.forEach((s, i) => { out[STENCIL_PLATES + i] = s.text; });
    return out;
}
