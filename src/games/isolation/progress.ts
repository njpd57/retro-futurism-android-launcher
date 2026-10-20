import { deckScore, levelOf, modeOf } from './campaign';
import type { GameState } from './game';
import { LOGS, type Ending } from './logs';

/** What the player has done over all runs: the archive. */
export interface Stats
{
    timeMs: number;
    deaths: number;
    decks: number;
    fires: number;
    campaigns: number;
}

export interface Best { level: number; score: number; seed: number }

export interface Progress
{
    endings: Ending[];
    logs: string[];
    achievements: string[];
    stats: Stats;
    best: Best | null;
}

export const EMPTY_PROGRESS: Progress = {
    endings: [], logs: [], achievements: [], stats: { timeMs: 0, deaths: 0, decks: 0, fires: 0, campaigns: 0 }, best: null,
};

export interface Achievement { id: string; title: string; hint: string }

export const ACHIEVEMENTS: readonly Achievement[] = [
    { id: 'unseen', title: 'SIN SER VISTO', hint: 'TERMINE UNA CUBIERTA SIN QUE EL ORGANISMO LE VEA' },
    { id: 'jones', title: 'JONES A SALVO', hint: 'ESCAPE CON EL GATO' },
    { id: 'archivist', title: 'ARCHIVISTA', hint: 'LEA LOS 12 REGISTROS DE LA TRIPULACIÓN' },
    { id: 'order937', title: 'ORDEN 937', hint: 'LEA LA ORDEN ESPECIAL DE ASH' },
    { id: 'nofire', title: 'SIN FUEGO', hint: 'TERMINE LA CAMPAÑA SIN USAR EL LANZALLAMAS' },
    { id: 'survivor', title: 'SUPERVIVIENTE', hint: 'TERMINE LA CAMPAÑA' },
    { id: 'veteran', title: 'VETERANO', hint: 'TERMINE LA CAMPAÑA EN DIFÍCIL' },
    { id: 'shutdown', title: 'APAGADO', hint: 'DESCONECTE A ASH' },
    { id: 'sector5', title: 'SECTOR 5', hint: 'SUPERE EL SECTOR 5 EN EL MODO INFINITO' },
    { id: 'sector10', title: 'SECTOR 10', hint: 'SUPERE EL SECTOR 10 EN EL MODO INFINITO' },
];

export type RunEvent =
    | { type: 'log'; id: string }
    | { type: 'ashOff' }
    | { type: 'death' }
    | { type: 'deck'; state: GameState }
    | { type: 'ending'; state: GameState; ending: Ending };

const add = <T>(list: readonly T[], item: T) => list.includes(item) ? [...list] : [...list, item];

/** The archive after something happened, and the achievements it earned just now. Pure. */
export function record(p: Progress, e: RunEvent): { progress: Progress; earned: string[] }
{
    let next: Progress = { ...p, stats: { ...p.stats } };
    const wanted = new Set<string>();

    if (e.type === 'log')
    {
        next.logs = add(next.logs, e.id);
        if (e.id === 'orden937') wanted.add('order937');
        if (next.logs.length >= LOGS.length) wanted.add('archivist');
    }
    else if (e.type === 'ashOff') wanted.add('shutdown');
    else if (e.type === 'death') next.stats.deaths++;
    else if (e.type === 'deck')
    {
        const s = e.state;
        next.stats.decks++;
        next.stats.timeMs += s.timeMs - s.startMs;
        if (s.spotted === s.spottedStart) wanted.add('unseen');
        if (modeOf(s.deck) === 'infinite')
        {
            const level = levelOf(s.deck);
            const seed = Number(s.deck.split(':')[1]);
            const score = s.score + deckScore(s);
            if (!next.best || level > next.best.level || (level === next.best.level && score > next.best.score)) next.best = { level, score, seed };
            if (level >= 5) wanted.add('sector5');
            if (level >= 10) wanted.add('sector10');
        }
    }
    else
    {
        const s = e.state;
        next.endings = add(next.endings, e.ending);
        // the blast is an ending too, but nobody got away
        if (e.ending !== 'blast')
        {
            next.stats.campaigns++;
            next.stats.fires += s.fires;
            wanted.add('survivor');
            if (e.ending === 'jones') wanted.add('jones');
            if (s.fires === 0) wanted.add('nofire');
            if (s.difficulty === 'hard') wanted.add('veteran');
        }
    }

    const earned = [...wanted].filter(id => !next.achievements.includes(id));
    next.achievements = [...next.achievements, ...earned];
    return { progress: next, earned };
}

/** The endless mode opens once the campaign has been finished. */
export const infiniteUnlocked = (p: Progress) => p.endings.some(e => e !== 'blast');

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

/** Validates the archive read from storage. */
export function isProgress(v: unknown): v is Progress
{
    if (!isObject(v) || !isStrings(v.endings) || !isStrings(v.logs) || !isStrings(v.achievements)) return false;
    if (!v.endings.every(e => e === 'jones' || e === 'solo' || e === 'blast')) return false;
    const st = v.stats;
    if (!isObject(st) || ![st.timeMs, st.deaths, st.decks, st.fires, st.campaigns].every(isNumber)) return false;
    const b = v.best;
    return b === null || (isObject(b) && isNumber(b.level) && isNumber(b.score) && isNumber(b.seed));
}
