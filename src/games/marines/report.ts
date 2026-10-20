import { accuracy, type MarinesState } from './game';
import type { EnemyKind } from './enemies';

/** What a finished run leaves behind: shown on the death panel and folded into the records. */
export interface Report
{
    arena: string;
    wave: number;
    score: number;
    kills: number;
    killsBy: Record<EnemyKind, number>;
    accuracy: number;
    shots: number;
    /** marines still standing when it ended */
    squadAlive: number;
    timeMs: number;
    built: { turrets: number; welds: number };
}

/** The best of each in one arena, and how many runs it took. */
export interface ArenaRecord { wave: number; score: number; kills: number; timeMs: number; runs: number }

export const EMPTY_RECORD: ArenaRecord = { wave: 0, score: 0, kills: 0, timeMs: 0, runs: 0 };

export type Beaten = 'wave' | 'score' | 'kills' | 'timeMs';

export function buildReport(s: MarinesState): Report
{
    return {
        arena: s.arena, wave: s.wave.n, score: s.score, kills: s.kills, killsBy: { ...s.killsBy },
        accuracy: accuracy(s), shots: s.shots, squadAlive: s.marines.filter(m => m.hp > 0).length, timeMs: s.timeMs, built: { ...s.built },
    };
}

/** Folds a run into the arena's record; `beaten` lists what it improved, when there was a record to beat. */
export function mergeRecord(record: ArenaRecord, r: Report): { record: ArenaRecord; beaten: Beaten[] }
{
    const next: ArenaRecord = {
        wave: Math.max(record.wave, r.wave), score: Math.max(record.score, r.score),
        kills: Math.max(record.kills, r.kills), timeMs: Math.max(record.timeMs, r.timeMs), runs: record.runs + 1,
    };
    const beaten = record.runs === 0 ? [] : (['wave', 'score', 'kills', 'timeMs'] as const).filter(k => next[k] > record[k]);
    return { record: next, beaten };
}

/** Everything ever played, added up across runs. */
export interface Stats { runs: number; kills: number; timeMs: number; shots: number; hits: number; turrets: number; welds: number; missions: number }

export const EMPTY_STATS: Stats = { runs: 0, kills: 0, timeMs: 0, shots: 0, hits: 0, turrets: 0, welds: 0, missions: 0 };

/** Adds a finished run to the totals; `won` counts a campaign mission won. */
export function addStats(stats: Stats, r: Report, won: boolean): Stats
{
    return {
        runs: stats.runs + 1, kills: stats.kills + r.kills, timeMs: stats.timeMs + r.timeMs, shots: stats.shots + r.shots,
        hits: stats.hits + Math.round(r.shots * r.accuracy), turrets: stats.turrets + r.built.turrets, welds: stats.welds + r.built.welds,
        missions: stats.missions + (won ? 1 : 0),
    };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates what is read from storage: a map from arena id to its record. */
export function isRecords(v: unknown): v is Record<string, ArenaRecord>
{
    return isObject(v) && Object.values(v).every(r =>
        isObject(r) && (['wave', 'score', 'kills', 'timeMs', 'runs'] as const).every(k => typeof r[k] === 'number' && Number.isFinite(r[k])));
}
