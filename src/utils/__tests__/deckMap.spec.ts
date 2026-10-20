import { describe, expect, it } from 'vitest';
import { DOOR_FRAMES, DOOR_OPEN_STEP, deckRows, doorFrame, roomName } from '../deckMap';

describe('roomName', () =>
{
    it('renames the system boxes and keeps the folders', () =>
    {
        expect(roomName({ id: 'sys:favorites', label: 'FAVORITAS' })).toBe('PUENTE');
        expect(roomName({ id: 'sys:recents', label: 'RECIENTES' })).toBe('BITÁCORA');
        expect(roomName({ id: 'sys:new', label: 'NUEVAS' })).toBe('HANGAR');
        expect(roomName({ id: 'dir:JUEGOS', label: 'JUEGOS' })).toBe('JUEGOS');
    });
});

describe('doorFrame', () =>
{
    it('opens in four steps, all the same width', () =>
    {
        expect(DOOR_FRAMES.map(f => f.length)).toEqual([3, 3, 3, 3]);
        expect(doorFrame(0)).toBe('▓▓▓');
        expect(doorFrame(1)).toBe('▓▓░');
        expect(doorFrame(DOOR_OPEN_STEP)).toBe('░░░');
    });

    it('clamps the step and mirrors it for the right-hand side', () =>
    {
        expect(doorFrame(-3)).toBe(doorFrame(0));
        expect(doorFrame(99)).toBe(doorFrame(DOOR_OPEN_STEP));
        expect(doorFrame(1, 'right')).toBe('░▓▓');
        expect(doorFrame(0, 'right')).toBe('▓▓▓');
    });
});

describe('deckRows', () =>
{
    it('pairs the boxes two to a row in order', () =>
    {
        expect(deckRows(['a', 'b', 'c', 'd'])).toEqual([{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }]);
    });

    it('leaves an odd box alone on the left of the last row', () =>
    {
        expect(deckRows(['a', 'b', 'c'])).toEqual([{ left: 'a', right: 'b' }, { left: 'c', right: null }]);
        expect(deckRows(['a'])).toEqual([{ left: 'a', right: null }]);
    });

    it('is empty with no boxes and never loses one', () =>
    {
        expect(deckRows([])).toEqual([]);
        const many = Array.from({ length: 9 }, (_, i) => i);
        expect(deckRows(many).flatMap(r => [r.left, r.right]).filter(x => x !== null)).toEqual(many);
    });
});
