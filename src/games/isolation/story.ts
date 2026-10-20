import type { GameEvent, GameState } from './game';
import { logOf } from './logs';

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
            case 'lootScrap': line = 'CHATARRA RECUPERADA.'; break;
            case 'lootWires': line = 'CABLES RECUPERADOS.'; break;
            case 'lootChems': line = 'QUÍMICOS RECUPERADOS.'; break;
            case 'lootFlamer': line = 'LANZALLAMAS RECUPERADO. ES RUIDOSO.'; break;
            case 'lootCat': line = 'JONES A BORDO. CUIDADO CON LOS RUIDOS.'; break;
            case 'bagFull': line = 'NO CABE MÁS.'; break;
            case 'locked': line = 'PUERTA SIN ENERGÍA. DESVÍELA DESDE UN PANEL.'; break;
            case 'steamBlock': line = 'VAPOR. ESPERE A QUE CALLE EL SILBIDO.'; break;
            case 'ashSpotted': line = 'ASH: «NO SE MUEVA, TRIPULANTE.»'; break;
            case 'ashOff': line = 'ASH DESCONECTADO.'; break;
            case 'diverted': line = 'ENERGÍA DESVIADA. PUERTA DISPONIBLE.'; break;
            case 'mapped': line = 'PLANO DESCARGADO. USE [PLANO].'; break;
            case 'log': line = `REGISTRO: ${logOf(s.logs[s.logs.length - 1])?.title ?? '???'}.`; break;
            case 'blackout': line = 'FALLO DE ENERGÍA EN UNA ZONA.'; break;
            case 'powerBack': line = 'ENERGÍA RESTABLECIDA.'; break;
            case 'countdown': line = countdownLine(s.countdownMs ?? 0); break;
            case 'meow': line = 'JONES MAÚLLA.'; break;
            case 'blast': line = 'AUTODESTRUCCIÓN COMPLETADA.'; break;
            case 'craftDecoy': line = 'SEÑUELO FABRICADO.'; break;
            case 'craftFlare': line = 'BENGALA FABRICADA.'; break;
            case 'craftFuel': line = 'COMBUSTIBLE CARGADO.'; break;
            case 'noParts': line = 'FALTAN MATERIALES.'; break;
            case 'throwDecoy': line = 'SEÑUELO ACTIVO.'; break;
            case 'throwFlare': line = 'BENGALA ENCENDIDA.'; break;
            case 'noDecoy': line = 'SIN SEÑUELOS.'; break;
            case 'noFlare': line = 'SIN BENGALAS.'; break;
            case 'noFlamer': line = 'NO TIENE LANZALLAMAS.'; break;
            case 'noFuel': line = 'SIN COMBUSTIBLE.'; break;
            case 'scare': line = 'EL ORGANISMO RETROCEDE.'; break;
            case 'flareOut': line = 'LA BENGALA SE APAGA.'; break;
            case 'doorOpen': line = 'PUERTA ABIERTA.'; break;
            case 'doorClose': line = 'PUERTA SELLADA.'; break;
            case 'doorForced': line = 'ALERTA: PUERTA FORZADA.'; break;
            case 'spotted': line = 'ALERTA: CONTACTO HOSTIL.'; break;
            case 'lostTrack': line = 'EL ORGANISMO HA PERDIDO SU RASTRO.'; break;
            case 'hide': line = 'OCULTO. NO SE MUEVA.'; break;
            case 'saveStart': line = 'GUARDANDO EN TERMINAL…'; break;
            case 'saved': line = 'PROGRESO GUARDADO.'; break;
            case 'ventNear': line = 'RUIDO EN LOS CONDUCTOS.'; break;
            case 'won': line = 'LANZADERA LISTA. DESPEGUE AUTORIZADO.'; break;
            case 'dead': line = 'TRIPULANTE PERDIDO.'; break;
        }
    }
    return line;
}

/** MOTHER counts down every minute and the last half minute. */
export function countdownLine(ms: number): string
{
    if (ms <= 30000) return 'AUTODESTRUCCIÓN: 30 SEGUNDOS.';
    const m = Math.ceil(ms / 60000);
    return `AUTODESTRUCCIÓN EN ${m} MINUTO${m === 1 ? '' : 'S'}.`;
}

/** The current goal, for the HUD. */
export function objective(s: GameState): string
{
    if (s.countdownMs !== null) return s.collected < s.needed ? `CÉLULAS ${s.collected}/${s.needed} ANTES DE LA EXPLOSIÓN` : 'A LA LANZADERA ANTES DE LA EXPLOSIÓN';
    return s.collected < s.needed ? `RECUPERE CÉLULAS ${s.collected}/${s.needed}` : 'VAYA A LA LANZADERA';
}
