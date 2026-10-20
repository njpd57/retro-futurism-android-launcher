/** CUARENTENA: package name -> daily budget in minutes (0 = no budget, only the gate). */
export type Quarantine = Record<string, number>;

export const DEFAULT_BUDGET_MIN = 30;
export const MAX_BUDGET_MIN = 240;
export const BUDGET_STEP_MIN = 5;
/** Seconds the gate keeps [AUTORIZAR] shut. */
export const COUNTDOWN_S = 10;
export const MAX_REASON = 60;

export interface BudgetState
{
    usedMin: number;
    budgetMin: number;
    exceeded: boolean;
    /** used / budget, capped at 1; 0 with no budget */
    fraction: number;
}

export function budgetState(usedMs: number, budgetMin: number): BudgetState
{
    const usedMin = Math.floor(Math.max(0, usedMs) / 60_000);
    const exceeded = budgetMin > 0 && usedMin >= budgetMin;
    return { usedMin, budgetMin, exceeded, fraction: budgetMin > 0 ? Math.min(1, usedMin / budgetMin) : 0 };
}

/** `INSTAGRAM 34/30 MIN — EXCEDIDO`, `INSTAGRAM 12/30 MIN — DENTRO DEL LÍMITE`, `INSTAGRAM 12 MIN HOY — SIN PRESUPUESTO` */
export function budgetLine(label: string, usedMs: number, budgetMin: number): string
{
    const s = budgetState(usedMs, budgetMin);
    const name = label.toUpperCase();
    if (!s.budgetMin) return `${name} ${s.usedMin} MIN HOY — SIN PRESUPUESTO`;
    return `${name} ${s.usedMin}/${s.budgetMin} MIN — ${s.exceeded ? 'EXCEDIDO' : 'DENTRO DEL LÍMITE'}`;
}

/** Whole seconds left of the countdown, 0 when it is over. */
export function countdownLeft(startedAt: number, now: number): number
{
    return Math.max(0, COUNTDOWN_S - Math.floor((now - startedAt) / 1000));
}

export const canAuthorize = (startedAt: number, now: number, reason: string) =>
    countdownLeft(startedAt, now) === 0 && reason.trim().length > 0;

/** One step of the budget: 0 (no budget), then 5..240 minutes. */
export function stepBudget(current: number, direction: 1 | -1): number
{
    const next = current + direction * BUDGET_STEP_MIN;
    return Math.max(0, Math.min(MAX_BUDGET_MIN, next));
}

export const cleanReason = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, MAX_REASON);

/** Reads what was saved: anything that is not a package name with a sane budget is dropped. */
export function normalizeQuarantine(raw: unknown): Quarantine
{
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const out: Quarantine = {};
    for (const [pkg, budget] of Object.entries(raw))
        if (pkg && typeof budget === 'number' && Number.isFinite(budget))
            out[pkg] = Math.max(0, Math.min(MAX_BUDGET_MIN, Math.round(budget)));
    return out;
}
