import { describe, expect, it } from 'vitest';
import { SOUND_CATALOG, MIX_MAX, gainOf, normalizeMix, soundsOf, withGain, withoutBus } from '../mix';

describe('sound mix', () =>
{
    it('lists every sound once, each in a known channel', () =>
    {
        const ids = SOUND_CATALOG.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of SOUND_CATALOG)
        {
            expect(['ui', 'ambient', 'game']).toContain(s.bus);
            expect(s.label).toBe(s.label.toUpperCase());
        }
        expect(soundsOf('ambient')).toHaveLength(6);
    });

    it('defaults to the designed level', () =>
    {
        expect(gainOf({}, 'key')).toBe(1);
        expect(gainOf({ key: 0.5 }, 'key')).toBe(0.5);
    });

    it('cleans a stored mix', () =>
    {
        expect(normalizeMix(null)).toEqual({});
        expect(normalizeMix('x')).toEqual({});
        expect(normalizeMix({ key: 0.5, nope: 0.5, door: 'loud', step: NaN, blast: 9, hurt: -1, kill: 1 })).toEqual({ key: 0.5, blast: MIX_MAX, hurt: 0 });
    });

    it('sets and removes one sound', () =>
    {
        expect(withGain({}, 'key', 0.5)).toEqual({ key: 0.5 });
        expect(withGain({ key: 0.5, door: 0.2 }, 'key', 1)).toEqual({ door: 0.2 });
        expect(withGain({}, 'key', 5)).toEqual({ key: MIX_MAX });
    });

    it('resets a whole channel', () =>
    {
        expect(withoutBus({ key: 0.5, door: 0.2, ambHum: 0.3 }, 'ui')).toEqual({ door: 0.2, ambHum: 0.3 });
    });
});
