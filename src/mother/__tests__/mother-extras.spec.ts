import { describe, expect, it } from 'vitest';
import { accumulateToolCalls, describeAction, parseAction } from '../actions';
import { buildPersona } from '../context';
import { archiveSession, restoreSession, sessionToText, MAX_SESSIONS, type Session } from '../sessions';
import { extractToolCallDeltas, extractUsage } from '../sse';
import { speakable } from '../voice';

describe('buildPersona', () =>
{
    it('adds the context only when there is one', () =>
    {
        expect(buildPersona('BASE', null)).toBe('BASE');
        expect(buildPersona('BASE', 'HORA: 10:00')).toContain('HORA: 10:00');
    });
});

describe('sse extras', () =>
{
    it('reads token usage', () =>
    {
        expect(extractUsage(JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5 } }))).toEqual({ prompt: 12, completion: 5 });
        expect(extractUsage(JSON.stringify({ choices: [{ delta: { content: 'A' } }], usage: null }))).toBeNull();
        expect(extractUsage('[DONE]')).toBeNull();
        expect(extractUsage('nope')).toBeNull();
    });

    it('reads tool call fragments', () =>
    {
        const payload = JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'nota', arguments: '{"te' } }] } }] });
        expect(extractToolCallDeltas(payload)).toEqual([{ index: 0, id: 'c1', name: 'nota', args: '{"te' }]);
        expect(extractToolCallDeltas('[DONE]')).toEqual([]);
        expect(extractToolCallDeltas(JSON.stringify({ choices: [{ delta: { content: 'x' } }] }))).toEqual([]);
    });
});

describe('actions', () =>
{
    it('accumulates streamed fragments by index', () =>
    {
        let acc = accumulateToolCalls([], [{ index: 0, id: 'c1', name: 'temporizador', args: '{"min' }]);
        acc = accumulateToolCalls(acc, [{ index: 0, args: 'utos": 5}' }, { index: 1, id: 'c2', name: 'nota', args: '{}' }]);
        expect(acc).toEqual([{ id: 'c1', name: 'temporizador', args: '{"minutos": 5}' }, { id: 'c2', name: 'nota', args: '{}' }]);
    });

    it('validates each tool', () =>
    {
        expect(parseAction('abrir_app', '{"nombre":" Chrome "}')).toEqual({ ok: true, action: { type: 'open_app', name: 'Chrome' } });
        expect(parseAction('abrir_app', '{}')).toMatchObject({ ok: false });
        expect(parseAction('temporizador', '{"minutos":10}')).toEqual({ ok: true, action: { type: 'timer', minutes: 10 } });
        expect(parseAction('temporizador', '{"minutos":0}')).toMatchObject({ ok: false });
        expect(parseAction('temporizador', '{"minutos":9999}')).toMatchObject({ ok: false });
        expect(parseAction('temporizador', '{"minutos":2.5}')).toMatchObject({ ok: false });
        expect(parseAction('nota', '{"texto":"pan"}')).toEqual({ ok: true, action: { type: 'note', text: 'pan' } });
        expect(parseAction('paleta', '{"color":"Verde"}')).toEqual({ ok: true, action: { type: 'theme', phosphor: 'green' } });
        expect(parseAction('paleta', '{"color":"rosa"}')).toMatchObject({ ok: false });
    });

    it('rejects unknown tools and broken JSON', () =>
    {
        expect(parseAction('borrar_todo', '{}')).toMatchObject({ ok: false });
        expect(parseAction('nota', '{roto')).toMatchObject({ ok: false });
        expect(parseAction('nota', 'null')).toMatchObject({ ok: false });
    });

    it('describes actions for the confirmation line', () =>
    {
        expect(describeAction({ type: 'timer', minutes: 5 })).toBe('TEMPORIZADOR 5 MIN');
        expect(describeAction({ type: 'theme', phosphor: 'white' })).toBe('PALETA BLANCO P4');
    });
});

describe('sessions', () =>
{
    const msgs = [{ role: 'user' as const, content: 'hola mother' }, { role: 'assistant' as const, content: 'HOLA' }];

    it('archives with a title and ignores empty chats', () =>
    {
        const s = archiveSession([], msgs, 1000);
        expect(s).toHaveLength(1);
        expect(s[0].title).toBe('HOLA MOTHER');
        expect(archiveSession(s, [], 2000)).toEqual(s);
        expect(archiveSession(s, [{ role: 'assistant', content: '' }], 2000)).toEqual(s);
    });

    it('keeps at most MAX_SESSIONS, newest first', () =>
    {
        let s: Session[] = [];
        for (let i = 0; i < MAX_SESSIONS + 3; i++) s = archiveSession(s, msgs, i + 1);
        expect(s).toHaveLength(MAX_SESSIONS);
        expect(s[0].at).toBe(MAX_SESSIONS + 3);
    });

    it('restoring archives the current chat so nothing is lost', () =>
    {
        const old = archiveSession([], msgs, 1000);
        const current = [{ role: 'user' as const, content: 'otra cosa' }];
        const r = restoreSession(old, old[0].id, current, 2000);
        expect(r.history).toEqual(msgs);
        expect(r.sessions.map(s => s.title)).toEqual(['OTRA COSA']);
    });

    it('restoring an unknown id changes nothing', () =>
    {
        const r = restoreSession([], 'zzz', msgs, 5);
        expect(r.history).toEqual(msgs);
        expect(r.sessions).toEqual([]);
    });

    it('exports as text', () =>
    {
        expect(sessionToText({ title: 'T', messages: msgs })).toBe('MOTHER · T\n\n> hola mother\nMOTHER: HOLA');
    });
});

describe('speakable', () =>
{
    it('drops the prefix and the glyphs', () =>
    {
        expect(speakable('MOTHER: ENERGÍA ▓▓░░ 50%')).toBe('ENERGÍA 50%');
    });
});
