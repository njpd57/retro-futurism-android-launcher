export const FETCH_TIMEOUT_MS = 10_000;

/** Short Spanish reason for a failed request, to show instead of a bare "no link". */
export function describeFetchError(err: unknown): string
{
    const e = err as { name?: string; message?: string } | null;
    if (e?.name === 'AbortError') return 'TIEMPO AGOTADO';
    const message = e?.message ?? String(err);
    if (/^HTTP \d+/.test(message)) return message.toUpperCase();
    if (e?.name === 'TypeError') return 'SIN RED O BLOQUEADO';
    if (e?.name === 'SyntaxError') return 'RESPUESTA NO VÁLIDA';
    return message.slice(0, 40).toUpperCase() || 'ERROR';
}

/** GET a JSON document with a timeout. Throws `Error('HTTP 404')` for non-2xx answers. */
export async function fetchJson(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<unknown>
{
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try
    {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    }
    finally
    {
        window.clearTimeout(timer);
    }
}
