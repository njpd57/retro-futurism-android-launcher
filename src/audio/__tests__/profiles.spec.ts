import { describe, expect, it } from 'vitest';
import { ALWAYS_AUDIBLE, PROFILE_IDS, PROFILES, profileAllows, profileOf } from '../profiles';

describe('profiles', () =>
{
    it('falls back to TERMINAL for anything unknown', () =>
    {
        expect(profileOf('nope').id).toBe('terminal');
        expect(profileOf(undefined).id).toBe('terminal');
        expect(profileOf('rele').id).toBe('rele');
    });

    it('has an entry and a label for every id', () =>
    {
        for (const id of PROFILE_IDS) expect(PROFILES[id].label).toBe(PROFILES[id].label.toUpperCase());
    });

    it('MÍNIMO keeps only clicks, yet alerts are always heard', () =>
    {
        const p = PROFILES.minimo;
        expect(profileAllows(p, 'key')).toBe(true);
        expect(profileAllows(p, 'tab')).toBe(false);
        for (const name of ALWAYS_AUDIBLE) expect(profileAllows(p, name)).toBe(true);
    });

    it('the other profiles play everything', () =>
    {
        expect(profileAllows(PROFILES.suave, 'tab')).toBe(true);
    });
});
