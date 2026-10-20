import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref } from "vue";
import { useDashboardActions } from "@/composables/useDashboardActions";
import { useShipSnapshot } from "@/composables/useShipSnapshot";
import { accumulateToolCalls, describeAction, MOTHER_TOOLS, parseAction, type MotherAction, type ToolCallAcc } from "@/mother/actions";
import { buildMessages, httpErrorMessage, type ChatMessage } from "@/mother/chat";
import { ACTIONS_NOTE, buildPersona } from "@/mother/context";
import { contextBlock, localReply } from "@/mother/local";
import { MOTHER_PERSONA } from "@/mother/persona";
import { parseSlash, SLASH_HELP, type SlashCommand } from "@/mother/slash";
import { archiveSession, removeSession, restoreSession, type Session } from "@/mother/sessions";
import { createSseParser, extractDelta, extractToolCallDeltas, extractUsage } from "@/mother/sse";
import { searchApps } from "@/utils/appSearch";
import { useAppsStore } from "./useAppsStore";
import { useLaunchStore } from "./useLaunchStore";
import { describeSave, hintForSave } from "@/games/isolation/hints";
import { useIsolationStore } from "./useIsolationStore";
import { useLogStore } from "./useLogStore";
import { useOrganizerStore } from "./useOrganizerStore";
import { useSettingsStore } from "./useSettingsStore";
import { useSpeechStore } from "./useSpeechStore";
import { useSoundStore } from "./useSoundStore";

const API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_HISTORY = 20;
const MAX_SENT = 12;
const MAX_TOKENS = 300;
const TICK_MIN_MS = 70;

export type MotherStatus = 'idle' | 'waiting' | 'streaming';

export interface PendingAction
{
    id: string;
    action: MotherAction;
    line: string;
}

/**
 * The MOTHER chat. The API key lives only in this phone's localStorage (never in the repo or the build).
 * Answers are streamed and forced to upper case. ESTADO / INFORME / ORDEN ESPECIAL 937 are answered locally.
 */
