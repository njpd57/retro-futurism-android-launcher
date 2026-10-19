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

import { addPanel, addWidgetToActive, activePanel, createLayoutSet, MAX_PANELS, normalizeLayoutSet, removeActivePanel, selectPanel, setActivePanelItems } from '../dashboardLayout';

describe('layout sets (several panels)', () =>
{
    const legacy = [{ id: 'clock-1', kind: 'clock', minimized: false }];

    it('migrates the legacy single layout into panel 1', () =>
    {
        const set = createLayoutSet(legacy);
        expect(set.panels).toEqual([legacy]);
        expect(normalizeLayoutSet(undefined, legacy)).toEqual(set);
        expect(normalizeLayoutSet({ active: 0, panels: [] }, legacy)).toEqual(set);
    });

    it('normalizing is idempotent and clamps active', () =>
    {
        const set = normalizeLayoutSet({ active: 9, panels: [legacy, []] });
        expect(set.active).toBe(1);
        expect(normalizeLayoutSet(set)).toEqual(set);
    });

    it('adds panels up to the limit and selects the new one', () =>
    {
        let set = createLayoutSet(legacy);
        for (let i = 0; i < 10; i++) set = addPanel(set);
        expect(set.panels).toHaveLength(MAX_PANELS);
        expect(set.active).toBe(MAX_PANELS - 1);
        expect(activePanel(set)).toEqual([]);
    });

    it('removes the visible panel but never the last one', () =>
    {
        let set = addPanel(createLayoutSet(legacy));
        set = removeActivePanel(set);
        expect(set.panels).toEqual([legacy]);
        expect(removeActivePanel(set)).toBe(set);
    });

    it('selectPanel ignores out of range indexes', () =>
    {
        const set = addPanel(createLayoutSet(legacy));
        expect(selectPanel(set, 0).active).toBe(0);
        expect(selectPanel(set, 7)).toBe(set);
    });

    it('widget ids stay unique across panels', () =>
    {
        let set = addWidgetToActive(createLayoutSet(legacy), 'notes');
        set = addPanel(set);
        set = addWidgetToActive(set, 'notes');
        expect(activePanel(set).map(i => i.id)).toEqual(['notes-2']);
    });

    it('editing the visible panel leaves the others alone', () =>
    {
        const set = addPanel(createLayoutSet(legacy));
        const next = setActivePanelItems(set, [{ id: 'log-1', kind: 'log', minimized: false }]);
        expect(next.panels[0]).toEqual(legacy);
        expect(next.panels[1]).toHaveLength(1);
    });
});
