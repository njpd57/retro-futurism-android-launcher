import type { Alien, AlienMode } from './alien';
import { DECKS } from './decks';
import { newGame, type GameState } from './game';
import { cellAt, parseMap, type Dir } from './grid';
import type { Rng } from './rng';

/** What a save or a suspended game keeps: only what changes, the deck itself comes from `DECKS`. */
export interface SavedGame
{
    v: 1;
    deck: string;
    closed: number[];
    items: number[];
    collected: number;
    player: { cell: number; dir: Dir; hidden: boolean };
    alien: Alien;
    hides: Record<string, number>;
    timeMs: number;
}

export function snapshot(s: GameState): SavedGame
{
    return {
        v: 1,
        deck: s.deck,
        closed: [...s.closed],
        items: [...s.items],
        collected: s.collected,
        player: { cell: s.player.cell, dir: s.player.dir, hidden: s.player.hidden },
        alien: { ...s.alien, vent: s.alien.vent && { ...s.alien.vent } },
        hides: { ...s.hides },
        timeMs: s.timeMs,
    };
}

/** The game as it was saved, with the tracker down and nothing in progress. */
export function restore(saved: SavedGame, rng: Rng): GameState
{
    const base = newGame(DECKS[saved.deck], rng);
    return {
        ...base,
        closed: saved.closed,
        items: saved.items,
        collected: saved.collected,
        player: { ...saved.player, busyMs: 0 },
        alien: saved.alien,
        hides: saved.hides,
        timeMs: saved.timeMs,
    };
}

const MODES: readonly AlienMode[] = ['patrol', 'investigate', 'hunt', 'search'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates anything read from storage: an old or damaged save must not break the game. */
export function isSavedGame(v: unknown): v is SavedGame
{
    if (!isObject(v) || v.v !== 1 || typeof v.deck !== 'string' || !(v.deck in DECKS)) return false;
    const { grid } = parseMap(DECKS[v.deck].map);
    const isCell = (c: unknown): c is number => Number.isInteger(c) && (c as number) >= 0 && (c as number) < grid.cells.length;
    const isOpen = (c: unknown) => isCell(c) && cellAt(grid, c) !== 'wall';
    const cells = (list: unknown) => Array.isArray(list) && list.every(isCell);

    if (!cells(v.closed) || !cells(v.items) || !isNumber(v.collected) || !isNumber(v.timeMs)) return false;
    if (!isObject(v.hides) || !Object.values(v.hides).every(isNumber)) return false;

    const p = v.player;
    if (!isObject(p) || !isOpen(p.cell) || ![0, 1, 2, 3].includes(p.dir as number) || typeof p.hidden !== 'boolean') return false;

    const a = v.alien;
    if (!isObject(a) || !isOpen(a.cell) || !isOpen(a.target) || !MODES.includes(a.mode as AlienMode)) return false;
    if (![a.stepMs, a.forceMs, a.stillMs, a.searchMs, a.seenMs].every(isNumber) || typeof a.sawHide !== 'boolean') return false;
    if (a.ventPlan !== null && !isOpen(a.ventPlan)) return false;
    const t = a.vent;
    if (t !== null && !(isObject(t) && isOpen(t.from) && isOpen(t.to) && isNumber(t.ms) && isNumber(t.totalMs) && t.totalMs > 0)) return false;
    return true;
}
