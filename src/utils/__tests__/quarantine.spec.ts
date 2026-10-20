import { describe, expect, it } from 'vitest';
import { budgetLine, budgetState, canAuthorize, cleanReason, COUNTDOWN_S, countdownLeft, MAX_BUDGET_MIN, normalizeQuarantine, stepBudget } from '../quarantine';

const MIN = 60_000;

describe('budget', () =>
{
    it('compares the minutes used with the budget', () =>
    {
        expect(budgetState(12 * MIN, 30)).toEqual({ usedMin: 12, budgetMin: 30, exceeded: false, fraction: 0.4 });
        expect(budgetState(34 * MIN, 30).exceeded).toBe(true);
        expect(budgetState(30 * MIN, 30).exceeded).toBe(true);
        expect(budgetState(34 * MIN, 30).fraction).toBe(1);
    });

    it('has no limit when the budget is 0', () =>
    {
        expect(budgetState(500 * MIN, 0)).toEqual({ usedMin: 500, budgetMin: 0, exceeded: false, fraction: 0 });
    });

    it('writes the line the gate shows', () =>
    {
        expect(budgetLine('Instagram', 34 * MIN, 30)).toBe('INSTAGRAM 34/30 MIN — EXCEDIDO');
        expect(budgetLine('Instagram', 12 * MIN, 30)).toBe('INSTAGRAM 12/30 MIN — DENTRO DEL LÍMITE');
        expect(budgetLine('Instagram', 12 * MIN, 0)).toBe('INSTAGRAM 12 MIN HOY — SIN PRESUPUESTO');
    });

    it('rounds partial minutes down and ignores negatives', () =>
    {
        expect(budgetState(59_999, 30).usedMin).toBe(0);
        expect(budgetState(-5, 30).usedMin).toBe(0);
    });
});

describe('countdown', () =>
{
    it('counts down whole seconds and stops at 0', () =>
    {
        expect(countdownLeft(1000, 1000)).toBe(COUNTDOWN_S);
        expect(countdownLeft(1000, 1999)).toBe(COUNTDOWN_S);
        expect(countdownLeft(1000, 2000)).toBe(COUNTDOWN_S - 1);
        expect(countdownLeft(1000, 1000 + COUNTDOWN_S * 1000)).toBe(0);
        expect(countdownLeft(1000, 999_999)).toBe(0);
    });

    it('needs the wait to be over and a reason', () =>
    {
        const over = COUNTDOWN_S * 1000;
        expect(canAuthorize(0, over, 'trabajo')).toBe(true);
        expect(canAuthorize(0, over - 1, 'trabajo')).toBe(false);
        expect(canAuthorize(0, over, '   ')).toBe(false);
    });
});

describe('budget steps and saved data', () =>
{
    it('moves in fives between 0 and the maximum', () =>
    {
        expect(stepBudget(30, 1)).toBe(35);
        expect(stepBudget(5, -1)).toBe(0);
        expect(stepBudget(0, -1)).toBe(0);
        expect(stepBudget(MAX_BUDGET_MIN, 1)).toBe(MAX_BUDGET_MIN);
    });

    it('cleans the reason', () =>
    {
        expect(cleanReason('  mirar   el   correo ')).toBe('mirar el correo');
        expect(cleanReason('x'.repeat(200))).toHaveLength(60);
    });

    it('reads only sane budgets', () =>
    {
        expect(normalizeQuarantine({ a: 30, b: -5, c: 9999, d: 'x', e: NaN, '': 5 })).toEqual({ a: 30, b: 0, c: MAX_BUDGET_MIN });
        expect(normalizeQuarantine(null)).toEqual({});
        expect(normalizeQuarantine([1, 2])).toEqual({});
        expect(normalizeQuarantine('x')).toEqual({});
    });
});
