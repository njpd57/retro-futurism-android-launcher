import { BLUR_TAPS } from '../bloom';
import { F, FAR_PLANE } from './common';

/*
 * Bloom passes (see `bloom.ts`). They work on the level of a pixel, how far it is from the background towards the
 * phosphor, so the glow keeps the one tint and never goes past the phosphor's own colour.
 */

/** one triangle that covers the screen, from the vertex number alone */
export const QUAD_VERTEX = `#version 300 es
out vec2 vUv;
void main()
{
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const LEVEL = `
uniform vec3 uPh;
uniform vec3 uBg;
float levelOf(vec3 c)
{
    vec3 d = uPh - uBg;
    return clamp(dot(c - uBg, d) / max(dot(d, d), 1e-5), 0.0, 1.0);
}`;

/** keeps what is bright enough to glow, at half size */
export const BRIGHT_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform float uThreshold;
${LEVEL}
out vec4 outColor;
void main()
{
    float l = levelOf(texture(uSrc, vUv).rgb);
    outColor = vec4(vec3(smoothstep(uThreshold, 1.0, l) * l), 1.0);
}`;

/** one direction of a separable Gaussian blur over the red channel */
export const BLUR_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uStep;
uniform float uWeights[${BLUR_TAPS + 1}];
out vec4 outColor;
void main()
{
    float s = texture(uSrc, vUv).r * uWeights[0];
    for (int i = 1; i <= ${BLUR_TAPS}; i++)
    {
        vec2 o = uStep * float(i);
        s += (texture(uSrc, vUv + o).r + texture(uSrc, vUv - o).r) * uWeights[i];
    }
    outColor = vec4(vec3(s), 1.0);
}`;

/**
 * The frame, its outlines, its glow and a little grain. Outlines are found in the depth the scene pass wrote: where
 * 1 / depth stops being a straight line across the screen there is an edge (a silhouette, or a crease where two
 * planes meet), so they are drawn per pixel, one pixel thick, and never crawl like a pattern on a surface would.
 */
export const COMPOSITE_FRAGMENT = `#version 300 es
// high precision: the distance is packed in three bytes and must come back whole
precision highp float;
precision highp sampler2D;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uNd;
uniform sampler2D uBloom;
uniform float uGain;
uniform vec2 uTexel;
// how strong the outlines are and how much grain, 0 for none
uniform float uEdge;
uniform float uGrain;
// 1: the picture is one tint (the phosphor look); 0: it is in colour
uniform float uMono;
${LEVEL}
out vec4 outColor;

// the inverse of the distance at a pixel, and the kind of surface there
vec2 lookup(vec2 uv)
{
    vec4 t = texture(uNd, uv);
    float z = dot(t.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0)) * ${F(FAR_PLANE)};
    return vec2(1.0 / max(z, 0.05), t.a);
}

float interleavedNoise(vec2 p)
{
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main()
{
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 scene = texelFetch(uScene, px, 0).rgb;
    float l = levelOf(scene);
    float g = clamp(texture(uBloom, vUv).r * uGain, 0.0, 1.0);
    l = l + g * (1.0 - l);
    // in colour the glow is warm light added on top, and the outlines are a faint dark crease where things meet
    vec3 c = scene + g * (1.0 - scene) * vec3(1.0, 0.9, 0.75);

    if (uEdge > 0.0)
    {
        vec2 c = lookup(vUv);
        vec2 o = uTexel * 1.5;
        vec2 a = lookup(vUv + vec2(o.x, 0.0));
        vec2 b = lookup(vUv - vec2(o.x, 0.0));
        vec2 u = lookup(vUv + vec2(0.0, o.y));
        vec2 d = lookup(vUv - vec2(0.0, o.y));
        // the second difference of 1 / depth along each axis: zero across a plane, large at an edge
        float bend = abs(a.x + b.x - 2.0 * c.x) + abs(u.x + d.x - 2.0 * c.x);
        float edge = smoothstep(0.012, 0.04, bend / c.x);
        // a change of surface kind (a door in its wall) is an edge too
        float kind = max(max(abs(a.y - c.y), abs(b.y - c.y)), max(abs(u.y - c.y), abs(d.y - c.y)));
        edge = max(edge, step(0.03, kind));
        // far ones fade with the fog, so the room's outline is strongest near you
        float strength = edge * (0.3 + 0.7 * exp(-1.0 / c.x * 0.04)) * uEdge;
        l = l + strength * 0.8 * (1.0 - l);
        c *= 1.0 - strength * 0.3;
    }

    // grain: noise that stays fixed on the glass, enough to break the banding of a smooth gradient
    float grain = (interleavedNoise(gl_FragCoord.xy) - 0.5) * uGrain;
    if (uMono > 0.5)
        outColor = vec4(mix(uBg, uPh, clamp(l + grain, 0.0, 1.0)), 1.0);
    else
        outColor = vec4(clamp(c + grain, 0.0, 1.0), 1.0);
}`;
