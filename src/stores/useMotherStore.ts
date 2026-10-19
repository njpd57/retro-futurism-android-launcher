import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { buildMessages, httpErrorMessage, type ChatMessage } from "@/mother/chat";
import { MOTHER_PERSONA } from "@/mother/persona";
import { createSseParser, extractDelta } from "@/mother/sse";
import { useLogStore } from "./useLogStore";

const API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_HISTORY = 20;
const MAX_SENT = 12;
const MAX_TOKENS = 300;

export type MotherStatus = 'idle' | 'waiting' | 'streaming';

/**
 * The MOTHER chat. The API key lives only in this phone's localStorage (never in the repo or the build).
 * Answers are streamed and forced to upper case.
 */
export const useMotherStore = defineStore('mother', () =>
{
    const log = useLogStore();

    const apiKey = useLocalStorage('mother.apiKey', '');
    const model = useLocalStorage('mother.model', DEFAULT_MODEL);
    const history = useLocalStorage<ChatMessage[]>('mother.history', []);

    const status = ref<MotherStatus>('idle');
    const error = ref('');
    let controller: AbortController | null = null;

    const hasKey = computed(() => apiKey.value.trim().length > 0);
    const busy = computed(() => status.value !== 'idle');
    const lastAnswer = computed(() => [...history.value].reverse().find(m => m.role === 'assistant' && m.content)?.content ?? '');

    function trimHistory()
    {
        if (history.value.length > MAX_HISTORY)
            history.value = history.value.slice(-MAX_HISTORY);
    }

    /** Appends to the last (assistant) message. Reassigns so localStorage persistence sees the change. */
    function appendToLast(text: string)
    {
        const next = [...history.value];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + text };
        history.value = next;
    }

    async function send(text: string)
    {
        const content = text.trim();
        if (!content || busy.value) return;

        if (!hasKey.value)
        {
            error.value = 'CLAVE API NO CONFIGURADA';
            return;
        }

        error.value = '';
        history.value = [...history.value, { role: 'user', content }];
        const messages = buildMessages(MOTHER_PERSONA, history.value, MAX_SENT);
        history.value = [...history.value, { role: 'assistant', content: '' }];
        trimHistory();

        log.push('MTR', 'CONSULTA REGISTRADA');
        status.value = 'waiting';
        controller = new AbortController();

        try
        {
            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.value.trim()}` },
                body: JSON.stringify({ model: model.value.trim() || DEFAULT_MODEL, messages, stream: true, max_tokens: MAX_TOKENS }),
                signal: controller.signal,
            });

            if (!resp.ok || !resp.body)
            {
                error.value = httpErrorMessage(resp.status);
                return;
            }

            status.value = 'streaming';
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            const parser = createSseParser();

            for (;;)
            {
                const { done, value } = await reader.read();
                if (done) break;

                for (const payload of parser.push(decoder.decode(value, { stream: true })))
                {
                    const delta = extractDelta(payload);
                    if (delta) appendToLast(delta.toUpperCase());
                }
            }
        }
        catch (err)
        {
            if ((err as Error).name === 'AbortError')
                error.value = 'CONSULTA ABORTADA';
            else
            {
                console.error(err);
                error.value = 'SIN ENLACE';
            }
        }
        finally
        {
            status.value = 'idle';
            controller = null;
            // an answer that never came leaves an empty placeholder
            const last = history.value[history.value.length - 1];
            if (last?.role === 'assistant' && !last.content)
                history.value = history.value.slice(0, -1);
        }
    }

    function abort() { controller?.abort(); }

    function clear()
    {
        abort();
        history.value = [];
        error.value = '';
    }

    function clearKey() { apiKey.value = ''; }

    return { apiKey, model, history, status, error, hasKey, busy, lastAnswer, send, abort, clear, clearKey };
});
