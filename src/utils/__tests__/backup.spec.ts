import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, serializeBackup, type KeyValueStore } from '../backup';

function store(entries: Record<string, string>): KeyValueStore
{
    const keys = Object.keys(entries);
    return { length: keys.length, key: i => keys[i] ?? null, getItem: k => entries[k] ?? null };
}

describe('backup', () =>
{
    it('exports settings and widgets but never MOTHER', () =>
    {
        const b = createBackup(store({
            'settings.phosphor': '"green"',
            'widget.notes.notes-1': 'hola',
            'mother.apiKey': 'sk-secret',
            'mother.history': '[]',
            'other': 'x',
        }));
        expect(Object.keys(b.data).sort()).toEqual(['settings.phosphor', 'widget.notes.notes-1']);
        expect(serializeBackup(b)).not.toContain('sk-secret');
    });

    it('round-trips', () =>
    {
        const b = createBackup(store({ 'settings.bloom': '0.5' }));
        expect(parseBackup(serializeBackup(b))).toEqual({ ok: true, data: { 'settings.bloom': '0.5' }, skipped: 0 });
    });

    it('drops foreign keys and non-string values', () =>
    {
        const text = JSON.stringify({ app: 'crt-launcher', version: 1, data: { 'mother.apiKey': 'sk', 'settings.a': '1', 'settings.b': 2 } });
        expect(parseBackup(text)).toEqual({ ok: true, data: { 'settings.a': '1' }, skipped: 2 });
    });

    it('rejects garbage', () =>
    {
        expect(parseBackup('hola')).toEqual({ ok: false, error: 'TEXTO NO VÁLIDO' });
        expect(parseBackup('{"app":"x","data":{}}')).toMatchObject({ ok: false });
        expect(parseBackup('{"app":"crt-launcher","version":99,"data":{}}')).toEqual({ ok: false, error: 'VERSIÓN NO COMPATIBLE' });
        expect(parseBackup('null')).toMatchObject({ ok: false });
    });
});
