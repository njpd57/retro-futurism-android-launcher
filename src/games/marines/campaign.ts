import type { MarinesState } from './game';

/**
 * The campaign: a short run of missions, each on one arena with goals that are checked against the running game.
 * Pure: no DOM. The goals use only what the game already counts (waves held, kills, doors sealed, turrets set).
 */

export type DifficultyId = 'recluta' | 'veterano' | 'pesadilla';

/** Multipliers on what comes out of the grilles and how hard it hits: `veterano` is the game as balanced. */
export interface Rules { hp: number; count: number; hurt: number }

export const DIFFICULTY: Record<DifficultyId, { name: string; rules: Rules }> = {
    recluta: { name: 'RECLUTA', rules: { hp: 0.8, count: 0.8, hurt: 0.75 } },
    veterano: { name: 'VETERANO', rules: { hp: 1, count: 1, hurt: 1 } },
    pesadilla: { name: 'PESADILLA', rules: { hp: 1.35, count: 1.3, hurt: 1.3 } },
};

export const DIFFICULTY_ORDER: readonly DifficultyId[] = ['recluta', 'veterano', 'pesadilla'];

/** What a mission asks: every goal named must be met at once. Waves count the ones cleared. */
/** `queen`: the wave in which the queen comes out of a grille; the goal is to bring her down. */
export interface Goals { waves?: number; kills?: number; welds?: number; turrets?: number; queen?: number }

export interface Mission
{
    id: string;
    title: string;
    arena: string;
    goals: Goals;
    /** the radio before it starts, and after it is won */
    briefing: readonly string[];
    debrief: readonly string[];
}

export const MISSIONS: readonly Mission[] = [
    {
        id: 'aguanten', title: 'AGUANTEN', arena: 'operaciones', goals: { waves: 4 },
        briefing: ['AQUÍ MANDO.', 'LA COLONIA ESTÁ INFESTADA.', 'AGUANTEN CUATRO OLEADAS EN OPERACIONES.', 'LA NAVE DE RESCATE VIENE EN CAMINO.'],
        debrief: ['MANDO: CUATRO OLEADAS. BUEN TRABAJO.', 'LA ZONA DE OPERACIONES ES SUYA.', 'VAYAN AL HANGAR.'],
    },
    {
        id: 'limpieza', title: 'LIMPIEZA', arena: 'hangar', goals: { kills: 60, turrets: 2 },
        briefing: ['AQUÍ MANDO.', 'EL HANGAR ESTÁ ABIERTO POR TODOS LADOS.', 'ARMEN DOS TORRETAS Y ABATAN SESENTA CONTACTOS.', 'LA ESCUADRA DE RESCATE NECESITA LA PISTA LIBRE.'],
        debrief: ['MANDO: PISTA LIBRE.', 'EL TRANSPORTE PUEDE ATERRIZAR.', 'EL ÚLTIMO TRAMO ES LOS CONDUCTOS.'],
    },
    {
        id: 'sellen', title: 'SELLEN LAS PUERTAS', arena: 'conductos', goals: { waves: 5, welds: 2 },
        briefing: ['AQUÍ MANDO.', 'LAS REJILLAS ESTÁN TRAS LAS PUERTAS.', 'SUELDEN DOS PUERTAS Y AGUANTEN CINCO OLEADAS.', 'EL TRANSPORTE ESPERA EN LA CUBIERTA.'],
        debrief: ['MANDO: CONDUCTOS ASEGURADOS.', 'EL RASTREADOR MARCA UN NIDO BAJO LA COLONIA.', 'BAJEN AL NIDO.'],
    },
    {
        id: 'reina', title: 'LA REINA', arena: 'nido', goals: { queen: 3 },
        briefing: ['AQUÍ MANDO.', 'EL NIDO ESTÁ A OSCURAS: SOLO VERÁN LO QUE ALCANCE LA LÁMPARA.', 'LA REINA SALDRÁ EN LA TERCERA OLEADA.', 'ABÁTANLA Y SUBAN AL TRANSPORTE.'],
        debrief: ['MANDO: LA REINA HA CAÍDO.', 'TRANSPORTE EN PISTA. SUBAN A BORDO.', 'LV-426 QUEDA ATRÁS. FIN DE LA TRANSMISIÓN.'],
    },
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

const done = (s: MarinesState, g: Goals): boolean =>
    (g.waves === undefined || s.wave.n > g.waves)
    && (g.kills === undefined || s.kills >= g.kills)
    && (g.welds === undefined || s.built.welds >= g.welds)
    && (g.turrets === undefined || s.built.turrets >= g.turrets)
    && (g.queen === undefined || s.killsBy.queen >= 1);

/** True once every goal of the mission the game is playing is met. False in a game with no mission. */
export function missionDone(s: MarinesState): boolean
{
    const m = s.mission ? missionById(s.mission) : undefined;
    return !!m && done(s, m.goals);
}

/** The progress line for the HUD, such as `OLEADA 2/4 · TORRETAS 1/2`, or null in a game with no mission. */
export function missionProgress(s: MarinesState): string | null
{
    const m = s.mission ? missionById(s.mission) : undefined;
    if (!m) return null;
    const g = m.goals;
    const parts: string[] = [];
    if (g.waves !== undefined) parts.push(`OLEADA ${Math.min(g.waves, s.wave.n - 1)}/${g.waves}`);
    if (g.kills !== undefined) parts.push(`BAJAS ${Math.min(g.kills, s.kills)}/${g.kills}`);
    if (g.welds !== undefined) parts.push(`SOLDADURAS ${Math.min(g.welds, s.built.welds)}/${g.welds}`);
    if (g.turrets !== undefined) parts.push(`TORRETAS ${Math.min(g.turrets, s.built.turrets)}/${g.turrets}`);
    if (g.queen !== undefined) parts.push(s.queenOut ? `REINA ${s.killsBy.queen}/1` : `REINA EN OLEADA ${g.queen}`);
    return parts.join(' · ');
}

/** The missions open to play: the first, and each one after one that was won. */
export function unlocked(won: ReadonlySet<string>): Mission[]
{
    const open: Mission[] = [];
    for (const m of MISSIONS)
    {
        open.push(m);
        if (!won.has(m.id)) break;
    }
    return open;
}

/** What a won mission is remembered as. */
export interface Won { difficulty: DifficultyId; timeMs: number }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isCampaign(v: unknown): v is Record<string, Won>
{
    return isObject(v) && Object.values(v).every(w => isObject(w) && typeof w.difficulty === 'string' && w.difficulty in DIFFICULTY && typeof w.timeMs === 'number' && Number.isFinite(w.timeMs));
}
