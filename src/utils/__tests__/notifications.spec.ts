import { describe, expect, it } from 'vitest';
import type { BridgeNotification } from '@/types/bridge-fork';
import { alertCount, appLabelFor, clearableKeys, groupByApp, splitNotifications, uniquePackages, visibleNotifications } from '../notifications';
import { formatAgo } from '../tui';

const n = (key: string, packageName: string, postTime: number, extra: Partial<BridgeNotification> = {}): BridgeNotification => ({
    key, packageName, postTime, title: key, text: null, subText: null, category: null,
    isOngoing: false, isClearable: true, isGroupSummary: false, isMedia: false, hasLargeIcon: false, actions: [], ...extra,
});

describe('formatAgo', () =>
{
    const now = new Date(2026, 9, 19, 15, 0).getTime();
    const at = (h: number, m = 0, day = 19) => new Date(2026, 9, day, h, m).getTime();

    it('uses relative times for the last hours', () =>
    {
        expect(formatAgo(now - 20000, now)).toBe('AHORA');
        expect(formatAgo(now - 4 * 60000, now)).toBe('HACE 4 MIN');
        expect(formatAgo(now - 2 * 3600000, now)).toBe('HACE 2 H');
    });

    it('falls back to clock, yesterday and date', () =>
    {
        expect(formatAgo(at(7, 5), now)).toBe('07:05');
        expect(formatAgo(at(21, 30, 18), now)).toBe('AYER 21:30');
        expect(formatAgo(at(10, 0, 12), now)).toBe('12-OCT');
    });
});

describe('notifications', () =>
{
    it('hides media and orders newest first', () =>
    {
        const list = [n('old', 'a', 1), n('media', 'm', 5, { isMedia: true }), n('new', 'b', 9)];
        expect(visibleNotifications(list).map(x => x.key)).toEqual(['new', 'old']);
    });

    it('hides a group summary only when the app has individual notifications', () =>
    {
        const list = [n('sum', 'a', 5, { isGroupSummary: true }), n('child', 'a', 4), n('lonely', 'b', 3, { isGroupSummary: true })];
        expect(visibleNotifications(list).map(x => x.key)).toEqual(['child', 'lonely']);
    });

    it('splits ongoing from the rest', () =>
    {
        const { ongoing, recent } = splitNotifications([n('a', 'x', 1, { isOngoing: true }), n('b', 'x', 2)]);
        expect(ongoing.map(x => x.key)).toEqual(['a']);
        expect(recent.map(x => x.key)).toEqual(['b']);
    });

    it('lists one package per app, newest first', () =>
    {
        expect(uniquePackages([n('1', 'a', 1), n('2', 'b', 3), n('3', 'a', 5)])).toEqual(['a', 'b']);
    });

    it('labels an app by its installed name or a capitalized package tail', () =>
    {
        const labels = new Map([['com.g.mail', { label: 'Gmail' }]]);
        expect(appLabelFor('com.g.mail', labels)).toBe('Gmail');
        expect(appLabelFor('com.android.deskclock', labels)).toBe('Deskclock');
    });

    it('groups by app, newest group and newest item first', () =>
    {
        const groups = groupByApp([n('1', 'a', 1), n('2', 'b', 5), n('3', 'a', 9), n('4', 'b', 2)]);
        expect(groups.map(g => g.packageName)).toEqual(['a', 'b']);
        expect(groups[0].items.map(x => x.key)).toEqual(['3', '1']);
        expect(groups[1].latest).toBe(5);
    });

    it('does not count ongoing notifications as alerts', () =>
    {
        expect(alertCount([n('a', 'x', 1, { isOngoing: true }), n('b', 'x', 2), n('c', 'y', 3)])).toBe(2);
    });

    it('only clears clearable, non-ongoing notifications', () =>
    {
        const list = [n('ok', 'a', 1), n('pinned', 'a', 2, { isClearable: false }), n('run', 'a', 3, { isOngoing: true })];
        expect(clearableKeys(list)).toEqual(['ok']);
    });
});
