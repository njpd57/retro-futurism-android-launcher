import { SYSTEMS, type Rng, type RerouteEvent, type RerouteState } from './reroute';

/** Integrity (0-100) below which a system counts as failing. */
export const CRITICAL = 35;

// `{s}` is the system's name; every list is picked with the injected RNG
const DEMAND = [
    'PRESIÓN EN EL SECTOR 4. {s} REQUIERE REFUERZO.',
    'CAÍDA DE TENSIÓN. {s} SOLICITA MÁS ENERGÍA.',
    'ANOMALÍA EN CUBIERTA. {s} EN DEMANDA.',
];
const CRITICAL_LINES = [
    '{s} AL {n}%. SE RECOMIENDA ACCIÓN INMEDIATA.',
    'ADVERTENCIA: {s} EN ESTADO CRÍTICO ({n}%).',
];
const STABLE = [
    '{s} ESTABILIZADO.',
    '{s} DENTRO DE PARÁMETROS.',
];
const LOST: Record<(typeof SYSTEMS)[number], string> = {
    'PUERTAS': 'FALLO DE PUERTAS. SECTOR ABIERTO AL VACÍO.',
    'SOPORTE VITAL': 'FALLO DE SOPORTE VITAL. TRIPULACIÓN NO VIABLE.',
    'SENSORES': 'SENSORES FUERA DE LÍNEA. CONTACTO NO DETECTADO.',
};
const LOST_TAIL = 'ORDEN ESPECIAL 937.';

const pick = <T>(list: readonly T[], rng: Rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
const fill = (line: string, system: number, n = 0) => line.replace('{s}', SYSTEMS[system]).replace('{n}', String(Math.round(n)));

/** Ship messages for what changed between two states: a new demand, a system turning critical or recovering, or the loss. */
export function rerouteMessages(prev: RerouteState, next: RerouteState, events: readonly RerouteEvent[], rng: Rng): string[]
{
    const out: string[] = [];

    if (events.includes('lost'))
    {
        const failed = next.integrity.findIndex(v => v <= 0);
        return [`${LOST[SYSTEMS[Math.max(0, failed)]]} ${LOST_TAIL}`];
    }

    SYSTEMS.forEach((_, i) =>
    {
        if (prev.integrity[i] >= CRITICAL && next.integrity[i] < CRITICAL) out.push(fill(pick(CRITICAL_LINES, rng), i, next.integrity[i]));
        else if (prev.integrity[i] < CRITICAL && next.integrity[i] >= CRITICAL) out.push(fill(pick(STABLE, rng), i));
    });

    if (events.includes('demand'))
    {
        // the system with the biggest shortfall is the one MOTHER warns about; no shortfall, nothing to say
        let worst = -1;
        let gap = 0;
        next.need.forEach((n, i) => { if (n - next.alloc[i] > gap) { gap = n - next.alloc[i]; worst = i; } });
        if (worst >= 0) out.push(fill(pick(DEMAND, rng), worst));
    }

    return out;
}
