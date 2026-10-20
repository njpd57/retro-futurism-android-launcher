import { describe, expect, it } from 'vitest';
import { BAG_MAX, FUEL_FOUND, FUEL_MAX, RECIPES, canCraft, craft, emptyBag, isBag, needsText, recipeOf, type Bag } from '../crafting';

const bag = (over: Partial<Bag> = {}): Bag => ({ ...emptyBag(), ...over });

describe('crafting', () =>
{
    it('makes a decoy from scrap and wires, a flare from chemicals and scrap, fuel from two chemicals', () =>
    {
        expect(craft(bag({ scrap: 2, wires: 1 }), recipeOf('decoy'))).toEqual(bag({ scrap: 1, decoys: 1 }));
        expect(craft(bag({ scrap: 1, chems: 2 }), recipeOf('flare'))).toEqual(bag({ chems: 1, flares: 1 }));
        expect(craft(bag({ chems: 3, flamer: true, fuel: 1 }), recipeOf('fuel'))).toEqual(bag({ chems: 1, flamer: true, fuel: 2 }));
    });

    it('does nothing without the parts', () =>
    {
        const poor = bag({ scrap: 1 });
        for (const r of RECIPES) expect(canCraft(poor, r)).toBe(false);
        expect(craft(poor, recipeOf('decoy'))).toBe(poor);
        expect(canCraft(bag({ chems: 1 }), recipeOf('fuel'))).toBe(false);
    });

    it('stops when the result no longer fits', () =>
    {
        expect(canCraft(bag({ scrap: 3, wires: 3, decoys: BAG_MAX }), recipeOf('decoy'))).toBe(false);
        expect(canCraft(bag({ chems: 3, flamer: true, fuel: FUEL_MAX }), recipeOf('fuel'))).toBe(false);
    });

    it('only fuels a flamethrower it has', () =>
    {
        expect(canCraft(bag({ chems: 3 }), recipeOf('fuel'))).toBe(false);
        expect(FUEL_FOUND).toBeLessThanOrEqual(FUEL_MAX);
    });

    it('writes what a recipe needs', () =>
    {
        expect(needsText(recipeOf('decoy'))).toBe('CHATARRA + CABLES');
        expect(needsText(recipeOf('fuel'))).toBe('QUÍMICOS ×2');
    });

    it('validates a bag read from storage', () =>
    {
        expect(isBag(bag({ scrap: 3, fuel: 2, flamer: true }))).toBe(true);
        for (const v of [null, 'x', {}, bag({ scrap: 4 }), bag({ scrap: -1 }), bag({ fuel: 9 }), { ...bag(), flamer: 1 }, { ...bag(), wires: 1.5 }])
            expect(isBag(v)).toBe(false);
    });
});
