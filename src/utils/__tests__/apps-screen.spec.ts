import { describe, expect, it } from 'vitest';
import { simplifyString } from '../misc-utils';
import { displayName, searchApps } from '../appSearch';
import { isNewApp, pruneFirstSeen, updateFirstSeen } from '../newApps';
import { assignToFolder, buildRows, cleanFolderName, folderOf } from '../folders';
import { buildBoxes, looseApps } from '../appGroups';
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

describe('app boxes', () =>
{
    const day = 86_400_000;
    const base = { folders: {}, favorites: [], recents: [], firstSeen: {}, usage: {}, now: 100 * day };

    it('has no boxes when there is nothing to group', () =>
    {
        expect(buildBoxes(apps, base)).toEqual([]);
    });

    it('builds system boxes as filters, skipping empty ones', () =>
    {
        const boxes = buildBoxes(apps, { ...base, favorites: ['c'], recents: ['b', 'zzz', 'a'], firstSeen: { a: 99 * day } });
        expect(boxes.map(b => [b.id, b.apps.map(a => a.packageName)])).toEqual([
            ['sys:favorites', ['c']],
            ['sys:recents', ['b', 'a']],
            ['sys:new', ['a']],
        ]);
        expect(boxes[0]).toMatchObject({ kind: 'system', label: 'FAVORITAS', count: 1 });
    });

    it('lists folders alphabetically after the system boxes', () =>
    {
        const boxes = buildBoxes(apps, { ...base, folders: { ZETA: ['a'], ALFA: ['b', 'c'] } });
        expect(boxes.map(b => b.id)).toEqual(['dir:ALFA', 'dir:ZETA']);
        expect(boxes[0]).toMatchObject({ kind: 'folder', label: 'ALFA', count: 2 });
    });

    it('drops folder members that are not in the visible list', () =>
    {
        const visible = apps.filter(a => a.packageName !== 'b');
        expect(buildBoxes(visible, { ...base, folders: { X: ['b'] } })).toEqual([]);
        expect(buildBoxes(visible, { ...base, folders: { X: ['b', 'c'] } })[0].apps.map(a => a.packageName)).toEqual(['c']);
    });

    it('flags folders that hold a new app, but not the NUEVAS box itself', () =>
    {
        const boxes = buildBoxes(apps, { ...base, folders: { X: ['a'], Y: ['b'] }, firstSeen: { a: 99 * day } });
        expect(boxes.find(b => b.id === 'dir:X')?.hasNew).toBe(true);
        expect(boxes.find(b => b.id === 'dir:Y')?.hasNew).toBe(false);
        expect(boxes.find(b => b.id === 'sys:new')?.hasNew).toBe(false);
    });

    it('scales use relative to the busiest box', () =>
    {
        const boxes = buildBoxes(apps, { ...base, folders: { X: ['a'], Y: ['b'], Z: ['c'] }, usage: { a: 10, b: 5 } });
        expect(boxes.map(b => b.usageFraction)).toEqual([1, 0.5, 0]);
    });

    it('lists the apps that are in no folder', () =>
    {
        expect(looseApps(apps, { X: ['b'] }).map(a => a.packageName)).toEqual(['a', 'c']);
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

import { webSearchUrl } from '../webSearch';

describe('webSearchUrl', () =>
{
    it('encodes the query and ignores blanks', () =>
    {
        expect(webSearchUrl(' café & té ')).toBe('https://duckduckgo.com/?q=caf%C3%A9%20%26%20t%C3%A9');
        expect(webSearchUrl('   ')).toBeNull();
    });
});
