import { MISSIONS } from './campaign';
import type { Report } from './report';

/**
 * The achievements: each is earned from the report of a finished run and what the campaign has recorded. Pure.
 */

/** What a run knows besides its report. */
export interface RunContext
{
    /** the run was a campaign mission that was won, and the difficulty it was played at */
    won: boolean;
    mission: string | null;
    difficulty: string;
    /** the missions won, counting this one */
    missionsWon: ReadonlySet<string>;
}

export interface Achievement { id: string; name: string; text: string; earned: (r: Report, c: RunContext) => boolean }

export const ACHIEVEMENTS: readonly Achievement[] = [
    { id: 'primera', name: 'PRIMER CONTACTO', text: 'ABATA UNA CRIATURA', earned: r => r.kills >= 1 },
    { id: 'centenar', name: 'CENTENAR', text: '100 BAJAS EN UNA PARTIDA', earned: r => r.kills >= 100 },
    { id: 'oleada5', name: 'AGUANTE', text: 'LLEGUE A LA OLEADA 5 EN OLEADAS', earned: (r, c) => c.mission === null && r.wave >= 5 },
    { id: 'oleada10', name: 'ÚLTIMA DEFENSA', text: 'LLEGUE A LA OLEADA 10 EN OLEADAS', earned: (r, c) => c.mission === null && r.wave >= 10 },
    { id: 'punteria', name: 'PUNTERÍA', text: '60 % DE PRECISIÓN CON 150 DISPAROS', earned: r => r.shots >= 150 && r.accuracy >= 0.6 },
    { id: 'soldador', name: 'SOLDADOR', text: 'SELLE 3 PUERTAS EN UNA PARTIDA', earned: r => r.built.welds >= 3 },
    { id: 'artillero', name: 'ARTILLERO', text: 'ARME 4 TORRETAS EN UNA PARTIDA', earned: r => r.built.turrets >= 4 },
    { id: 'fumigador', name: 'FUMIGADOR', text: '5 ESCUPIDORES ABATIDOS', earned: r => r.killsBy.spitter >= 5 },
    { id: 'exterminio', name: 'EXTERMINIO', text: '10 ABRAZACARAS ABATIDOS', earned: r => r.killsBy.hugger >= 10 },
    { id: 'reina', name: 'REINA MUERTA', text: 'ABATA A LA REINA', earned: r => r.killsBy.queen >= 1 },
    { id: 'mision', name: 'MISIÓN CUMPLIDA', text: 'GANE UNA MISIÓN', earned: (_, c) => c.won },
    { id: 'intacta', name: 'ESCUADRA INTACTA', text: 'GANE UNA MISIÓN CON LA ESCUADRA ENTERA', earned: (r, c) => c.won && r.squadAlive >= 2 },
    { id: 'pesadilla', name: 'PESADILLA', text: 'GANE UNA MISIÓN EN PESADILLA', earned: (_, c) => c.won && c.difficulty === 'pesadilla' },
    { id: 'campana', name: 'FIN DE LA TRANSMISIÓN', text: 'COMPLETE LA CAMPAÑA', earned: (_, c) => MISSIONS.every(m => c.missionsWon.has(m.id)) },
];

export const achievementById = (id: string): Achievement | undefined => ACHIEVEMENTS.find(a => a.id === id);

/** The ids of every achievement this run earns, whether or not it was earned before. */
export const earnedBy = (r: Report, c: RunContext): string[] => ACHIEVEMENTS.filter(a => a.earned(r, c)).map(a => a.id);
