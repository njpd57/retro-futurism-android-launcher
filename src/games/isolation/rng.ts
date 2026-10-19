export type Rng = () => number;

/** Deterministic RNG (mulberry32): the same seed gives the same sequence, for repeatable decks and tests. */
export function seeded(seed: number): Rng
{
    let a = seed >>> 0;
    return () =>
    {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A random element; `rng` must return [0, 1). */
export function pick<T>(items: readonly T[], rng: Rng): T
{
    return items[Math.floor(rng() * items.length)];
}
