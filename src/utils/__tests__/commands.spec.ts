import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatNumber, isCommandInput, parseCommand } from '../commands';

describe('parseCommand', () =>
{
    it('ignores text without the prefix', () =>
    {
        expect(parseCommand('chrome')).toBeNull();
        expect(isCommandInput('chrome')).toBe(false);
        expect(isCommandInput('  >x')).toBe(true);
    });

    it('shows help for a bare prefix and for ayuda', () =>
    {
        expect(parseCommand('>')).toEqual({ type: 'help' });
        expect(parseCommand('> ayuda')).toEqual({ type: 'help' });
    });

    it('parses open, note and weather', () =>
    {
        expect(parseCommand('>abrir google maps')).toEqual({ type: 'open', query: 'google maps' });
        expect(parseCommand('> nota comprar pan')).toEqual({ type: 'note', text: 'comprar pan' });
        expect(parseCommand('>clima')).toEqual({ type: 'weather' });
    });

    it('parses themes with or without accents', () =>
    {
        expect(parseCommand('>tema ámbar')).toMatchObject({ type: 'theme', phosphor: 'amber' });
        expect(parseCommand('>tema Verde')).toMatchObject({ type: 'theme', phosphor: 'green' });
        expect(parseCommand('>tema morado')).toMatchObject({ type: 'theme', phosphor: null, arg: 'morado' });
    });

    it('parses sort, list and mother', () =>
    {
        expect(parseCommand('>orden uso')).toMatchObject({ type: 'sort', mode: 'usage' });
        expect(parseCommand('>orden Alfabético')).toMatchObject({ type: 'sort', mode: 'alpha' });
        expect(parseCommand('>orden reciente')).toMatchObject({ type: 'sort', mode: 'recent' });
        expect(parseCommand('>orden raro')).toMatchObject({ type: 'sort', mode: null, arg: 'raro' });
        expect(parseCommand('>lista larga')).toMatchObject({ type: 'list', mode: 'long' });
        expect(parseCommand('>lista simple')).toMatchObject({ type: 'list', mode: 'simple' });
        expect(parseCommand('>mother agrupa por tipo')).toEqual({ type: 'mother', request: 'agrupa por tipo' });
        expect(parseCommand('>mother')).toEqual({ type: 'mother', request: '' });
    });

    it('opens the image viewer and the game', () =>
    {
        expect(parseCommand('>imágenes')).toEqual({ type: 'images' });
        expect(parseCommand('> aislamiento')).toEqual({ type: 'game' });
        expect(parseCommand('>JUEGO')).toEqual({ type: 'game' });
        expect(parseCommand('> marines')).toEqual({ type: 'marines' });
        expect(parseCommand('>LV426')).toEqual({ type: 'marines' });
        expect(parseCommand('> escuadra')).toEqual({ type: 'marines' });
        expect(parseCommand('> desmagnetizar')).toEqual({ type: 'degauss' });
        expect(parseCommand('> desmag')).toEqual({ type: 'degauss' });
        expect(parseCommand('> estasis')).toEqual({ type: 'stasis' });
        expect(parseCommand('> hipersueño')).toEqual({ type: 'stasis' });
    });

    it('reports unknown verbs', () =>
    {
        expect(parseCommand('>volar')).toEqual({ type: 'unknown', word: 'volar' });
    });

    it('evaluates calc', () =>
    {
        expect(parseCommand('>calc 2+2')).toEqual({ type: 'calc', expr: '2+2', result: 4 });
        expect(parseCommand('>calc 2+')).toMatchObject({ result: null });
    });
});

describe('evaluateExpression', () =>
{
    it('respects precedence and parentheses', () =>
    {
        expect(evaluateExpression('2+3*4')).toBe(14);
        expect(evaluateExpression('(2+3)*4')).toBe(20);
        expect(evaluateExpression('10/4')).toBe(2.5);
        expect(evaluateExpression('10%4')).toBe(2);
    });

    it('handles powers (right associative) and unary signs', () =>
    {
        expect(evaluateExpression('2^3^2')).toBe(512);
        expect(evaluateExpression('-2^2')).toBe(-4);
        expect(evaluateExpression('3*-2')).toBe(-6);
        expect(evaluateExpression('--3')).toBe(3);
    });

    it('accepts decimal commas, spaces and x as times', () =>
    {
        expect(evaluateExpression('1,5 x 2')).toBe(3);
    });

    it('rejects malformed input, division by zero and code', () =>
    {
        expect(evaluateExpression('')).toBeNull();
        expect(evaluateExpression('2+')).toBeNull();
        expect(evaluateExpression('(2')).toBeNull();
        expect(evaluateExpression('2)')).toBeNull();
        expect(evaluateExpression('1/0')).toBeNull();
        expect(evaluateExpression('alert(1)')).toBeNull();
    });
});

describe('formatNumber', () =>
{
    it('removes float noise', () =>
    {
        expect(formatNumber(0.1 + 0.2)).toBe('0.3');
        expect(formatNumber(1234)).toBe('1234');
    });
});

import { appendNoteLine } from '../notes';

describe('appendNoteLine', () =>
{
    it('appends on a new line', () =>
    {
        expect(appendNoteLine(null, 'a')).toBe('a');
        expect(appendNoteLine('', ' a ')).toBe('a');
        expect(appendNoteLine('x', 'a')).toBe('x\na');
        expect(appendNoteLine('x\n', 'a')).toBe('x\na');
        expect(appendNoteLine('x', '  ')).toBe('x');
    });

    it('parses > recordar with its text, and with none to list them', () =>
    {
        expect(parseCommand('> recordar 18:30 comprar pan')).toEqual({ type: 'remind', text: '18:30 comprar pan' });
        expect(parseCommand('>recordatorios')).toEqual({ type: 'remind', text: '' });
    });

    it('parses > semana and its aliases', () =>
    {
        for (const w of ['semana', 'semanal', 'informe']) expect(parseCommand(`> ${w}`)).toEqual({ type: 'week' });
    });
});
