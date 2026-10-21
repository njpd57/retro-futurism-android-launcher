import { describe, expect, it } from 'vitest';
import { bootFrame, bootLines, bootScreen, bootScript, bootScriptMs, visibleBootLines } from '../boot';

describe('boot', () =>
{
    it('ends with the online line', () =>
    {
        const lines = bootLines();
        expect(lines[lines.length - 1]).toBe('SISTEMA EN LÍNEA');
    });

    it('reveals one line per step and never more than exist', () =>
    {
        expect(visibleBootLines(8, 0, 100)).toBe(1);
        expect(visibleBootLines(8, 250, 100)).toBe(3);
        expect(visibleBootLines(8, 99999, 100)).toBe(8);
        expect(visibleBootLines(8, -5, 100)).toBe(1);
    });

    describe('bootFrame', () =>
    {
        const lines = ['ABCDEFGHIJ', 'KLMNOPQRST'];

        it('types the current line and keeps the earlier ones whole', () =>
        {
            expect(bootFrame(lines, 0, true, 100)).toEqual(['']);
            expect(bootFrame(lines, 40, true, 100)).toEqual(['ABCDE']);
            expect(bootFrame(lines, 80, true, 100)).toEqual(['ABCDEFGHIJ']);
            expect(bootFrame(lines, 140, true, 100)).toEqual(['ABCDEFGHIJ', 'KLMNO']);
        });

        it('shows whole lines when typing is off', () =>
        {
            expect(bootFrame(lines, 0, false, 100)).toEqual(['ABCDEFGHIJ']);
            expect(bootFrame(lines, 150, false, 100)).toEqual(lines);
        });

        it('ends with every line whole', () =>
        {
            expect(bootFrame(lines, 99999, true, 100)).toEqual(lines);
        });
    });

    describe('long boot', () =>
    {
        const script = bootScript(640);

        it('counts the memory test up and ends on the full line', () =>
        {
            const mid = bootScreen(script, 300 + 200 + 350);
            expect(mid[2]).toMatch(/^COMPROBANDO MEMORIA \.\.\. (?!640K)\d+K$/);
            const done = bootScreen(script, 300 + 200 + 700);
            expect(done[2]).toBe('COMPROBANDO MEMORIA ... 640K OK');
        });

        it('fills the directory bar', () =>
        {
            const start = 300 + 200 + 700 + 200 + 200;
            expect(bootScreen(script, start)[5]).toBe('CARGANDO DIRECTORIO DE APPS [░░░░░░░░░░] 0%');
            expect(bootScreen(script, start + 300)[5]).toBe('CARGANDO DIRECTORIO DE APPS [▓▓▓▓▓░░░░░] 50%');
            expect(bootScreen(script, start + 600)[5]).toBe('CARGANDO DIRECTORIO DE APPS [▓▓▓▓▓▓▓▓▓▓] 100%');
        });

        it('shows one line at the start and every line at the end, in order', () =>
        {
            expect(bootScreen(script, 0)).toEqual(['']);
            const end = bootScreen(script, bootScriptMs(script));
            expect(end).toHaveLength(script.length);
            expect(end[0]).toBe('MU-TH-UR 6000 · TERMINAL DE INTERFAZ');
            expect(end[end.length - 1]).toBe('SISTEMA EN LÍNEA');
            expect(bootScreen(script, 99999)).toEqual(end);
        });

        it('lasts a few seconds, not more', () =>
        {
            expect(bootScriptMs(script)).toBeGreaterThan(2000);
            expect(bootScriptMs(script)).toBeLessThan(3500);
        });

        it('never reveals a line before its turn', () =>
        {
            let previous = 0;
            for (let t = 0; t <= bootScriptMs(script); t += 25)
            {
                const n = bootScreen(script, t).length;
                expect(n).toBeGreaterThanOrEqual(previous);
                previous = n;
            }
        });
    });
});
