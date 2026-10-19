import { describe, expect, it } from 'vitest';
import { addWidget, DEFAULT_LAYOUT, moveWidget, newItemId, removeWidget, toggleMinimized } from '../dashboardLayout';

const layout = [
    { id: 'a-1', kind: 'a', minimized: false },
    { id: 'b-1', kind: 'b', minimized: false },
    { id: 'c-1', kind: 'c', minimized: false },
];

describe('dashboardLayout', () =>
{
    it('default layout has unique ids', () =>
    {
        expect(new Set(DEFAULT_LAYOUT.map(i => i.id)).size).toBe(DEFAULT_LAYOUT.length);
    });

    it('newItemId picks the smallest free number', () =>
    {
        expect(newItemId(layout, 'a')).toBe('a-2');
        expect(newItemId(layout, 'z')).toBe('z-1');
        expect(newItemId([{ id: 'a-2', kind: 'a', minimized: false }], 'a')).toBe('a-1');
    });

    it('adds at the end with a fresh id', () =>
    {
        const next = addWidget(layout, 'a');
        expect(next.at(-1)).toEqual({ id: 'a-2', kind: 'a', minimized: false });
        expect(layout).toHaveLength(3);
    });

    it('removes by id', () =>
    {
        expect(removeWidget(layout, 'b-1').map(i => i.id)).toEqual(['a-1', 'c-1']);
    });

    it('moves and stays put at the edges', () =>
    {
        expect(moveWidget(layout, 'b-1', -1).map(i => i.id)).toEqual(['b-1', 'a-1', 'c-1']);
        expect(moveWidget(layout, 'b-1', 1).map(i => i.id)).toEqual(['a-1', 'c-1', 'b-1']);
        expect(moveWidget(layout, 'a-1', -1).map(i => i.id)).toEqual(['a-1', 'b-1', 'c-1']);
        expect(moveWidget(layout, 'nope', 1).map(i => i.id)).toEqual(['a-1', 'b-1', 'c-1']);
    });

    it('toggles minimized only on the target', () =>
    {
        const next = toggleMinimized(layout, 'b-1');
        expect(next.map(i => i.minimized)).toEqual([false, true, false]);
        expect(toggleMinimized(next, 'b-1')[1].minimized).toBe(false);
    });
});
