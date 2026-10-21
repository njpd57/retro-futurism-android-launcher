export const BOOT_STEP_MS = 160;

/** Lines of the boot screen. `memoryKb` makes the memory test count up to a believable number. */
export function bootLines(memoryKb = 640): string[]
{
    return [
        'MU-TH-UR 6000 · TERMINAL DE INTERFAZ',
        'BIOS v2.4.1979',
        `COMPROBANDO MEMORIA ... ${memoryKb}K OK`,
        'FÓSFORO ........... OK',
        'ENLACE BRIDGE ..... OK',
        'CARGANDO DIRECTORIO DE APPS',
        '',
        'SISTEMA EN LÍNEA',
    ];
}

/** How many lines are visible after `elapsedMs`. */
export function visibleBootLines(total: number, elapsedMs: number, stepMs = BOOT_STEP_MS)
{
    return Math.min(total, Math.max(1, Math.floor(elapsedMs / stepMs) + 1));
}

/** Share of a line's step spent typing it; the rest is the pause before the next line. */
export const BOOT_TYPE_SHARE = 0.8;

/**
 * The boot screen at `elapsedMs` with each line typed in turn: the lines before the current one whole, the current
 * one partly. With `typed` false every line appears whole at the start of its step (the old behaviour).
 */
export function bootFrame(lines: string[], elapsedMs: number, typed = true, stepMs = BOOT_STEP_MS): string[]
{
    const count = visibleBootLines(lines.length, elapsedMs, stepMs);
    const out = lines.slice(0, count);
    if (!typed || count === 0) return out;
    const current = lines[count - 1];
    const inStep = elapsedMs - (count - 1) * stepMs;
    const chars = Math.min(current.length, Math.floor((inStep / (stepMs * BOOT_TYPE_SHARE)) * current.length));
    out[count - 1] = current.slice(0, Math.max(0, chars));
    return out;
}

/** One step of the long boot: how long it lasts and what its line shows at progress `p` (0..1). */
export interface BootStep { ms: number; line: (p: number) => string }

const typedLine = (text: string, ms: number): BootStep => ({
    ms,
    line: p => text.slice(0, Math.floor(Math.min(1, p / BOOT_TYPE_SHARE) * text.length)),
});

/** A line whose number counts up to `max` while the step runs; `done` is added at the end. */
const counterLine = (prefix: string, max: number, unit: string, done: string, ms: number): BootStep => ({
    ms,
    line: p => `${prefix}${Math.round(max * Math.min(1, p))}${unit}${p >= 1 ? done : ''}`,
});

/** A line with a bar that fills while the step runs. */
const barLine = (prefix: string, width: number, ms: number): BootStep => ({
    ms,
    line: p =>
    {
        const filled = Math.round(width * Math.min(1, Math.max(0, p)));
        return `${prefix}[${'▓'.repeat(filled)}${'░'.repeat(width - filled)}] ${Math.round(100 * Math.min(1, Math.max(0, p)))}%`;
    },
});

/** The long boot: the memory test counts up and the directory bar fills; the rest is typed. */
export function bootScript(memoryKb = 640): BootStep[]
{
    return [
        typedLine('MU-TH-UR 6000 · TERMINAL DE INTERFAZ', 300),
        typedLine('BIOS v2.4.1979', 200),
        counterLine('COMPROBANDO MEMORIA ... ', memoryKb, 'K', ' OK', 700),
        typedLine('FÓSFORO ........... OK', 200),
        typedLine('ENLACE BRIDGE ..... OK', 200),
        barLine('CARGANDO DIRECTORIO DE APPS ', 10, 600),
        { ms: 100, line: () => '' },
        typedLine('SISTEMA EN LÍNEA', 250),
    ];
}

export function bootScriptMs(script: BootStep[]): number
{
    return script.reduce((sum, step) => sum + step.ms, 0);
}

/** The screen at `elapsedMs`: the finished steps whole, the running one at its progress. */
export function bootScreen(script: BootStep[], elapsedMs: number): string[]
{
    const out: string[] = [];
    let start = 0;
    for (const step of script)
    {
        const p = (elapsedMs - start) / step.ms;
        if (p < 0 && out.length > 0) break;
        out.push(step.line(Math.min(1, Math.max(0, p))));
        if (p < 1) break;
        start += step.ms;
    }
    return out;
}
