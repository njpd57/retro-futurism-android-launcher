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
    return Math.min(total, Math.max(0, Math.floor(elapsedMs / stepMs) + 1));
}
