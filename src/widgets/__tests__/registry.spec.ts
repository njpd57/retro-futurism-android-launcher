import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/utils/widgetCatalog';
import { DEFAULT_PANELS, MAX_PANELS, SIZE_CELLS, sizeOf } from '@/utils/dashboardLayout';
import { WIDGETS } from '../registry';

describe('widget registry', () =>
{
    it('gives every widget a known category, a description and a preview', () =>
    {
        const ids = CATEGORIES.map(c => c.id);
        for (const [kind, def] of Object.entries(WIDGETS))
        {
            expect(ids, kind).toContain(def.category);
            expect(def.description.length, kind).toBeGreaterThan(0);
            expect(def.preview.length, kind).toBeGreaterThan(0);
        }
    });

    it('gives every widget a non-empty list of valid, distinct sizes', () =>
    {
        for (const [kind, def] of Object.entries(WIDGETS))
        {
            expect(def.sizes.length, kind).toBeGreaterThan(0);
            expect(new Set(def.sizes).size, kind).toBe(def.sizes.length);
            for (const size of def.sizes) expect(SIZE_CELLS, kind).toHaveProperty(size);
        }
    });

    it('starts from default panels that only use known widgets at supported sizes', () =>
    {
        expect(DEFAULT_PANELS.length).toBeLessThanOrEqual(MAX_PANELS);
        for (const item of DEFAULT_PANELS.flat())
        {
            expect(WIDGETS, item.id).toHaveProperty(item.kind);
            expect(sizeOf(item, WIDGETS[item.kind].sizes), item.id).toBe(item.size);
        }
    });
});
