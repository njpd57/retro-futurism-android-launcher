import { describe, expect, it } from 'vitest';
import { cleanDeckName, deckIndex, renameDeck, dropAfter, duplicateWidget, moveWidgetTo, moveWidgetToPanel, pushHistory, addWidget, cycleSize, DEFAULT_PANELS, defaultLayoutSet, moveWidget, sizeOf, newItemId, removeWidget, toggleMinimized } from '../dashboardLayout';

const layout = [
    { id: 'a-1', kind: 'a', minimized: false },
    { id: 'b-1', kind: 'b', minimized: false },
    { id: 'c-1', kind: 'c', minimized: false },
];

describe('dashboardLayout', () =>
{
    it('default panels have unique ids across all panels', () =>
    {
        const all = DEFAULT_PANELS.flat();
        expect(new Set(all.map(i => i.id)).size).toBe(all.length);
    });

    it('sizeOf falls back to the first size when the item has none or an unsupported one', () =>
    {
        expect(sizeOf({}, ['w', 's'])).toBe('w');
        expect(sizeOf({ size: 's' }, ['w', 's'])).toBe('s');
        expect(sizeOf({ size: 'l' }, ['w', 's'])).toBe('w');
    });

    it('cycleSize moves to the next size, wraps and leaves single-size widgets alone', () =>
    {
        const l = [{ id: 'a-1', kind: 'a', minimized: false }];
        const once = cycleSize(l, 'a-1', ['w', 's', 'l']);
        expect(once[0].size).toBe('s');
        expect(cycleSize(cycleSize(once, 'a-1', ['w', 's', 'l']), 'a-1', ['w', 's', 'l'])[0].size).toBe('w');
        expect(cycleSize(l, 'a-1', ['w'])).toEqual(l);
        expect(l[0]).not.toHaveProperty('size');
    });

    it('defaultLayoutSet returns a fresh copy', () =>
    {
        const set = defaultLayoutSet();
        expect(set.panels).toEqual(DEFAULT_PANELS);
        set.panels[0][0].minimized = true;
        expect(DEFAULT_PANELS[0][0].minimized).toBe(false);
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
        expect(normalizeLayoutSet({ active: 0, panels: [] } as never, legacy)).toEqual(set);
    });

    it('normalizing is idempotent and clamps active', () =>
    {
        const set = normalizeLayoutSet({ active: 9, panels: [legacy, []] } as never);
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

    it('moveWidgetTo inserts before or after the target and ignores bad ids', () =>
    {
        expect(moveWidgetTo(layout, 'c-1', 'a-1', false).map(i => i.id)).toEqual(['c-1', 'a-1', 'b-1']);
        expect(moveWidgetTo(layout, 'a-1', 'c-1', true).map(i => i.id)).toEqual(['b-1', 'c-1', 'a-1']);
        expect(moveWidgetTo(layout, 'a-1', 'b-1', true).map(i => i.id)).toEqual(['b-1', 'a-1', 'c-1']);
        expect(moveWidgetTo(layout, 'a-1', 'a-1', true)).toEqual(layout);
        expect(moveWidgetTo(layout, 'x', 'a-1', true)).toEqual(layout);
        expect(moveWidgetTo(layout, 'a-1', 'x', true)).toEqual(layout);
    });

    it('dropAfter splits a window on its diagonal', () =>
    {
        expect(dropAfter(0.2, 0.2)).toBe(false);
        expect(dropAfter(0.8, 0.8)).toBe(true);
    });

    it('moveWidgetToPanel keeps the id, appends and ignores same or bad panels', () =>
    {
        const set = normalizeLayoutSet({ active: 0, panels: [layout.slice(0, 2), [layout[2]]] } as never);
        const moved = moveWidgetToPanel(set, 'a-1', 1);
        expect(moved.panels.map(p => p.map(i => i.id))).toEqual([['b-1'], ['c-1', 'a-1']]);
        expect(moveWidgetToPanel(set, 'a-1', 0)).toBe(set);
        expect(moveWidgetToPanel(set, 'a-1', 5)).toBe(set);
        expect(moveWidgetToPanel(set, 'zz', 1)).toBe(set);
    });

    it('duplicateWidget adds a fresh id with the same kind and size next to the original', () =>
    {
        const set = normalizeLayoutSet({ active: 0, panels: [[{ id: 'a-1', kind: 'a', minimized: true, size: 'w' }, layout[1]]] } as never);
        const out = duplicateWidget(set, 'a-1');
        expect(out.panels[0].map(i => i.id)).toEqual(['a-1', 'a-2', 'b-1']);
        expect(out.panels[0][1]).toMatchObject({ kind: 'a', size: 'w', minimized: false });
        expect(duplicateWidget(set, 'zz')).toBe(set);
    });

    it('pushHistory keeps only the last entries', () =>
    {
        expect(pushHistory([1, 2], 3, 2)).toEqual([2, 3]);
    });

    it('normalizeLayoutSet gives old sets unique deck ids and P-names, and repairs bad ones', () =>
    {
        const old = normalizeLayoutSet({ active: 0, panels: [[], [], []] } as never);
        expect(old.ids).toEqual(['d1', 'd2', 'd3']);
        expect(old.names).toEqual(['P1', 'P2', 'P3']);
        const bad = normalizeLayoutSet({ active: 0, panels: [[], []], ids: ['x', 'x'], names: ['  puente  ', 7] } as never);
        expect(bad.ids).toEqual(['x', 'd1']);
        expect(bad.names).toEqual(['PUENTE', 'P2']);
    });

    it('default decks have names and unique ids', () =>
    {
        const set = defaultLayoutSet();
        expect(set.names).toEqual(['PUENTE', 'SENSORES', 'BITÁCORA', 'RECREO']);
        expect(new Set(set.ids).size).toBe(4);
    });

    it('decks keep their id when others are added or removed, and new ids never repeat', () =>
    {
        let set = defaultLayoutSet();
        set = addPanel(set);
        expect(set.ids[4]).toBe('d5');
        set = { ...set, active: 0 };
        set = removeActivePanel(set);
        expect(deckIndex(set, 'd2')).toBe(0);
        expect(deckIndex(set, 'd1')).toBe(-1);
        expect(addPanel(set).ids.at(-1)).toBe('d1');
        let full = set;
        while (full.panels.length < MAX_PANELS) full = addPanel(full);
        expect(addPanel(full)).toBe(full);
        expect(new Set(full.ids).size).toBe(MAX_PANELS);
    });

    it('renameDeck cleans the name and ignores empty ones', () =>
    {
        const set = defaultLayoutSet();
        expect(renameDeck(set, 1, ' sala  de máquinas ').names[1]).toBe('SALA DE MÁ');
        expect(renameDeck(set, 1, '   ')).toBe(set);
        expect(renameDeck(set, 9, 'x')).toBe(set);
        expect(cleanDeckName('abc')).toBe('ABC');
    });
});
