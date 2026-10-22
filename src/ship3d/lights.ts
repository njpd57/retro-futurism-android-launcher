import type { Light } from './world';

/** How many lights one frame can use: the shader loops over a fixed number. */
export const MAX_LIGHTS = 8;

/** Indices of the `n` lights nearest to a point in the plan (`z` is the eye height), nearest first. */
export function nearestLights(lights: readonly Light[], x: number, y: number, z: number, n = MAX_LIGHTS): number[]
{
    return lights
        .map((l, i) => ({ i, d: (l.x - x) ** 2 + (l.y - y) ** 2 + (l.z - z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, n)
        .map(e => e.i);
}

/**
 * The chosen lights as `vec4(x, up, y, power)` per light in GL space, padded with dark ones up to `n`.
 * `boost` scales a light's power (attention, blinking).
 */
export function packLights(lights: readonly Light[], picked: readonly number[], boost: (i: number) => number = () => 1, n = MAX_LIGHTS): Float32Array
{
    const out = new Float32Array(n * 4);
    picked.slice(0, n).forEach((i, k) =>
    {
        const l = lights[i];
        out.set([l.x, l.z, l.y, l.power * boost(i)], k * 4);
    });
    return out;
}
