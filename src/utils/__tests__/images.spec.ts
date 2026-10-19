import { describe, expect, it } from 'vitest';
import { displayName, fitSize, indexLabel, sortImages, wrapIndex } from '../images';

describe('images', () =>
{
    it('fits inside the limit keeping the ratio and never enlarges', () =>
    {
        expect(fitSize(4000, 2000, 1000)).toEqual({ w: 1000, h: 500 });
        expect(fitSize(800, 600, 1280)).toEqual({ w: 800, h: 600 });
        expect(fitSize(0, 10)).toEqual({ w: 0, h: 0 });
    });

    it('shows names in uppercase and keeps the extension when cutting', () =>
    {
        expect(displayName('foto.jpg')).toBe('FOTO.JPG');
        expect(displayName('una_foto_con_un_nombre_larguisimo.jpeg', 16)).toBe('UNA_FOTO_C….JPEG');
        expect(displayName('  ')).toBe('SIN NOMBRE');
    });

    it('sorts newest first without touching the input', () =>
    {
        const input = [{ addedAt: 1 }, { addedAt: 3 }, { addedAt: 2 }];
        expect(sortImages(input).map(i => i.addedAt)).toEqual([3, 2, 1]);
        expect(input[0].addedAt).toBe(1);
    });

    it('labels positions and wraps the selection', () =>
    {
        expect(indexLabel(0)).toBe('[01]');
        expect(indexLabel(11)).toBe('[12]');
        expect(wrapIndex(0, -1, 3)).toBe(2);
        expect(wrapIndex(2, 1, 3)).toBe(0);
        expect(wrapIndex(0, 1, 0)).toBe(-1);
    });
});
