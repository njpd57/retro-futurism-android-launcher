import type { GameEvent, GameState } from './game';

/** MOTHER's line for what just happened, or null when nothing is worth saying. Later events win. */
export function messageFor(events: readonly GameEvent[], s: GameState): string | null
{
    let line: string | null = null;
    for (const e of events)
    {
        switch (e)
        {
            case 'pickup': line = `CÉLULA RECUPERADA ${s.collected}/${s.needed}.`; break;
            case 'allCells': line = 'CÉLULAS COMPLETAS. DIRÍJASE A LA LANZADERA.'; break;
            case 'exitLocked': line = `LANZADERA SIN ENERGÍA. FALTAN ${s.needed - s.collected} CÉLULAS.`; break;
            case 'doorOpen': line = 'PUERTA ABIERTA.'; break;
            case 'doorClose': line = 'PUERTA SELLADA.'; break;
            case 'doorForced': line = 'ALERTA: PUERTA FORZADA.'; break;
            case 'spotted': line = 'ALERTA: CONTACTO HOSTIL.'; break;
            case 'lostTrack': line = 'EL ORGANISMO HA PERDIDO SU RASTRO.'; break;
            case 'hide': line = 'OCULTO. NO SE MUEVA.'; break;
            case 'won': line = 'LANZADERA LISTA. DESPEGUE AUTORIZADO.'; break;
            case 'dead': line = 'TRIPULANTE PERDIDO.'; break;
        }
    }
    return line;
}

/** The current goal, for the HUD. */
export function objective(s: GameState): string
{
    return s.collected < s.needed ? `RECUPERE CÉLULAS ${s.collected}/${s.needed}` : 'VAYA A LA LANZADERA';
}
