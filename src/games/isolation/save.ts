import type { Alien, AlienMode } from './alien';
import { isBag } from './crafting';
import { DECKS } from './decks';
import { newGame, type Decoy, type Flare, type GameState } from './game';
import { cellAt, parseMap, type Dir, type Loot, type LootKind } from './grid';
import type { Rng } from './rng';

/** What a save or a suspended game keeps: only what changes, the deck itself comes from `DECKS`. */
export interface SavedGame
{
    v: 2;
    deck: string;
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
        v: 2,
        deck: s.deck,
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
    const base = newGame(DECKS[saved.deck], rng);
    return {
        ...base,
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
    };
}

const MODES: readonly AlienMode[] = ['patrol', 'investigate', 'hunt', 'search', 'flee'];
const LOOT_KINDS: readonly LootKind[] = ['scrap', 'wires', 'chems', 'flamer'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates anything read from storage: an old or damaged save must not break the game. */
export function isSavedGame(v: unknown): v is SavedGame
{
    if (!isObject(v) || v.v !== 2 || typeof v.deck !== 'string' || !(v.deck in DECKS)) return false;
    const { grid } = parseMap(DECKS[v.deck].map);
    const isCell = (c: unknown): c is number => Number.isInteger(c) && (c as number) >= 0 && (c as number) < grid.cells.length;
    const isOpen = (c: unknown) => isCell(c) && cellAt(grid, c) !== 'wall';
    const cells = (list: unknown) => Array.isArray(list) && list.every(isCell);

    if (!cells(v.closed) || !cells(v.items) || !isNumber(v.collected) || !isNumber(v.timeMs)) return false;
    if (!isObject(v.hides) || !Object.values(v.hides).every(isNumber) || !isNumber(v.burns)) return false;
    if (!isBag(v.bag)) return false;
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
