import { describe, expect, it } from 'vitest';
import { HANDOFF_MS, LABEL_MAX, handoffFrame, handoffText } from '../handoff';

describe('handoffText', () =>
{
    it('names the app in uppercase', () =>
    {
        expect(handoffText('Spotify')).toEqual({ link: '> ENLAZANDO: SPOTIFY', transfer: 'TRANSFIRIENDO CONTROL' });
    });

    it('cuts long names and fills in an empty one', () =>
    {
        const long = handoffText('A very long application name indeed').link.replace('> ENLAZANDO: ', '');
        expect(long).toHaveLength(LABEL_MAX);
        expect(long.endsWith('»')).toBe(true);
        expect(handoffText('   ').link).toBe('> ENLAZANDO: APLICACIÓN');
    });
});

describe('handoffFrame', () =>
{
    const text = handoffText('Spotify');

    it('types the first line, then the second', () =>
    {
        expect(handoffFrame(text, 0)).toMatchObject({ link: 0, transfer: 0 });
        const mid = handoffFrame(text, 150);
        expect(mid.link).toBeGreaterThan(0);
        expect(mid.transfer).toBe(0);
        const late = handoffFrame(text, 300);
        expect(late.link).toBe(text.link.length);
        expect(late.transfer).toBeGreaterThan(0);
    });

    it('has both lines typed before the fold', () =>
    {
        const end = handoffFrame(text, HANDOFF_MS - 60);
        expect(end.link).toBe(text.link.length);
        expect(end.transfer).toBe(text.transfer.length);
    });
});
