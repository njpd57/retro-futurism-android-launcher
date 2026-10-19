import { afterEach, describe, expect, it } from 'vitest';
import { bridgeHas } from '../bridgeHas';

describe('bridgeHas', () =>
{
    afterEach(() => { delete (globalThis as { Bridge?: unknown }).Bridge; });

    it('is false without Bridge or without the method', () =>
    {
        expect(bridgeHas('getBattery')).toBe(false);
        (globalThis as { Bridge?: unknown }).Bridge = {};
        expect(bridgeHas('getBattery')).toBe(false);
    });

    it('is true when the method is a function', () =>
    {
        (globalThis as { Bridge?: unknown }).Bridge = { getBattery: () => '{}' };
        expect(bridgeHas('getBattery')).toBe(true);
    });
});
