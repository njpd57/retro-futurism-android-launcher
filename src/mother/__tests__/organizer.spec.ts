import { describe, expect, it } from 'vitest';
import { applyPlan, buildOrganizeMessages, describePlan, isPlanEmpty, parsePlan, MAX_FOLDERS } from '../organizer';

describe('buildOrganizeMessages', () =>
{
    it('sends only numbered names and the request', () =>
    {
        const [system, user] = buildOrganizeMessages(['Chrome', 'Maps'], ' agrupa por tipo ');
        expect(system.role).toBe('system');
        expect(user.content).toBe('PETICIÓN: agrupa por tipo\nAPPS:\n1 Chrome\n2 Maps');
        expect(user.content).not.toContain('com.');
    });
});

describe('parsePlan', () =>
{
    it('accepts a valid plan as text or object', () =>
    {
        const plan = { folders: [{ name: 'juegos', apps: [1, 3] }], favorites: [2] };
        expect(parsePlan(JSON.stringify(plan), 3)).toEqual({ ok: true, plan: { folders: [{ name: 'JUEGOS', apps: [1, 3] }], favorites: [2] } });
        expect(parsePlan(plan, 3)).toMatchObject({ ok: true });
    });

    it('drops unknown numbers and apps already placed', () =>
    {
        const r = parsePlan({ folders: [{ name: 'A', apps: [1, 2, 99, 0, 1.5] }, { name: 'B', apps: [2, 3, 4] }], favorites: [1, 1, 7] }, 4);
        expect(r).toEqual({ ok: true, plan: { folders: [{ name: 'A', apps: [1, 2] }, { name: 'B', apps: [3, 4] }], favorites: [1] } });
    });

    it('skips folders with fewer than two apps, repeated or blank names', () =>
    {
        const r = parsePlan({ folders: [{ name: 'SOLA', apps: [1] }, { name: ' ', apps: [2, 3] }, { name: 'X', apps: [2, 3] }, { name: 'x', apps: [4, 5] }], favorites: [] }, 5);
        expect(r).toEqual({ ok: true, plan: { folders: [{ name: 'X', apps: [2, 3] }], favorites: [] } });
    });

    it('caps the number of folders', () =>
    {
        const folders = Array.from({ length: 30 }, (_, i) => ({ name: `F${i}`, apps: [i * 2 + 1, i * 2 + 2] }));
        const r = parsePlan({ folders, favorites: [] }, 60);
        expect(r.ok && r.plan.folders.length).toBe(MAX_FOLDERS);
    });

    it('rejects what is not a plan', () =>
    {
        expect(parsePlan('no json', 3)).toEqual({ ok: false, error: 'RESPUESTA NO VÁLIDA' });
        expect(parsePlan(null, 3)).toMatchObject({ ok: false });
        expect(parsePlan({ folders: 'x' }, 3)).toMatchObject({ ok: false });
        expect(isPlanEmpty((parsePlan({}, 3) as { ok: true; plan: never }).plan)).toBe(true);
    });
});

describe('describePlan and applyPlan', () =>
{
    const labels = ['Chrome', 'Maps', 'Chess', 'Notas'];
    const packages = ['p.chrome', 'p.maps', 'p.chess', 'p.notas'];
    const plan = { folders: [{ name: 'JUEGOS', apps: [3, 1] }], favorites: [2, 4] };

    it('describes the plan for the preview', () =>
    {
        expect(describePlan(plan, labels)).toEqual(['JUEGOS/ (2): CHESS, CHROME', 'FIJAR: MAPS, NOTAS']);
    });

    it('applies folders and adds favorites without touching what was there', () =>
    {
        const result = applyPlan({ folders: { VIEJA: ['p.notas'] }, favorites: ['p.maps'] }, plan, packages);
        expect(result.folders).toEqual({ VIEJA: ['p.notas'], JUEGOS: ['p.chess', 'p.chrome'] });
        expect(result.favorites).toEqual(['p.maps', 'p.notas']);
    });
});
