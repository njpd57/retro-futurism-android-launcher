import { describe, expect, it } from 'vitest';
import { simplifyString } from '../misc-utils';
import { displayName, searchApps } from '../appSearch';
import { isNewApp, pruneFirstSeen, updateFirstSeen } from '../newApps';
import { assignToFolder, buildRows, cleanFolderName, folderOf } from '../folders';
import { firstIndexOf, indexLetter, letterAt, presentLetters } from '../alphaIndex';

const app = (packageName: string, label: string) => ({ packageName, label, labelSimplified: simplifyString(label) });
const apps = [app('a', 'Zeta'), app('b', 'Alfa'), app('c', 'Beta')];

describe('searchApps options', () =>
{
    it('sorts by usage today, then alphabetically', () =>
    {
        expect(searchApps(apps, '', [], { sort: 'usage', usage: { a: 5, c: 9 } }).map(a => a.packageName)).toEqual(['c', 'a', 'b']);
    });

    it('sorts by first seen, newest first; unknown counts as old', () =>
    {
        expect(searchApps(apps, '', [], { sort: 'recent', firstSeen: { c: 100, a: 50 } }).map(a => a.packageName)).toEqual(['c', 'a', 'b']);
    });

    it('finds apps by alias and sorts by it', () =>
    {
        expect(searchApps(apps, 'navegador', [], { aliases: { a: 'Navegador' } }).map(a => a.packageName)).toEqual(['a']);
        expect(searchApps(apps, 'zeta', [], { aliases: { a: 'Navegador' } }).map(a => a.packageName)).toEqual(['a']);
        expect(displayName(apps[0], { a: ' Navegador ' })).toBe('Navegador');
        expect(displayName(apps[0], { a: '  ' })).toBe('Zeta');
    });
});

describe('first seen', () =>
{
    it('marks everything as known on the first scan', () =>
    {
        expect(updateFirstSeen({}, ['a', 'b'], 1000)).toEqual({ a: 0, b: 0 });
    });

    it('stamps new packages on later scans and keeps old stamps', () =>
    {
        expect(updateFirstSeen({ a: 0 }, ['a', 'b'], 1000)).toEqual({ a: 0, b: 1000 });
        expect(updateFirstSeen({ a: 5 }, ['a'], 1000)).toEqual({ a: 5 });
    });

    it('prunes uninstalled packages', () =>
    {
        expect(pruneFirstSeen({ a: 0, b: 1 }, new Set(['b']))).toEqual({ b: 1 });
    });

    it('is new only within the window', () =>
    {
        const day = 86_400_000;
        expect(isNewApp(10 * day, 12 * day)).toBe(true);
        expect(isNewApp(10 * day, 20 * day)).toBe(false);
        expect(isNewApp(0, 1)).toBe(false);
        expect(isNewApp(undefined, 1)).toBe(false);
    });
});

describe('folders', () =>
{
    it('assigns, moves and clears', () =>
    {
        let f = assignToFolder({}, 'a', ' juegos ');
        expect(f).toEqual({ JUEGOS: ['a'] });
        f = assignToFolder(f, 'a', 'Trabajo');
        expect(f).toEqual({ TRABAJO: ['a'] });
        expect(assignToFolder(f, 'a', null)).toEqual({});
        expect(folderOf(f, 'a')).toBe('TRABAJO');
        expect(folderOf(f, 'z')).toBeNull();
    });

    it('ignores blank names and caps their length', () =>
    {
        expect(assignToFolder({ X: ['a'] }, 'a', '   ')).toEqual({});
        expect(cleanFolderName('a'.repeat(40))).toHaveLength(16);
    });

    it('builds rows: folders first, apps inside only when open', () =>
    {
        const folders = { JUEGOS: ['b', 'c'] };
        const closed = buildRows(apps, folders, new Set());
        expect(closed).toEqual([
            { type: 'folder', name: 'JUEGOS', count: 2, open: false },
            { type: 'app', app: apps[0], depth: 0 },
        ]);
        const open = buildRows(apps, folders, new Set(['JUEGOS']));
        expect(open.map(r => r.type === 'folder' ? r.name : `${r.app.packageName}${r.depth}`)).toEqual(['JUEGOS', 'b1', 'c1', 'a0']);
    });
});

describe('alpha index', () =>
{
    it('maps labels to letters with # for the rest', () =>
    {
        expect(indexLetter('Árbol')).toBe('A');
        expect(indexLetter('1Password')).toBe('#');
        expect(indexLetter('')).toBe('#');
    });

    it('lists present letters once and finds their first row', () =>
    {
        const labels = ['1Pass', 'Alfa', 'Ámbar', 'Beta'];
        expect(presentLetters(labels)).toEqual(['#', 'A', 'B']);
        expect(firstIndexOf(labels, 'A')).toBe(1);
        expect(firstIndexOf(labels, 'Z')).toBe(-1);
    });

    it('maps a touch position to a letter', () =>
    {
        const l = ['A', 'B', 'C', 'D'];
        expect(letterAt(l, 0)).toBe('A');
        expect(letterAt(l, 0.5)).toBe('C');
        expect(letterAt(l, 1.4)).toBe('D');
        expect(letterAt(l, -1)).toBe('A');
        expect(letterAt([], 0.5)).toBeNull();
    });
});
