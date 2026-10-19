import { describe, expect, it } from 'vitest';
import type { BridgeNotification } from '@/types/bridge-fork';
import { clearableKeys, splitNotifications, uniquePackages, visibleNotifications } from '../notifications';

const n = (key: string, packageName: string, postTime: number, extra: Partial<BridgeNotification> = {}): BridgeNotification => ({
    key, packageName, postTime, title: key, text: null, subText: null, category: null,
    isOngoing: false, isClearable: true, isGroupSummary: false, isMedia: false, hasLargeIcon: false, actions: [], ...extra,
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

    it('only clears clearable, non-ongoing notifications', () =>
    {
        const list = [n('ok', 'a', 1), n('pinned', 'a', 2, { isClearable: false }), n('run', 'a', 3, { isOngoing: true })];
        expect(clearableKeys(list)).toEqual(['ok']);
    });
});
