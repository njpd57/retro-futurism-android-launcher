import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/utils/widgetCatalog';
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
});
