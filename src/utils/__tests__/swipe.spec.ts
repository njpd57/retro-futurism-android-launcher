import { describe, expect, it } from 'vitest';
import { classifySwipe, neighbour } from '../swipe';

const t = (dx: number, dy: number, startY = 300, ms = 200) => classifySwipe({ dx, dy, startY, ms });

describe('classifySwipe', () =>
{
    it('detects horizontal swipes', () =>
    {
        expect(t(-120, 10)).toBe('left');
        expect(t(120, -20)).toBe('right');
    });

    it('ignores short, slow or diagonal moves', () =>
    {
        expect(t(-40, 0)).toBeNull();
        expect(t(-120, 0, 300, 900)).toBeNull();
        expect(t(-120, 90)).toBeNull();
    });

    it('never treats a vertical scroll as a swipe', () =>
    {
        expect(t(5, 300)).toBeNull();
        expect(t(5, -300)).toBeNull();
    });

    it('pull-down only from the top edge', () =>
    {
        expect(t(5, 150, 10)).toBe('pull-down');
        expect(t(5, 150, 300)).toBeNull();
        expect(t(5, 50, 10)).toBeNull();
        expect(t(5, -150, 10)).toBeNull();
    });
});

describe('neighbour', () =>
{
    it('stops at the ends', () =>
    {
        const tabs = ['panel', 'apps', 'mother'];
        expect(neighbour(tabs, 'panel', 1)).toBe('apps');
        expect(neighbour(tabs, 'panel', -1)).toBeNull();
        expect(neighbour(tabs, 'mother', 1)).toBeNull();
        expect(neighbour(tabs, 'x', 1)).toBeNull();
    });
});
