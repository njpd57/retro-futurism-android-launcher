import { describe, expect, it } from 'vitest';
import { EYE_HEIGHT, forward, fovYFor, HFOV, MAX_FOVY, multiply, perspective, rayCylinder, rayFromPixel, rayRect, transform, viewMatrix, wrapAngle, yawOf } from '../math';

const close = (a: number[], b: number[], digits = 5) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

describe('forward', () =>
{
    it('faces north at yaw 0 and east at a quarter turn, in GL space', () =>
    {
        close(forward(0, 0), [0, 0, -1]);
        close(forward(Math.PI / 2, 0), [1, 0, 0]);
        close(forward(Math.PI, 0), [0, 0, 1]);
        close(forward(0, Math.PI / 4), [0, Math.SQRT1_2, -Math.SQRT1_2]);
    });

    it('agrees with yawOf', () =>
    {
        const [fx, , fz] = forward(yawOf(3, -4), 0);
        close([fx, fz], [0.6, -0.8]);
    });
});

describe('viewMatrix', () =>
{
    const eye: [number, number, number] = [2, EYE_HEIGHT, 5];

    it('puts the eye at the origin and what is ahead on -z', () =>
    {
        const m = viewMatrix(eye, 0, 0);
        close(transform(m, eye).slice(0, 3), [0, 0, 0]);
        const ahead = transform(m, [2, EYE_HEIGHT, 3]);
        close(ahead.slice(0, 3), [0, 0, -2]);
    });

    it('puts what is to the right on +x', () =>
    {
        const m = viewMatrix(eye, 0, 0);
        expect(transform(m, [3, EYE_HEIGHT, 5])[0]).toBeGreaterThan(0.99);
        const turned = viewMatrix(eye, Math.PI / 2, 0);
        // facing east, south is to the right
        expect(transform(turned, [2, EYE_HEIGHT, 6])[0]).toBeGreaterThan(0.99);
    });
});

describe('fovYFor', () =>
{
    it('keeps the horizontal view on a portrait screen and caps the vertical one', () =>
    {
        const aspect = 0.6;
        expect(Math.atan(Math.tan(fovYFor(aspect) / 2) * aspect) * 2).toBeCloseTo(HFOV, 3);
        expect(fovYFor(0.2)).toBe(MAX_FOVY);
        expect(fovYFor(1.8)).toBeLessThan(fovYFor(0.8));
    });
});

describe('perspective', () =>
{
    it('projects the centre ahead to the middle of the screen and keeps depth in range', () =>
    {
        const mvp = multiply(perspective(fovYFor(0.5), 0.5, 0.1, 100), viewMatrix([0, EYE_HEIGHT, 0], 0, 0));
        const [x, y, z, w] = transform(mvp, [0, EYE_HEIGHT, -10]);
        expect(x / w).toBeCloseTo(0);
        expect(y / w).toBeCloseTo(0);
        expect(z / w).toBeGreaterThan(-1);
        expect(z / w).toBeLessThan(1);
        expect(w).toBeCloseTo(10);
    });
});

describe('rayFromPixel', () =>
{
    const eye: [number, number, number] = [0, EYE_HEIGHT, 0];

    it('goes straight ahead through the middle', () =>
    {
        close(rayFromPixel(eye, 0, 0, 400, 800, 200, 400).d, [0, 0, -1]);
    });

    it('is the inverse of the projection', () =>
    {
        const w = 390;
        const h = 700;
        const yaw = 0.7;
        const pitch = -0.2;
        const mvp = multiply(perspective(fovYFor(w / h), w / h, 0.1, 100), viewMatrix(eye, yaw, pitch));
        const ray = rayFromPixel(eye, yaw, pitch, w, h, 100, 500);
        const p: [number, number, number] = [ray.o[0] + ray.d[0] * 6, ray.o[1] + ray.d[1] * 6, ray.o[2] + ray.d[2] * 6];
        const [x, y, , cw] = transform(mvp, p);
        expect(((x / cw + 1) / 2) * w).toBeCloseTo(100, 3);
        expect(((1 - y / cw) / 2) * h).toBeCloseTo(500, 3);
    });
});

describe('rayRect', () =>
{
    const rect = { center: [0, 1.7, -5] as [number, number, number], normal: [0, 0, 1] as [number, number, number], right: [1, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number] };
    const hit = (d: [number, number, number]) => rayRect({ o: [0, EYE_HEIGHT, 0], d }, rect.center, rect.normal, rect.right, rect.up, 1.2, 0.6);

    it('hits inside and misses outside, with the distance', () =>
    {
        expect(hit([0, 0, -1])).toBeCloseTo(5);
        expect(hit([1, 0, -1])).toBeNull();
        expect(hit([0, 0, 1])).toBeNull();
    });
});

describe('rayCylinder', () =>
{
    it('hits the side of a column and misses over its top', () =>
    {
        expect(rayCylinder({ o: [0, 1.6, 0], d: [0, 0, -1] }, 0, -5, 1, 0, 3)).toBeCloseTo(4);
        expect(rayCylinder({ o: [0, 1.6, 0], d: [0, 0, -1] }, 0, -5, 1, 0, 1)).toBeNull();
        expect(rayCylinder({ o: [3, 1.6, 0], d: [0, 0, -1] }, 0, -5, 1, 0, 3)).toBeNull();
    });
});

describe('wrapAngle', () =>
{
    it('keeps angles in range', () =>
    {
        expect(wrapAngle(Math.PI * 2.5)).toBeCloseTo(Math.PI / 2);
        expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    });
});
