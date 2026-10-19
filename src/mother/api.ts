import { httpErrorMessage, type ApiMessage } from './chat';

export const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * One non-streaming chat completion that must answer with a JSON object. Returns the parsed object; throws an
 * `Error` whose message is the terminal-style text to show.
 */
export async function chatJson(apiKey: string, model: string, messages: ApiMessage[], signal?: AbortSignal, maxTokens = 1500): Promise<unknown>
{
    const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
        signal,
    });
    if (!resp.ok) throw new Error(httpErrorMessage(resp.status));

    const content = ((await resp.json()) as { choices?: { message?: { content?: string | null } }[] }).choices?.[0]?.message?.content;
    if (!content) throw new Error('RESPUESTA VACÍA');
    return JSON.parse(content);
}
