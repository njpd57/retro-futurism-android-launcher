import { simplifyString } from './misc-utils';

export type WidgetCategory = 'sistema' | 'tiempo' | 'entorno' | 'personal' | 'mother' | 'juegos';

/** Display order of the categories in the widget catalog. */
export const CATEGORIES: { id: WidgetCategory; label: string }[] = [
    { id: 'sistema', label: 'SISTEMA' },
    { id: 'tiempo', label: 'TIEMPO' },
    { id: 'entorno', label: 'ENTORNO' },
    { id: 'personal', label: 'PERSONAL' },
    { id: 'mother', label: 'MOTHER' },
    { id: 'juegos', label: 'JUEGOS' },
];

interface Meta { title: string; description: string; category: WidgetCategory }

/** Groups the widgets by category in `CATEGORIES` order, optionally filtered by text and/or one category. Empty groups are dropped. */
export function widgetsByCategory<T extends Meta>(
    widgets: Record<string, T>,
    options: { query?: string; category?: WidgetCategory | null } = {},
): { id: WidgetCategory; label: string; entries: { kind: string; def: T }[] }[]
{
    const q = simplifyString(options.query ?? '');
    return CATEGORIES
        .filter(c => !options.category || c.id === options.category)
        .map(c => ({
            ...c,
            entries: Object.entries(widgets)
                .filter(([, def]) => def.category === c.id && (!q || simplifyString(`${def.title} ${def.description}`).includes(q)))
                .map(([kind, def]) => ({ kind, def })),
        }))
        .filter(g => g.entries.length > 0);
}
