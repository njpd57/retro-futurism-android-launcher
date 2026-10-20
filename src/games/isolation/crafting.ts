/** What the player carries: raw materials, the things made from them, and the flamethrower with its fuel. */
export type Material = 'scrap' | 'wires' | 'chems';

export interface Bag
{
    scrap: number;
    wires: number;
    chems: number;
    decoys: number;
    flares: number;
    /** flamethrower shots left */
    fuel: number;
    flamer: boolean;
}

/** Most of each thing that fits. */
export const BAG_MAX = 3;
export const FUEL_MAX = 3;
/** the flamethrower comes with this much fuel */
export const FUEL_FOUND = 2;

export const emptyBag = (): Bag => ({ scrap: 0, wires: 0, chems: 0, decoys: 0, flares: 0, fuel: 0, flamer: false });

export const MATERIAL_LABEL: Record<Material, string> = { scrap: 'CHATARRA', wires: 'CABLES', chems: 'QUÍMICOS' };

export type RecipeId = 'decoy' | 'flare' | 'fuel';

export interface Recipe
{
    id: RecipeId;
    label: string;
    needs: Readonly<Partial<Record<Material, number>>>;
    makes: 'decoys' | 'flares' | 'fuel';
}

export const RECIPES: readonly Recipe[] = [
    { id: 'decoy', label: 'SEÑUELO', needs: { scrap: 1, wires: 1 }, makes: 'decoys' },
    { id: 'flare', label: 'BENGALA', needs: { chems: 1, scrap: 1 }, makes: 'flares' },
    { id: 'fuel', label: 'COMBUSTIBLE', needs: { chems: 2 }, makes: 'fuel' },
];

export const recipeOf = (id: RecipeId): Recipe => RECIPES.find(r => r.id === id)!;

const limit = (r: Recipe) => r.makes === 'fuel' ? FUEL_MAX : BAG_MAX;

/** The parts are there and so is the room for the result (fuel also needs a flamethrower to put it in). */
export function canCraft(bag: Bag, r: Recipe): boolean
{
    if (r.makes === 'fuel' && !bag.flamer) return false;
    if (bag[r.makes] >= limit(r)) return false;
    return (Object.keys(r.needs) as Material[]).every(m => bag[m] >= (r.needs[m] ?? 0));
}

/** The bag after making one; unchanged when it can't be made. */
export function craft(bag: Bag, r: Recipe): Bag
{
    if (!canCraft(bag, r)) return bag;
    const next = { ...bag, [r.makes]: bag[r.makes] + 1 };
    for (const m of Object.keys(r.needs) as Material[]) next[m] -= r.needs[m] ?? 0;
    return next;
}

/** `CHATARRA + CABLES`, `QUÍMICOS ×2`. */
export function needsText(r: Recipe): string
{
    return (Object.keys(r.needs) as Material[]).map(m => (r.needs[m] ?? 0) > 1 ? `${MATERIAL_LABEL[m]} ×${r.needs[m]}` : MATERIAL_LABEL[m]).join(' + ');
}

const isCount = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

/** Validates a bag read from storage. */
export function isBag(v: unknown): v is Bag
{
    if (typeof v !== 'object' || v === null) return false;
    const b = v as Record<string, unknown>;
    return [b.scrap, b.wires, b.chems, b.decoys, b.flares].every(n => isCount(n, BAG_MAX))
        && isCount(b.fuel, FUEL_MAX) && typeof b.flamer === 'boolean';
}
