import { describe, expect, it } from 'vitest';
import { parseSlash } from '../slash';

describe('parseSlash', () =>
{
    it('leaves normal text to the model', () =>
    {
        expect(parseSlash('hola')).toBeNull();
        expect(parseSlash('qué es /temp')).toBeNull();
    });

    it('parses the timer with limits', () =>
    {
        expect(parseSlash('/temp 5')).toEqual({ type: 'timer', minutes: 5 });
        expect(parseSlash('/TEMPORIZADOR 25')).toEqual({ type: 'timer', minutes: 25 });
        expect(parseSlash('/temp 0')).toMatchObject({ type: 'invalid' });
        expect(parseSlash('/temp 999')).toMatchObject({ type: 'invalid' });
        expect(parseSlash('/temp cinco')).toMatchObject({ type: 'invalid' });
        expect(parseSlash('/temp')).toMatchObject({ type: 'invalid' });
    });

    it('parses note, theme, open and organize', () =>
    {
        expect(parseSlash('/nota comprar pan')).toEqual({ type: 'note', text: 'comprar pan' });
        expect(parseSlash('/nota')).toMatchObject({ type: 'invalid' });
        expect(parseSlash('/tema Ámbar')).toEqual({ type: 'theme', phosphor: 'amber' });
        expect(parseSlash('/tema morado')).toMatchObject({ type: 'invalid' });
        expect(parseSlash('/abrir chrome')).toEqual({ type: 'open', query: 'chrome' });
        expect(parseSlash('/ordenar agrupa por tipo')).toEqual({ type: 'organize', request: 'agrupa por tipo' });
        expect(parseSlash('/ordenar')).toMatchObject({ type: 'invalid' });
    });

    it('parses the session commands, help and unknown words', () =>
    {
        expect(parseSlash('/sesiones')).toEqual({ type: 'sessions' });
        expect(parseSlash('/nueva')).toEqual({ type: 'new' });
        expect(parseSlash('/borrar')).toEqual({ type: 'clear' });
        expect(parseSlash('/')).toEqual({ type: 'help' });
        expect(parseSlash('/ayuda')).toEqual({ type: 'help' });
        expect(parseSlash('/volar')).toEqual({ type: 'unknown', word: 'volar' });
    });
});
