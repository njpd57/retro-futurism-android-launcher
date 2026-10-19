import type { ChatMessage } from './chat';

export interface Session
{
    id: string;
    title: string;
    /** when it was archived, ms */
    at: number;
    messages: ChatMessage[];
}

export const MAX_SESSIONS = 10;
const TITLE_MAX = 28;

export function sessionTitle(messages: readonly ChatMessage[])
{
    const first = messages.find(m => m.role === 'user')?.content.trim().replace(/\s+/g, ' ') ?? '';
    if (!first) return 'SIN TÍTULO';
    return (first.length > TITLE_MAX ? `${first.slice(0, TITLE_MAX - 1)}…` : first).toUpperCase();
}

/** Saves a conversation at the top of the list. Empty conversations are ignored; the oldest ones fall off. */
export function archiveSession(sessions: readonly Session[], messages: readonly ChatMessage[], now: number): Session[]
{
    const real = messages.filter(m => m.content);
    if (!real.length) return [...sessions];
    const session: Session = { id: `s${now}`, title: sessionTitle(real), at: now, messages: [...real] };
    return [session, ...sessions.filter(s => s.id !== session.id)].slice(0, MAX_SESSIONS);
}

export function removeSession(sessions: readonly Session[], id: string): Session[]
{
    return sessions.filter(s => s.id !== id);
}

/** Makes `id` the current conversation. The one that was current is archived, so nothing is lost. */
export function restoreSession(sessions: readonly Session[], id: string, current: readonly ChatMessage[], now: number)
{
    const target = sessions.find(s => s.id === id);
    if (!target) return { sessions: [...sessions], history: [...current] };
    const rest = removeSession(sessions, id);
    return { sessions: archiveSession(rest, current, now), history: [...target.messages] };
}

/** Plain text transcript for copying. */
export function sessionToText(session: Pick<Session, 'title' | 'messages'>): string
{
    const lines = session.messages.map(m => m.role === 'user' ? `> ${m.content}` : `MOTHER: ${m.content}`);
    return [`MOTHER · ${session.title}`, '', ...lines].join('\n');
}
