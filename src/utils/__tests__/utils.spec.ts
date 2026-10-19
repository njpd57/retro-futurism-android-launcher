import { describe, expect, it } from 'vitest';
import { simplifyString } from '../misc-utils';
import { appTypeLabel } from '../appType';
import { searchApps } from '../appSearch';

const app = (packageName: string, label: string) => ({ packageName, label, labelSimplified: simplifyString(label) });

const apps = [
    app('com.android.camera2', 'Cámara'),
    app('com.android.chrome', 'Chrome'),
    app('com.google.android.apps.maps', 'Google Maps'),
    app('com.google.android.apps.photos', 'Photos'),
    app('com.android.settings', 'Settings'),
];

describe('simplifyString', () =>
{
    it('lowercases and strips accents and symbols', () =>
    {
        expect(simplifyString(' Cámara-2 ')).toBe('camara2');
        expect(simplifyString('Ñandú')).toBe('nandu');
    });
});

describe('appTypeLabel', () =>
{
    it('uses the last package segment', () =>
    {
        expect(appTypeLabel('com.android.chrome')).toBe('chrome');
        expect(appTypeLabel('solo')).toBe('solo');
    });
});

describe('searchApps', () =>
{
    it('sorts alphabetically with an empty query', () =>
    {
        expect(searchApps(apps, '').map(a => a.label)).toEqual(['Cámara', 'Chrome', 'Google Maps', 'Photos', 'Settings']);
    });

    it('matches without accents', () =>
    {
        expect(searchApps(apps, 'camara').map(a => a.label)).toEqual(['Cámara']);
    });

    it('ranks prefix before word prefix before substring', () =>
    {
        const list = [app('a', 'Mapsy'), app('b', 'Google Maps'), app('c', 'Gamaps')];
        expect(searchApps(list, 'maps').map(a => a.packageName)).toEqual(['a', 'b', 'c']);
    });

    it('skips hidden apps', () =>
    {
        expect(searchApps(apps, 'ch', ['com.android.chrome'])).toEqual([]);
    });
});
