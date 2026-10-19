/**
 * Incremental parser for a server-sent-events stream. Feed it text as it arrives (chunks can split a line anywhere);
 * it returns the `data:` payloads of the lines completed so far.
 */
export function createSseParser()
{
    let buffer = '';

    return {
        push(chunk: string): string[]
        {
            buffer += chunk;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';

            return lines
                .filter(l => l.startsWith('data:'))
                .map(l => l.slice(5).trim())
                .filter(Boolean);
        },
    };
}

/** The text delta of a chat-completions chunk; null for `[DONE]`, empty deltas and anything unexpected. */
export function extractDelta(payload: string): string | null
{
    if (payload === '[DONE]') return null;
    try
    {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string | null } }[] };
        return json.choices?.[0]?.delta?.content || null;
    }
    catch
    {
        return null;
    }
}
