import { describe, expect, it } from 'vitest';
import { newGame, type RerouteState } from '../reroute';
import { CRITICAL, rerouteMessages } from '../rerouteLog';

const base = (over: Partial<RerouteState> = {}): RerouteState => ({ ...newGame(() => 0.5), alloc: [2, 2, 2], need: [2, 2, 2], integrity: [100, 100, 100], ...over });
const rng = () => 0;

describe('rerouteMessages', () =>
{
    it('warns about the system with the biggest shortfall on a new demand', () =>
    {
        const s = base({ need: [3, 4, 1] });
        const [msg] = rerouteMessages(s, s, ['demand'], rng);
        expect(msg).toContain('SOPORTE VITAL');
    });

    it('is silent when a demand has no shortfall', () =>
    {
        const s = base({ need: [1, 1, 1] });
        expect(rerouteMessages(s, s, ['demand'], rng)).toEqual([]);
    });

    it('reports a system crossing into and out of critical', () =>
    {
        const down = rerouteMessages(base(), base({ integrity: [100, CRITICAL - 5, 100] }), [], rng);
        expect(down).toHaveLength(1);
        expect(down[0]).toContain('SOPORTE VITAL');
        expect(down[0]).toContain('30%');
        const up = rerouteMessages(base({ integrity: [100, 20, 100] }), base({ integrity: [100, CRITICAL + 1, 100] }), [], rng);
        expect(up[0]).toContain('SOPORTE VITAL');
    });

    it('does not repeat while a system stays critical', () =>
    {
        const s = base({ integrity: [10, 100, 100] });
        expect(rerouteMessages(s, s, [], rng)).toEqual([]);
    });

    it('names the system that failed and ends with the special order', () =>
    {
        const next = base({ phase: 'lost', integrity: [100, 100, 0] });
        const [msg] = rerouteMessages(base(), next, ['lost'], rng);
        expect(msg).toContain('SENSORES');
        expect(msg.endsWith('ORDEN ESPECIAL 937.')).toBe(true);
    });
});
