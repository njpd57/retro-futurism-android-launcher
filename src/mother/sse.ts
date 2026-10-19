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

export interface TokenUsage
{
    prompt: number;
    completion: number;
}

/** The `usage` block that arrives in the last chunk when `stream_options.include_usage` is set. */
export function extractUsage(payload: string): TokenUsage | null
{
    if (payload === '[DONE]') return null;
    try
    {
        const usage = (JSON.parse(payload) as { usage?: { prompt_tokens?: number; completion_tokens?: number } | null }).usage;
        if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') return null;
        return { prompt: usage.prompt_tokens, completion: usage.completion_tokens };
    }
    catch
    {
        return null;
    }
}

export interface ToolCallDelta
{
    index: number;
    id?: string;
    name?: string;
    args?: string;
}

/** The tool-call fragments of a chat-completions chunk (they arrive split across many chunks). */
export function extractToolCallDeltas(payload: string): ToolCallDelta[]
{
    if (payload === '[DONE]') return [];
    try
    {
        const json = JSON.parse(payload) as { choices?: { delta?: { tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[] };
        return (json.choices?.[0]?.delta?.tool_calls ?? []).map(t => ({ index: t.index ?? 0, id: t.id, name: t.function?.name, args: t.function?.arguments }));
    }
    catch
    {
        return [];
    }
}
