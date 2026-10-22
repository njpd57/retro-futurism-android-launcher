import { describe, expect, it } from 'vitest';
import { figureVertices } from '../figures';
import { STRIDE } from '../mesh';
import { headTurn, poseCat, posePerson, type Part, type PersonPose } from '../pose';

const base: PersonPose = { phase: 0, gesture: 'idle', time: 0, tall: 1, headYaw: 0 };
const lowest = (parts: Part[]) => Math.min(...parts.flatMap(p => [p.a[1] - p.d / 2, p.b[1] - p.d / 2]));
const highest = (parts: Part[]) => Math.max(...parts.flatMap(p => [p.a[1], p.b[1]]));

describe('person poses', () =>
{
    it('stand on the floor, about as tall as a person; the android taller', () =>
    {
        const crew = posePerson(base);
        expect(Math.abs(lowest(crew))).toBeLessThan(0.04);
        expect(highest(crew)).toBeGreaterThan(1.65);
        expect(highest(crew)).toBeLessThan(1.8);
        expect(highest(posePerson({ ...base, tall: 1.12, android: true }))).toBeGreaterThan(1.85);
    });

    it('are mirror images at rest', () =>
    {
        for (const p of posePerson(base))
        {
            const twin = posePerson(base).find(q => Math.abs(q.a[0] + p.a[0]) < 1e-9 && Math.abs(q.a[1] - p.a[1]) < 1e-9 && Math.abs(q.b[2] - p.b[2]) < 1e-9);
            expect(twin, JSON.stringify(p)).toBeDefined();
        }
    });

    it('walk with one foot on the floor and the legs swinging against each other', () =>
    {
        for (let phase = 0; phase < Math.PI * 2; phase += 0.3)
        {
            const parts = posePerson({ ...base, gesture: 'walk', phase });
            // feet never go through the floor
            expect(lowest(parts), `phase ${phase.toFixed(1)}`).toBeGreaterThan(-0.04);
        }
        const step = posePerson({ ...base, gesture: 'walk', phase: Math.PI / 2 });
        // thighs are the first part of each leg
        const left = step[0];
        const right = step[3];
        expect(left.b[2]).toBeGreaterThan(0.1);
        expect(right.b[2]).toBeLessThan(-0.1);
    });

    it('type with the hands out in front at desk height', () =>
    {
        const hands = posePerson({ ...base, gesture: 'typing' }).filter((_, i) => i === 8 || i === 10).map(p => p.b);
        for (const h of hands)
        {
            expect(h[2]).toBeGreaterThan(0.3);
            expect(h[1]).toBeGreaterThan(0.9);
            expect(h[1]).toBeLessThan(1.3);
        }
    });

    it('turn the head, and the android its visor with it', () =>
    {
        const parts = posePerson({ ...base, headYaw: 0.5, android: true });
        const visor = parts.find(p => p.glow)!;
        expect(visor.turn).toBe(0.5);
        expect(visor.a[0]).toBeGreaterThan(0);
    });
});

describe('cat', () =>
{
    it('stands on four legs with its eyes forward and its tail up behind', () =>
    {
        const parts = poseCat(0, false, 0);
        expect(parts.filter(p => p.b[1] === 0)).toHaveLength(4);
        expect(parts.find(p => p.glow)!.a[2]).toBeGreaterThan(0.3);
        expect(highest(parts)).toBeLessThan(0.65);
    });
});

describe('head turn', () =>
{
    it('looks at someone near and in front, never over the shoulder or from afar', () =>
    {
        // facing north; someone to the north-east is to the right
        expect(headTurn(0, 0, 0, 1, -1)).toBeGreaterThan(0.5);
        expect(headTurn(0, 0, 0, -1, -1)).toBeLessThan(-0.5);
        expect(headTurn(0, 0, 0, 0, 2)).toBe(0);
        expect(headTurn(0, 0, 0, 0, -5)).toBe(0);
        expect(Math.abs(headTurn(0, 0, 0, 2, 0))).toBeLessThanOrEqual(0.9);
    });
});

describe('crew triangles', () =>
{
    it('mark a busy crew member to blink and nobody else', () =>
    {
        const agents = [{ id: 'a', kind: 'signal' as const, x: 0, y: 0, yaw: 0 }, { id: 'b', kind: 'signal' as const, x: 2, y: 0, yaw: 0 }];
        const data = figureVertices(agents, 0, new Set(), { alert: new Set(['a']) });
        const half = data.length / 2;
        const emits = (from: number, to: number) => { const out = new Set<number>(); for (let v = from; v < to; v += STRIDE) out.add(data[v + 9]); return out; };
        expect([...emits(0, half)]).toEqual([1]);
        expect([...emits(half, data.length)]).toEqual([0]);
    });
});
