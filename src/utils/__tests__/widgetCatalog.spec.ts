import { describe, expect, it } from 'vitest';
import { CATEGORIES, widgetsByCategory } from '../widgetCatalog';

const widgets = {
    clock: { title: 'SISTEMA', description: 'HORA Y FECHA', category: 'sistema' as const },
    moon: { title: 'FASE LUNAR', description: 'FASE ACTUAL DE LA LUNA', category: 'entorno' as const },
    power: { title: 'ENERGÍA', description: 'BATERÍA Y CARGA', category: 'sistema' as const },
};

describe('widgetsByCategory', () =>
{
    it('groups in category order and drops empty groups', () =>
    {
        const groups = widgetsByCategory(widgets);
        expect(groups.map(g => g.id)).toEqual(['sistema', 'entorno']);
        expect(groups[0].entries.map(e => e.kind)).toEqual(['clock', 'power']);
    });

    it('filters by one category', () =>
    {
        expect(widgetsByCategory(widgets, { category: 'entorno' }).map(g => g.id)).toEqual(['entorno']);
    });

    it('searches title and description without accents or case', () =>
    {
        expect(widgetsByCategory(widgets, { query: 'energia' })[0].entries.map(e => e.kind)).toEqual(['power']);
        expect(widgetsByCategory(widgets, { query: 'bateria' })[0].entries.map(e => e.kind)).toEqual(['power']);
        expect(widgetsByCategory(widgets, { query: 'zzz' })).toEqual([]);
    });

    it('has unique category ids', () =>
    {
        expect(new Set(CATEGORIES.map(c => c.id)).size).toBe(CATEGORIES.length);
    });
});
