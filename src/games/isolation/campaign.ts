import { CAMPAIGN, playable } from './decks';
import type { Difficulty } from './difficulty';
import { generateDeck, generatedId, parseGeneratedId } from './generate';
import { carryOf, newGame, type GameState } from './game';
import type { Ending } from './logs';
import type { Rng } from './rng';

/**
 * The run: the campaign (five decks, one after another) or the endless mode (generated decks, each harder than the
 * last). A deck won hands its state over to the next one; the creature, the doors and the loot start fresh, the
 * player's bag, Jones, the logs and the counters go along.
 */

export type Mode = 'campaign' | 'infinite';

export const modeOf = (deckId: string): Mode => parseGeneratedId(deckId) ? 'infinite' : 'campaign';

/** 1-based position in the campaign, or the level of an endless deck. */
export function levelOf(deckId: string): number
{
    const g = parseGeneratedId(deckId);
    return g ? g.level : CAMPAIGN.findIndex(d => d.id === deckId) + 1;
}

export const CAMPAIGN_LENGTH = CAMPAIGN.length;

export const startCampaign = (difficulty: Difficulty, rng: Rng): GameState =>
    newGame(playable(CAMPAIGN[0]), rng, { difficulty, bag: { scrap: 0, wires: 0, chems: 0, decoys: 0, flares: 0, fuel: 0, flamer: false }, jones: false, logs: [], fires: 0, spotted: 0, score: 0, timeMs: 0 });

export const startInfinite = (seed: number, difficulty: Difficulty, rng: Rng): GameState =>
    newGame(playable(generateDeck(seed, 1)), rng, { difficulty, bag: { scrap: 0, wires: 0, chems: 0, decoys: 0, flares: 0, fuel: 0, flamer: false }, jones: false, logs: [], fires: 0, spotted: 0, score: 0, timeMs: 0 });

/** Points a deck is worth in the endless mode: depth, speed and not being seen. */
export function deckScore(s: GameState): number
{
    const level = levelOf(s.deck);
    const seconds = Math.round((s.timeMs - s.startMs) / 1000);
    return level * 100 + Math.max(0, 300 - seconds) + (s.spotted === s.spottedStart ? 100 : 0);
}

/** The next deck for a deck that has been won, or null when it was the last one of the campaign. */
export function advance(s: GameState, rng: Rng): GameState | null
{
    const carry = { ...carryOf(s), score: s.score + deckScore(s) };
    const g = parseGeneratedId(s.deck);
    if (g) return newGame(playable(generateDeck(g.seed, g.level + 1)), rng, carry);
    const i = CAMPAIGN.findIndex(d => d.id === s.deck);
    return i >= 0 && i < CAMPAIGN.length - 1 ? newGame(playable(CAMPAIGN[i + 1]), rng, carry) : null;
}

/** How the campaign ends for a player who reached the shuttle. */
export const endingOf = (s: GameState): Ending => s.jones ? 'jones' : 'solo';

/** The deck id of an endless run's current level, for the archive. */
export const endlessId = generatedId;
