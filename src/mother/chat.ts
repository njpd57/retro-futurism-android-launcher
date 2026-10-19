export interface ChatMessage
{
    role: 'user' | 'assistant';
    content: string;
}

export interface ApiMessage
{
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/** The persona plus the last `max` messages of the history (without a trailing empty assistant placeholder). */
export function buildMessages(persona: string, history: readonly ChatMessage[], max: number): ApiMessage[]
{
    const sent = history.filter((m, i) => !(i === history.length - 1 && m.role === 'assistant' && !m.content));
    return [{ role: 'system', content: persona }, ...sent.slice(-max)];
}

/** `sk-…a1b2` so the key never shows in full. */
export function maskKey(key: string)
{
    const k = key.trim();
    if (!k) return '';
    if (k.length <= 8) return '…'.padEnd(k.length, '*');
    return `${k.slice(0, 3)}…${k.slice(-4)}`;
}

/** Terminal-style text for a failed request. */
export function httpErrorMessage(status: number)
{
    if (status === 401) return 'ERROR 401 · CLAVE NO VÁLIDA';
    if (status === 403) return 'ERROR 403 · ACCESO DENEGADO';
    if (status === 404) return 'ERROR 404 · MODELO NO ENCONTRADO';
    if (status === 429) return 'ERROR 429 · CUOTA AGOTADA O DEMASIADAS CONSULTAS';
    if (status >= 500) return `ERROR ${status} · FALLO DEL SERVIDOR`;
    return `ERROR ${status}`;
}

/** Models offered in the settings; any other id can still be typed. */
export const MODEL_PRESETS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
