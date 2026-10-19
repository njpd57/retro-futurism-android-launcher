/** True when the installed Bridge has the method. Calling a missing method throws, so guard fork and untested methods. */
export function bridgeHas(method: keyof typeof Bridge): boolean
{
    const bridge = (globalThis as { Bridge?: unknown }).Bridge as Record<string, unknown> | undefined;
    return typeof bridge?.[method] === 'function';
}
