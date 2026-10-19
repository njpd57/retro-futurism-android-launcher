import { describe, expect, it } from 'vitest';
import { bootLines, visibleBootLines } from '../boot';

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
});
