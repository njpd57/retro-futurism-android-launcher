import { describe, expect, it } from 'vitest';
import type { BridgeAppUsage, BridgeContact } from '@/types/bridge-fork';
import { blipFromKey, radarContacts, radarScene, SWEEP_WEDGES } from '../radar';
import { primaryNumber, shortName } from '../contacts';
import { formatUsage, topUsage, totalUsageMs } from '../usage';
import { formatTimer, isFinished, remainingMs } from '../timer';
import { formatBytes } from '../tui';

const usage = (packageName: string, minutes: number): BridgeAppUsage => ({ packageName, totalTimeMs: minutes * 60_000, openCount: 1, lastTimeUsed: 0 });

describe('radar', () =>
{
    it('draws the beam and a fading trail behind it', () =>
    {
        const { wedges } = radarScene(1, []);
        expect(wedges).toHaveLength(SWEEP_WEDGES);
        expect(wedges[0].opacity).toBeGreaterThan(wedges[1].opacity);
        for (let i = 2; i < wedges.length; i++) expect(wedges[i].opacity).toBeLessThan(wedges[i - 1].opacity);
        expect(wedges.every(w => w.d.startsWith('M0 0 L') && w.d.endsWith('Z'))).toBe(true);
    });

    it('blip positions are stable and inside the circle', () =>
    {
        expect(blipFromKey('abc')).toEqual(blipFromKey('abc'));
        for (const k of ['a', 'b', 'c', 'notif-1'])
        {
            const b = blipFromKey(k);
            expect(b.radius).toBeGreaterThanOrEqual(0.3);
            expect(b.radius).toBeLessThan(1);
        }
    });

    it('lights a blip the sweep just passed and dims it as the beam moves away', () =>
    {
        const blip = { angle: 0, radius: 0.8 };
        const [fresh] = radarScene(0.05, [blip]).dots;
        expect(fresh.brightness).toBe(1);
        expect(fresh.x).toBeCloseTo(0.8);
        expect(fresh.y).toBeCloseTo(0);
        expect(radarScene(2, [blip]).dots[0].brightness).toBeLessThan(1);
        expect(radarScene(4, [blip]).dots[0].brightness).toBeLessThan(radarScene(2, [blip]).dots[0].brightness);
    });
});

describe('contacts', () =>
{
    const c = (numbers: BridgeContact['phoneNumbers']): BridgeContact => ({ id: 1, lookupKey: 'k', name: 'X', starred: true, hasPhoto: false, phoneNumbers: numbers });

    it('picks the primary number', () =>
    {
        expect(primaryNumber(c([{ number: '1', label: null, isPrimary: false }, { number: '2', label: null, isPrimary: true }]))).toBe('2');
        expect(primaryNumber(c([{ number: '1', label: null, isPrimary: false }]))).toBe('1');
        expect(primaryNumber(c([]))).toBeNull();
    });

    it('shortens names', () =>
    {
        expect(shortName('Ana', 10)).toBe('Ana');
        expect(shortName('Maria Fernanda Lopez', 8)).toBe('Maria F…');
    });
});

describe('usage', () =>
{
    const apps = [usage('a', 5), usage('b', 120), usage('self', 60), usage('c', 0.5)];

    it('ranks, filters and limits', () =>
    {
        expect(topUsage(apps, 5, ['self']).map(a => a.packageName)).toEqual(['b', 'a']);
        expect(topUsage(apps, 1).map(a => a.packageName)).toEqual(['b']);
    });

    it('totals and formats', () =>
    {
        expect(totalUsageMs(apps, ['self'])).toBe(125.5 * 60_000);
        expect(formatUsage(134 * 60_000)).toBe('2H 14M');
        expect(formatUsage(14 * 60_000)).toBe('14M');
        expect(formatUsage(20_000)).toBe('<1M');
    });
});

describe('timer', () =>
{
    it('computes remaining time and completion', () =>
    {
        expect(remainingMs(null, 5)).toBe(0);
        expect(remainingMs(1000, 400)).toBe(600);
        expect(remainingMs(1000, 2000)).toBe(0);
        expect(isFinished(1000, 1000)).toBe(true);
        expect(isFinished(null, 1000)).toBe(false);
    });

    it('formats', () =>
    {
        expect(formatTimer(61_000)).toBe('01:01');
        expect(formatTimer(100)).toBe('00:01');
        expect(formatTimer(3_661_000)).toBe('1:01:01');
    });
});

describe('formatBytes', () =>
{
    it('uses binary units', () =>
    {
        expect(formatBytes(47 * 1024 ** 3)).toBe('47.0 GB');
        expect(formatBytes(512 * 1024 ** 2)).toBe('512 MB');
        expect(formatBytes(0)).toBe('0 MB');
    });
});


describe('radar contacts', () =>
{
    const note = (key: string, packageName: string, postTime: number) => ({
        key, packageName, postTime, title: key, text: null, subText: null, category: null,
        isOngoing: false, isClearable: true, isGroupSummary: false, isMedia: false, hasLargeIcon: false, actions: [],
    });

    it('groups the notifications of an app into one contact', () =>
    {
        const contacts = radarContacts([note('a1', 'com.a', 1), note('b1', 'com.b', 2), note('a2', 'com.a', 3)]);
        expect(contacts.map(c => c.packageName)).toEqual(['com.a', 'com.b']);
        expect(contacts[0].notifications.map(n => n.key)).toEqual(['a2', 'a1']);
    });

    it('places a contact by its package, so it does not move when a signal arrives', () =>
    {
        const before = radarContacts([note('a1', 'com.a', 1)])[0].blip;
        const after = radarContacts([note('a1', 'com.a', 1), note('a2', 'com.a', 2)])[0].blip;
        expect(after.angle).toBe(before.angle);
        expect(after.radius).toBe(before.radius);
    });

    it('marks a busy app as heavy and caps the number of contacts', () =>
    {
        const busy = radarContacts([note('1', 'com.a', 1), note('2', 'com.a', 2), note('3', 'com.a', 3)]);
        expect(busy[0].blip.heavy).toBe(true);
        expect(radarContacts([note('1', 'com.a', 1)])[0].blip.heavy).toBe(false);
        const many = Array.from({ length: 20 }, (_, i) => note(`k${i}`, `com.app${i}`, i));
        expect(radarContacts(many)).toHaveLength(12);
    });

    it('flags a heavy contact so it is drawn bigger', () =>
    {
        expect(radarScene(0, [{ angle: 0, radius: 0.8 }]).dots[0].heavy).toBe(false);
        expect(radarScene(0, [{ angle: 0, radius: 0.8, heavy: true }]).dots[0].heavy).toBe(true);
    });
});
