import { describe, expect, it } from 'vitest';
import { autoScrollSpeed, dropAction, movedPast, NEW_FOLDER_ID } from '../dragDrop';

const boxes = [
    { id: 'sys:favorites', kind: 'system' as const, label: 'FAVORITAS' },
    { id: 'dir:JUEGOS', kind: 'folder' as const, label: 'JUEGOS' },
    { id: 'dir:TRABAJO', kind: 'folder' as const, label: 'TRABAJO' },
];

describe('movedPast', () =>
{
    it('needs a real movement, in any direction', () =>
    {
        expect(movedPast(3, 4)).toBe(false);
        expect(movedPast(0, 13)).toBe(true);
        expect(movedPast(-9, -9)).toBe(true);
    });
});

describe('dropAction', () =>
{
    it('moves the app into a user folder', () =>
    {
        expect(dropAction('dir:JUEGOS', boxes, null)).toEqual({ type: 'folder', name: 'JUEGOS' });
        expect(dropAction('dir:JUEGOS', boxes, 'TRABAJO')).toEqual({ type: 'folder', name: 'JUEGOS' });
    });

    it('ignores system boxes, unknown targets, no target and the folder it is already in', () =>
    {
        expect(dropAction('sys:favorites', boxes, null)).toEqual({ type: 'none' });
        expect(dropAction('dir:NADA', boxes, null)).toEqual({ type: 'none' });
        expect(dropAction(null, boxes, null)).toEqual({ type: 'none' });
        expect(dropAction('dir:JUEGOS', boxes, 'JUEGOS')).toEqual({ type: 'none' });
    });

    it('asks for a name on the new-folder zone', () =>
    {
        expect(dropAction(NEW_FOLDER_ID, boxes, 'JUEGOS')).toEqual({ type: 'new' });
    });
});

describe('autoScrollSpeed', () =>
{
    it('does not scroll in the middle', () =>
    {
        expect(autoScrollSpeed(300, 100, 700)).toBe(0);
    });

    it('scrolls up near the top and down near the bottom, faster at the edge', () =>
    {
        expect(autoScrollSpeed(140, 100, 700)).toBeLessThan(0);
        expect(autoScrollSpeed(660, 100, 700)).toBeGreaterThan(0);
        expect(autoScrollSpeed(100, 100, 700)).toBeLessThan(autoScrollSpeed(140, 100, 700));
        expect(autoScrollSpeed(700, 100, 700)).toBeGreaterThan(autoScrollSpeed(660, 100, 700));
    });

    it('is capped', () =>
    {
        expect(autoScrollSpeed(-500, 100, 700)).toBe(-14);
        expect(autoScrollSpeed(2000, 100, 700)).toBe(14);
    });
});
