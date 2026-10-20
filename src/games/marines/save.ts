import type { Grid } from '../isolation/grid';
import type { Spit, Turret, Weld } from './defenses';
import { missionById, type Rules } from './campaign';
import { ENEMIES, buildField, type Enemy, type EnemyKind } from './enemies';
import { newGame, type Acid, type MarinesState, type Player, type Wave } from './game';
import { ARENAS } from './map';
import type { Marine, Order } from './squad';
import { WEAPONS } from './weapons';

/** What a suspended game keeps: only what changes. The arena itself comes from `ARENAS`; grenades in the air and effects are dropped. */
export interface SavedGame
{
    v: 2;
    arena: string;
    mission: string | null;
    rules: Rules;
    queenOut: boolean;
    player: Player;
    marines: Marine[];
    order: Order;
    enemies: Enemy[];
    acid: Acid[];
    turrets: Turret[];
    welds: Weld[];
    spits: Spit[];
    taken: number[];
    nextId: number;
    wave: Wave;
    score: number;
    kills: number;
    killsBy: Record<EnemyKind, number>;
    built: { turrets: number; welds: number };
    shots: number;
    hits: number;
    timeMs: number;
}

export function snapshot(s: MarinesState): SavedGame
{
    return {
        v: 2,
        arena: s.arena,
        mission: s.mission,
        rules: { ...s.rules },
        queenOut: s.queenOut,
        player: { ...s.player, stash: { ...s.player.stash } },
        marines: s.marines.map(m => ({ ...m })),
        order: s.order,
        enemies: s.enemies.map(e => ({ ...e })),
        acid: s.acid.map(a => ({ ...a })),
        turrets: s.turrets.map(t => ({ ...t })),
        welds: s.welds.map(w => ({ ...w })),
        spits: s.spits.map(p => ({ ...p })),
        taken: s.pickups.flatMap(p => p.taken ? [p.cell] : []),
        nextId: s.nextId,
        wave: { ...s.wave },
        score: s.score,
        kills: s.kills,
        killsBy: { ...s.killsBy },
        built: { ...s.built },
        shots: s.shots,
        hits: s.hits,
        timeMs: s.timeMs,
    };
}

/** The game as it was left, with the tracker restarted. */
export function restore(saved: SavedGame): MarinesState
{
    const base = newGame(ARENAS[saved.arena]);
    const closed = [...base.closed, ...saved.welds.map(w => w.cell)];
    const p = saved.player;
    const here = Math.floor(p.y) * base.grid.w + Math.floor(p.x);
    return {
        ...base,
        closed,
        mission: saved.mission,
        rules: saved.rules,
        queenOut: saved.queenOut,
        pickups: base.pickups.map(k => ({ ...k, taken: saved.taken.includes(k.cell) })),
        player: { ...p, stash: { ...p.stash } },
        marines: saved.marines,
        order: saved.order,
        enemies: saved.enemies,
        acid: saved.acid,
        turrets: saved.turrets,
        welds: saved.welds,
        spits: saved.spits,
        nextId: saved.nextId,
        wave: saved.wave,
        score: saved.score,
        kills: saved.kills,
        killsBy: saved.killsBy,
        built: saved.built,
        shots: saved.shots,
        hits: saved.hits,
        timeMs: saved.timeMs,
        field: buildField(base.grid, closed, here, new Map(saved.welds.map((w): [number, number] => [w.cell, w.hp]))),
    };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numbers = (o: Record<string, unknown>, keys: readonly string[]) => keys.every(k => isNumber(o[k]));
const list = (v: unknown, ok: (o: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every(o => isObject(o) && ok(o));

/** Validates anything read from storage: an old or damaged save must not break the game. */
export function isSavedGame(v: unknown): v is SavedGame
{
    if (!isObject(v) || v.v !== 2 || typeof v.arena !== 'string' || !(v.arena in ARENAS)) return false;
    if (v.mission !== null && (typeof v.mission !== 'string' || !missionById(v.mission))) return false;
    if (typeof v.queenOut !== 'boolean') return false;
    if (!isObject(v.rules) || !numbers(v.rules, ['hp', 'count', 'hurt'])) return false;
    if (!numbers(v, ['nextId', 'score', 'kills', 'shots', 'hits', 'timeMs']) || (v.order !== 'follow' && v.order !== 'hold')) return false;

    const p = v.player;
    if (!isObject(p) || !numbers(p, ['x', 'y', 'yaw', 'health', 'armor', 'mag', 'reserve', 'grenades', 'turrets', 'welds', 'cooldownMs', 'reloadMs', 'heat', 'hurtMs', 'firedMs', 'launchMs', 'acidMs', 'grabMs', 'moveAmt'])) return false;
    if (typeof p.weapon !== 'string' || !(p.weapon in WEAPONS) || (p.health as number) <= 0) return false;
    if (!isObject(p.stash) || !Object.entries(p.stash).every(([k, a]) => k in WEAPONS && isObject(a) && numbers(a, ['mag', 'reserve']))) return false;

    const g: Grid = parseGrid(v.arena);
    const inside = (o: Record<string, unknown>) => isNumber(o.x) && isNumber(o.y) && o.x > 0 && o.y > 0 && o.x < g.w && o.y < g.h;
    if (!inside(p)) return false;
    if (!list(v.marines, m => inside(m) && numbers(m, ['id', 'hp', 'dirX', 'dirY', 'coolMs', 'flashMs', 'hitMs', 'stuckMs']) && typeof m.name === 'string' && typeof m.moving === 'boolean')) return false;
    if (!list(v.enemies, e => inside(e) && numbers(e, ['id', 'hp', 'dirX', 'dirY', 'windMs', 'coolMs', 'stuckMs', 'hitMs', 'burnMs']) && typeof e.kind === 'string' && e.kind in ENEMIES && typeof e.moving === 'boolean' && typeof e.clung === 'boolean')) return false;
    if (!list(v.acid, a => inside(a) && numbers(a, ['ms', 'r']))) return false;
    if (!list(v.turrets, t => inside(t) && numbers(t, ['id', 'yaw', 'hp', 'ammo', 'coolMs', 'flashMs', 'hitMs']))) return false;
    if (!list(v.welds, w => numbers(w, ['cell', 'hp']) && (w.cell as number) >= 0 && (w.cell as number) < g.w * g.h)) return false;
    if (!list(v.spits, s => numbers(s, ['id', 'x', 'y', 'tx', 'ty', 'ms', 'totalMs']))) return false;
    if (!Array.isArray(v.taken) || !v.taken.every(isNumber)) return false;
    const w = v.wave;
    if (!isObject(w) || !numbers(w, ['n', 'restMs', 'toSpawn', 'spawnMs']) || (w.phase !== 'rest' && w.phase !== 'fight')) return false;
    if (!isObject(v.killsBy) || !Object.keys(ENEMIES).every(k => isNumber((v.killsBy as Record<string, unknown>)[k]))) return false;
    return isObject(v.built) && numbers(v.built, ['turrets', 'welds']);
}

const parseGrid = (arena: string): Grid => newGame(ARENAS[arena]).grid;
