import { describe, expect, it } from 'vitest';
import { hear, stepKind, VOICES } from '../acoustics';
import { shutDoors } from '../doors';
import { PORTALS, START, type Zone } from '../world';

const shut = shutDoors();
const open = PORTALS.map(() => 1);
const loudest = (h: ReturnType<typeof hear>) => (Object.entries(h) as [Zone, { gain: number }][]).sort((a, b) => b[1].gain - a[1].gain)[0][0];

describe('voices', () =>
{
    it('define every zone and breathe within what a gain can take', () =>
    {
        for (const z of ['puente', 'comms', 'motor', 'bodega', 'enfermeria', 'hipersueno', 'comedor', 'camarotes', 'hangar', 'pasillo'] as Zone[])
        {
            const v = VOICES[z];
            expect(v, z).toBeDefined();
            expect(v.tone || v.hush, z).toBeTruthy();
            expect(v.level).toBeGreaterThan(0);
            expect(v.level).toBeLessThanOrEqual(1);
            if (v.wobble) expect(v.wobble.depth).toBeLessThanOrEqual(0.5);
        }
    });
});

describe('hearing the ship', () =>
{
    it('hears its own room best and the far ones not at all', () =>
    {
        const h = hear(START.x, START.y, 0, shut);
        expect(loudest(h)).toBe('puente');
        expect(h.motor.gain).toBeLessThan(0.02);
        expect(h.hangar.gain).toBeLessThan(0.02);
        expect(h.pasillo.gain).toBe(0);
    });

    it('lets a neighbour through a doorway, more when it is open', () =>
    {
        // in the mess, a few steps from the door to the sickbay
        const closed = hear(2, 0, 0, shut).enfermeria.gain;
        const wide = hear(2, 0, 0, open).enfermeria.gain;
        expect(closed).toBeGreaterThan(0);
        expect(wide).toBeGreaterThan(closed * 2);
    });

    it('softens with every doorway and every metre', () =>
    {
        const near = hear(2, 0, 0, open);
        expect(near.enfermeria.gain).toBeGreaterThan(near.hipersueno.gain);
        expect(near.hipersueno.gain).toBeGreaterThan(near.hangar.gain);
    });

    it('puts a sound on the side it comes from', () =>
    {
        // standing in the mess facing north: the sickbay is east (right), COMMS west (left)
        const h = hear(0, 2, 0, open);
        expect(h.enfermeria.pan).toBeGreaterThan(0.3);
        expect(h.comms.pan).toBeLessThan(-0.3);
        // turn round and it swaps
        const back = hear(0, 2, Math.PI, open);
        expect(back.enfermeria.pan).toBeLessThan(-0.3);
        for (const z of Object.values(h)) expect(Math.abs(z.pan)).toBeLessThanOrEqual(0.85);
    });

    it('always hears the corridor it stands in, and only that one', () =>
    {
        expect(hear(0, -10, 0, shut).pasillo.gain).toBe(1);
        expect(hear(0, -9, 0, shut).comedor.gain).toBeGreaterThan(0);
    });

    it('is silent outside the ship', () =>
    {
        const h = hear(500, 500, 0, open);
        for (const z of Object.values(h)) expect(z.gain).toBe(0);
    });
});

describe('steps', () =>
{
    it('ring on gratings in the working rooms and thud on plates elsewhere', () =>
    {
        expect(stepKind('motor')).toBe('grate');
        expect(stepKind('pasillo')).toBe('grate');
        expect(stepKind('puente')).toBe('plate');
        expect(stepKind(undefined)).toBe('plate');
    });
});
