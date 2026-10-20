import type { Bag } from './crafting';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface DifficultyDef
{
    label: string;
    hint: string;
    /** multiplies the time between the creature's moves: more is slower */
    pace: number;
    /** cells the creature sees along a corridor */
    sight: number;
    /** added to the time on a self-destruct countdown */
    countdownMs: number;
    /** handed to the player at the start of every deck, on top of what they carry */
    gift: Partial<Pick<Bag, 'decoys' | 'flares'>>;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
    easy: { label: 'FÁCIL', hint: 'ORGANISMO LENTO. SEÑUELO Y BENGALA DE REGALO.', pace: 1.3, sight: 5, countdownMs: 90000, gift: { decoys: 1, flares: 1 } },
    normal: { label: 'NORMAL', hint: 'LA NOSTROMO TAL COMO ERA.', pace: 1, sight: 7, countdownMs: 0, gift: {} },
    hard: { label: 'DIFÍCIL', hint: 'ORGANISMO RÁPIDO Y DE VISTA AGUDA.', pace: 0.85, sight: 8, countdownMs: -45000, gift: {} },
};

export const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);
