import { describe, expect, it } from 'vitest';
import { buildMessages, httpErrorMessage, maskKey } from '../chat';
import { createSseParser, extractDelta } from '../sse';

const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe('sse', () =>
{
    it('returns the payloads of complete lines', () =>
    {
        const p = createSseParser();
        expect(p.push(chunk('HO') + chunk('LA')).map(extractDelta)).toEqual(['HO', 'LA']);
    });

    it('handles a line split across chunks', () =>
    {
        const p = createSseParser();
        const full = chunk('HOLA');
        expect(p.push(full.slice(0, 15))).toEqual([]);
        expect(p.push(full.slice(15)).map(extractDelta)).toEqual(['HOLA']);
    });

    it('reports [DONE] and ignores junk', () =>
    {
        const p = createSseParser();
        const payloads = p.push(': keep-alive\n\ndata: [DONE]\n\n');
        expect(payloads).toEqual(['[DONE]']);
        expect(extractDelta('[DONE]')).toBeNull();
        expect(extractDelta('no es json')).toBeNull();
        expect(extractDelta(JSON.stringify({ choices: [{ delta: {} }] }))).toBeNull();
    });

    it('handles CRLF', () =>
    {
        expect(createSseParser().push(chunk('A').replace(/\n/g, '\r\n')).map(extractDelta)).toEqual(['A']);
    });
});

describe('chat', () =>
{
    it('builds the persona plus the last messages', () =>
    {
        const history = [
            { role: 'user', content: '1' }, { role: 'assistant', content: 'a' },
            { role: 'user', content: '2' }, { role: 'assistant', content: 'b' },
            { role: 'user', content: '3' },
        ] as const;
        const out = buildMessages('P', history, 3);
        expect(out[0]).toEqual({ role: 'system', content: 'P' });
        expect(out.slice(1).map(m => m.content)).toEqual(['2', 'b', '3']);
    });

    it('drops an empty trailing assistant placeholder', () =>
    {
        const out = buildMessages('P', [{ role: 'user', content: 'hola' }, { role: 'assistant', content: '' }], 10);
        expect(out.map(m => m.role)).toEqual(['system', 'user']);
    });

    it('masks keys', () =>
    {
        expect(maskKey('')).toBe('');
        expect(maskKey('sk-proj-abcdefghijkl1234')).toBe('sk-…1234');
        expect(maskKey('short')).not.toContain('short');
    });

    it('translates http errors', () =>
    {
        expect(httpErrorMessage(401)).toContain('CLAVE NO VÁLIDA');
        expect(httpErrorMessage(429)).toContain('CUOTA');
        expect(httpErrorMessage(503)).toContain('503');
    });
});
