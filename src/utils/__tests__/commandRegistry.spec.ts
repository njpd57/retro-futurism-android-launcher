import { describe, expect, it } from 'vitest';
import { complete, ghostText, matchCommands, splitInput, suggest } from '../commandRegistry';

const apps = (q: string) => ['Chrome', 'Chess', 'Calendar'].filter(a => a.toLowerCase().startsWith(q.toLowerCase()));

describe('splitInput', () =>
{
    it('separates prefix, word and rest', () =>
    {
        expect(splitInput('/temp 5', 'mother')).toEqual({ hasPrefix: true, word: 'temp', hasSpace: true, rest: '5' });
        expect(splitInput('> abrir  chrome', 'console')).toEqual({ hasPrefix: true, word: 'abrir', hasSpace: true, rest: 'chrome' });
        expect(splitInput('estado', 'mother')).toEqual({ hasPrefix: false, word: 'estado', hasSpace: false, rest: '' });
    });
});

describe('suggest', () =>
{
    it('gives shortcut chips for an empty input', () =>
    {
        const chips = suggest('', 'mother');
        expect(chips.map(c => c.fill)).toContain('ESTADO');
        expect(chips.map(c => c.fill)).toContain('/temp 5');
        expect(chips.length).toBeLessThanOrEqual(6);
        expect(suggest('', 'console').map(c => c.fill)).toContain('>calc 2+2');
        expect(suggest('', 'mother').map(c => c.label)).toContain('/TEMP 5');
    });

    it('completes command names after the prefix', () =>
    {
        expect(suggest('/te', 'mother').map(s => s.fill)).toEqual(['/temp ', '/tema ']);
        expect(suggest('>cl', 'console').map(s => s.fill)).toEqual(['>clima']);
        expect(suggest('/zzz', 'mother')).toEqual([]);
    });

    it('offers the bare MOTHER words without a prefix', () =>
    {
        expect(suggest('est', 'mother').map(s => s.fill)).toEqual(['ESTADO']);
        expect(suggest('hola', 'mother')).toEqual([]);
        expect(suggest('est', 'console')).toEqual([]);
    });

    it('completes arguments', () =>
    {
        expect(suggest('/tema ro', 'mother').map(s => s.fill)).toEqual(['/tema rojo']);
        expect(suggest('/tema am', 'mother').map(s => s.fill)).toEqual(['/tema ámbar']);
        expect(suggest('>orden ', 'console').map(s => s.fill)).toEqual(['>orden alfa', '>orden uso', '>orden reciente']);
        expect(suggest('/temp 1', 'mother').map(s => s.fill)).toEqual(['/temp 10']);
        expect(suggest('/abrir ch', 'mother', { apps }).map(s => s.fill)).toEqual(['/abrir Chrome', '/abrir Chess']);
        expect(suggest('/ordenar ', 'mother').length).toBeGreaterThan(0);
    });
});

describe('ghostText and complete', () =>
{
    it('shows the remainder of the first suggestion', () =>
    {
        expect(ghostText('/te', 'mother')).toBe('mp ');
        expect(ghostText('/tema ro', 'mother')).toBe('jo');
        expect(ghostText('est', 'mother')).toBe('ADO');
        expect(ghostText('', 'mother')).toBe('');
        expect(ghostText('hola', 'mother')).toBe('');
    });

    it('TAB fills and cycles', () =>
    {
        expect(complete('/te', 'mother')).toBe('/temp ');
        expect(complete('/te', 'mother', {}, 1)).toBe('/tema ');
        expect(complete('/te', 'mother', {}, 2)).toBe('/temp ');
        expect(complete('hola', 'mother')).toBeNull();
    });
});

describe('matchCommands', () =>
{
    it('lists the commands starting with the word, with or without prefix', () =>
    {
        expect(matchCommands('ca', 'console').map(d => d.name)).toEqual(['calc']);
        expect(matchCommands('>cl', 'console').map(d => d.name)).toEqual(['clima']);
        expect(matchCommands('MAR', 'console').map(d => d.name)).toEqual(['marines']);
    });

    it('needs two letters, stops at the first space and caps the list', () =>
    {
        expect(matchCommands('c', 'console')).toEqual([]);
        expect(matchCommands('calc 2', 'console')).toEqual([]);
        expect(matchCommands('xyz', 'console')).toEqual([]);
        expect(matchCommands('es', 'console', 1)).toHaveLength(1);
    });

    it('skips the bare words of the MOTHER chat', () =>
    {
        expect(matchCommands('est', 'mother')).toEqual([]);
    });
});
