import type { Alien, AlienMode } from './alien';
import type { Ash } from './android';
import { isBag } from './crafting';
import { deckFor } from './decks';
import { isDifficulty, type Difficulty } from './difficulty';
import { newGame, syncBlackout, type Decoy, type Flare, type GameState } from './game';
import { cellAt, parseMap, type Dir, type Loot, type LootKind } from './grid';
import type { Rng } from './rng';

/** What a save or a suspended game keeps: only what changes, the deck itself comes from `deckFor`. */
export interface SavedGame
{
    v: 3;
    deck: string;
    difficulty: Difficulty;
    locked: number[];
    ash: Ash | null;
    countdownMs: number | null;
    jones: boolean;
    logs: string[];
    fires: number;
    spotted: number;
    spottedStart: number;
    score: number;
    mapped: boolean;
    startMs: number;
    closed: number[];
    items: number[];
    loot: Loot[];
    bag: GameState['bag'];
    decoys: Decoy[];
    flares: Flare[];
    burns: number;
    collected: number;
    player: { cell: number; dir: Dir; hidden: boolean };
    alien: Alien;
    hides: Record<string, number>;
    timeMs: number;
}

export function snapshot(s: GameState): SavedGame
{
    return {
        v: 3,
        deck: s.deck,
        difficulty: s.difficulty,
        locked: [...s.locked],
        ash: s.ash && { ...s.ash },
        countdownMs: s.countdownMs,
        jones: s.jones,
        logs: [...s.logs],
        fires: s.fires,
        spotted: s.spotted,
        spottedStart: s.spottedStart,
        score: s.score,
        mapped: s.mapped,
        startMs: s.startMs,
        closed: [...s.closed],
        items: [...s.items],
        loot: s.loot.map(l => ({ ...l })),
        bag: { ...s.bag },
        decoys: s.decoys.map(d => ({ ...d })),
        flares: s.flares.map(f => ({ ...f, lit: [...f.lit] })),
        burns: s.burns,
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
    const base = newGame(deckFor(saved.deck)!, rng, { difficulty: saved.difficulty, bag: saved.bag, jones: saved.jones, logs: saved.logs, fires: saved.fires, spotted: saved.spotted, score: saved.score, timeMs: saved.timeMs });
    return syncBlackout({
        ...base,
        locked: saved.locked,
        ash: saved.ash,
        countdownMs: saved.countdownMs,
        mapped: saved.mapped,
        spottedStart: saved.spottedStart,
        startMs: saved.startMs,
        closed: saved.closed,
        items: saved.items,
        loot: saved.loot,
        bag: saved.bag,
        decoys: saved.decoys,
        flares: saved.flares,
        burns: saved.burns,
        collected: saved.collected,
        player: { ...saved.player, busyMs: 0 },
        alien: saved.alien,
        hides: saved.hides,
        timeMs: saved.timeMs,
    });
}

const MODES: readonly AlienMode[] = ['patrol', 'investigate', 'hunt', 'search', 'flee'];
const LOOT_KINDS: readonly LootKind[] = ['scrap', 'wires', 'chems', 'flamer', 'cat'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates anything read from storage: an old or damaged save must not break the game. */
export function isSavedGame(v: unknown): v is SavedGame
{
    if (!isObject(v) || v.v !== 3 || typeof v.deck !== 'string') return false;
    const deck = deckFor(v.deck);
    if (!deck) return false;
    const { grid } = parseMap(deck.map);
    const isCell = (c: unknown): c is number => Number.isInteger(c) && (c as number) >= 0 && (c as number) < grid.cells.length;
    const isOpen = (c: unknown) => isCell(c) && cellAt(grid, c) !== 'wall';
    const cells = (list: unknown) => Array.isArray(list) && list.every(isCell);

    if (!cells(v.closed) || !cells(v.items) || !isNumber(v.collected) || !isNumber(v.timeMs)) return false;
    if (!isObject(v.hides) || !Object.values(v.hides).every(isNumber) || !isNumber(v.burns)) return false;
    if (!isBag(v.bag) || !isDifficulty(v.difficulty)) return false;
    if (!cells(v.locked) || !isNumber(v.fires) || !isNumber(v.spotted) || !isNumber(v.spottedStart) || !isNumber(v.score) || !isNumber(v.startMs)) return false;
    if (typeof v.jones !== 'boolean' || typeof v.mapped !== 'boolean') return false;
    if (!Array.isArray(v.logs) || !v.logs.every(l => typeof l === 'string')) return false;
    if (v.countdownMs !== null && !isNumber(v.countdownMs)) return false;
    if (v.ash !== null)
    {
        const h = v.ash;
        if (!isObject(h) || !isOpen(h.cell) || !isOpen(h.target) || typeof h.active !== 'boolean' || !isNumber(h.stepMs) || (h.mode !== 'wander' && h.mode !== 'chase')) return false;
    }
    if (!Array.isArray(v.loot) || !v.loot.every(l => isObject(l) && isOpen(l.cell) && LOOT_KINDS.includes(l.kind as LootKind))) return false;
    if (!Array.isArray(v.decoys) || !v.decoys.every(d => isObject(d) && isOpen(d.cell) && isNumber(d.ms) && isNumber(d.pulseMs))) return false;
    if (!Array.isArray(v.flares) || !v.flares.every(f => isObject(f) && isOpen(f.cell) && isNumber(f.ms) && cells(f.lit))) return false;

    const p = v.player;
    if (!isObject(p) || !isOpen(p.cell) || ![0, 1, 2, 3].includes(p.dir as number) || typeof p.hidden !== 'boolean') return false;

    const a = v.alien;
    if (!isObject(a) || !isOpen(a.cell) || !isOpen(a.target) || !MODES.includes(a.mode as AlienMode)) return false;
    if (![a.stepMs, a.forceMs, a.stillMs, a.searchMs, a.seenMs, a.fleeMs].every(isNumber) || typeof a.sawHide !== 'boolean') return false;
    if (a.ventPlan !== null && !isOpen(a.ventPlan)) return false;
    const t = a.vent;
    if (t !== null && !(isObject(t) && isOpen(t.from) && isOpen(t.to) && isNumber(t.ms) && isNumber(t.totalMs) && t.totalMs > 0)) return false;
    return true;
}