export const useMotherStore = defineStore('mother', () =>
{
    const log = useLogStore();
    const sound = useSoundStore();
    const speech = useSpeechStore();
    const settings = useSettingsStore();
    const appsStore = useAppsStore();
    const launchStore = useLaunchStore();
    const snapshot = useShipSnapshot();
    const dashboardActions = useDashboardActions();

    const apiKey = useLocalStorage('mother.apiKey', '');
    const model = useLocalStorage('mother.model', DEFAULT_MODEL);
    const history = useLocalStorage<ChatMessage[]>('mother.history', []);
    const sessions = useLocalStorage<Session[]>('mother.sessions', []);
    /** Sends the time, battery, agenda and weather with each query. On by default. */
    const useContext = useLocalStorage('mother.context', true);
    /** Lets the model propose actions; each one still needs the user's confirmation. */
    const actionsEnabled = useLocalStorage('mother.actions', true);
    const voice = useLocalStorage('mother.voice', false);

    const status = ref<MotherStatus>('idle');
    const error = ref('');
    /** tokens used since the launcher started */
    const tokens = ref({ prompt: 0, completion: 0 });
    const pending = ref<PendingAction[]>([]);
    let controller: AbortController | null = null;
    let lastTick = 0;

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

    function speak(text: string)
    {
        if (voice.value) speech.speak(text);
    }

    function stopSpeaking()
    {
        speech.stop();
    }

    function tick()
    {
        const now = Date.now();
        if (now - lastTick < TICK_MIN_MS) return;
        lastTick = now;
        sound.play('tick');
    }

    /** Adds a line from MOTHER to the conversation, so the model knows what happened next turn. */
    function note(content: string)
    {
        history.value = [...history.value, { role: 'assistant', content }];
        trimHistory();
    }

    /** Turns the model's tool calls into pending proposals; returns the new ones. Rejected calls are shown, not hidden. */
    function queueActions(calls: ToolCallAcc[]): PendingAction[]
    {
        const added: PendingAction[] = [];
        for (const call of calls)
        {
            const parsed = parseAction(call.name, call.args);
            if (parsed.ok)
                added.push({ id: call.id || `a${Date.now()}${pending.value.length + added.length}`, action: parsed.action, line: describeAction(parsed.action) });
            else
            {
                error.value = `ACCIÓN NO VÁLIDA: ${parsed.error}`;
                log.push('MTR', `ACCIÓN RECHAZADA: ${parsed.error}`);
            }
        }
        pending.value = [...pending.value, ...added];
        return added;
    }

    /** Runs an accepted action; returns the line to tell the model and the user. */
    function run(action: MotherAction): { ok: boolean; message: string }
    {
        switch (action.type)
        {
            case 'open_app':
            {
                const app = searchApps(appsStore.apps.values(), action.name, settings.hiddenApps, { aliases: settings.aliases })[0];
                if (!app) return { ok: false, message: `APP NO ENCONTRADA: ${action.name.toUpperCase()}` };
                launchStore.launch(app.packageName, app.label);
                return { ok: true, message: `ABIERTA: ${app.label.toUpperCase()}` };
            }
            case 'timer':
                return dashboardActions.startTimer(action.minutes)
                    ? { ok: true, message: `TEMPORIZADOR ${action.minutes} MIN ARRANCADO · VER PANEL` }
                    : { ok: false, message: 'NO SE PUDO GUARDAR EL TEMPORIZADOR' };
            case 'note':
                return dashboardActions.saveNote(action.text)
                    ? { ok: true, message: 'NOTA GUARDADA' }
                    : { ok: false, message: 'NO SE PUDO GUARDAR LA NOTA' };
            case 'theme':
                settings.phosphor = action.phosphor;
                return { ok: true, message: describeAction(action) };
            case 'organize':
                // the organizer shows its own preview; nothing changes until the user applies it
                useOrganizerStore().show(action.request);
                return { ok: true, message: 'ORGANIZADOR ABIERTO · REVISA LA VISTA PREVIA' };
        }
    }

    /** [EJECUTAR] */
    function confirmAction(id: string)
    {
        const item = pending.value.find(p => p.id === id);
        pending.value = pending.value.filter(p => p.id !== id);
        if (!item) return;
        log.push('MTR', item.line);
        const result = run(item.action);
        if (!result.ok) error.value = result.message;
        note(`${result.ok ? 'EJECUTADO' : 'FALLO'}: ${result.message}`);
    }

    /** [ANULAR] */
    function dismissAction(id: string)
    {
        const item = pending.value.find(p => p.id === id);
        pending.value = pending.value.filter(p => p.id !== id);
        if (item) note(`ANULADO: ${item.line}`);
    }

    function answerLocally(content: string, lines: string[])
    {
        const text = lines.join('\n');
        history.value = [...history.value, { role: 'user', content }, { role: 'assistant', content: text }];
        trimHistory();
        log.push('MTR', 'ORDEN LOCAL');
        speak(text);
    }

    /** The game left halfway, or else the last terminal save. Never sent to the API. */
    const savedGame = () => { const g = useIsolationStore(); return g.suspended ?? g.save; };
    const gameReport = () => { const g = savedGame(); return g ? ['AISLAMIENTO', ...describeSave(g)] : ['SIN PARTIDA DE AISLAMIENTO.', 'ESCRIBE /JUGAR']; };
    const gameHint = () => { const g = savedGame(); return g ? ['PISTA DE MOTHER:', ...hintForSave(g)] : ['SIN PARTIDA. NO HAY NADA QUE ACONSEJAR.', 'ESCRIBE /JUGAR']; };

    /** `/commands` of the MOTHER chat: they run on the phone, with no API and no key. */
    function runSlash(content: string, cmd: SlashCommand)
    {
        const reply = (...lines: string[]) => answerLocally(content, lines);
        switch (cmd.type)
        {
            case 'timer': reply(run({ type: 'timer', minutes: cmd.minutes }).message); break;
            case 'note': reply(run({ type: 'note', text: cmd.text }).message); break;
            case 'theme': reply(run({ type: 'theme', phosphor: cmd.phosphor }).message); break;
            case 'open': reply(run({ type: 'open_app', name: cmd.query }).message); break;
            case 'organize': useOrganizerStore().show(cmd.request); break;
            case 'new': newSession(); note('SESIÓN ARCHIVADA'); break;
            case 'clear': clear(); break;
            case 'help': reply(...SLASH_HELP); break;
            case 'invalid': reply(`USO: ${cmd.usage}`); break;
            case 'unknown': reply(`ORDEN DESCONOCIDA: /${cmd.word.toUpperCase()}`, 'ESCRIBE /AYUDA'); break;
            case 'sessions': reply('ABRE LAS SESIONES CON EL BOTÓN SESIONES'); break;
            case 'play': useIsolationStore().show(); break;
            case 'game': reply(...gameReport()); break;
            case 'hint': reply(...gameHint()); break;
        }
    }

    async function send(text: string)
    {
        const content = text.trim();
        if (!content || busy.value) return;

        error.value = '';
        stopSpeaking();
        // proposals left unanswered count as cancelled, and the model is told so
        for (const p of pending.value) note(`ANULADO: ${p.line}`);
        pending.value = [];

        const slash = parseSlash(content);
        if (slash)
        {
            runSlash(content, slash);
            return;
        }

        const snap = snapshot();
        const local = localReply(content, snap);
        if (local)
        {
            answerLocally(content, local);
            return;
        }

        if (!hasKey.value)
        {
            error.value = 'CLAVE API NO CONFIGURADA';
            return;
        }

        history.value = [...history.value, { role: 'user', content }];
        const persona = buildPersona(
            actionsEnabled.value ? `${MOTHER_PERSONA}\n${ACTIONS_NOTE}` : MOTHER_PERSONA,
            useContext.value ? contextBlock(snap) : null,
        );
        const messages = buildMessages(persona, history.value, MAX_SENT);
        history.value = [...history.value, { role: 'assistant', content: '' }];
        trimHistory();

        log.push('MTR', 'CONSULTA REGISTRADA');
        status.value = 'waiting';
        controller = new AbortController();

        let calls: ToolCallAcc[] = [];

        try
        {
            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.value.trim()}` },
                body: JSON.stringify({
                    model: model.value.trim() || DEFAULT_MODEL,
                    messages,
                    stream: true,
                    stream_options: { include_usage: true },
                    max_tokens: MAX_TOKENS,
                    ...(actionsEnabled.value ? { tools: MOTHER_TOOLS } : {}),
                }),
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
                    if (delta)
                    {
                        appendToLast(delta.toUpperCase());
                        tick();
                    }

                    const toolDeltas = extractToolCallDeltas(payload);
                    if (toolDeltas.length) calls = accumulateToolCalls(calls, toolDeltas);

                    const usage = extractUsage(payload);
                    if (usage) tokens.value = { prompt: tokens.value.prompt + usage.prompt, completion: tokens.value.completion + usage.completion };
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
            const proposals = queueActions(calls);
            const last = history.value[history.value.length - 1];
            if (last?.role === 'assistant' && !last.content)
            {
                // A tool-call-only answer keeps a line in the history; otherwise two user messages in a row make
                // the model answer the first one again. An answer that never came leaves nothing behind.
                history.value = proposals.length
                    ? [...history.value.slice(0, -1), { role: 'assistant', content: `PROPUESTA: ${proposals.map(p => p.line).join(' · ')}` }]
                    : history.value.slice(0, -1);
            }
            else if (last?.role === 'assistant' && !error.value)
                speak(last.content);
        }
    }

    function abort()
    {
        controller?.abort();
        stopSpeaking();
    }

    /** Throws the conversation away. */
    function clear()
    {
        abort();
        history.value = [];
        pending.value = [];
        error.value = '';
    }

    /** Keeps the conversation in the session list and starts an empty one. */
    function newSession()
    {
        if (busy.value) return;
        sessions.value = archiveSession(sessions.value, history.value, Date.now());
        clear();
    }

    function restore(id: string)
    {
        if (busy.value) return;
        const r = restoreSession(sessions.value, id, history.value, Date.now());
        sessions.value = r.sessions;
        history.value = r.history;
        pending.value = [];
        error.value = '';
    }

    function deleteSession(id: string)
    {
        sessions.value = removeSession(sessions.value, id);
    }

    function clearKey() { apiKey.value = ''; }

    return {
        apiKey, model, history, sessions, useContext, actionsEnabled, voice, status, error, tokens, pending,
        hasKey, busy, lastAnswer,
        send, abort, clear, clearKey, newSession, restore, deleteSession, confirmAction, dismissAction,
    };
});
