import { MAX_LIGHTS } from './lights';
import { BLUR_TAPS } from './bloom';
import { MAT } from './mesh';

/** A material number as a GLSL float literal. */
const F = (n: number) => n.toFixed(1);

/**
 * One tint only: everything is the phosphor colour, light and dark. Surfaces get a procedural panel pattern from their
 * uv (metres), the lamps and monitors light the rooms, and distance fades into the background like fog.
 */

export const VERTEX = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNormal;
in vec2 aUv;
in float aMat;
in float aEmit;
uniform mat4 uViewProj;
uniform float uDoor[16];
out vec3 vPos;
out vec3 vNormal;
out vec2 vUv;
out float vMat;
out float vEmit;
void main()
{
    vec3 p = aPos;
    float emit = aEmit;
    // a door leaf slides up into the lintel as its door opens; its emit slot only carries the door's number
    if (aMat > ${F(MAT.door)} - 0.5)
    {
        int d = int(aEmit * 16.0 + 0.5);
        p.y += uDoor[d] * 2.45;
        emit = 0.0;
    }
    vPos = p;
    vNormal = aNormal;
    vUv = aUv;
    vMat = aMat;
    vEmit = emit;
    gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
in float vMat;
in float vEmit;
uniform vec3 uEye;
uniform vec3 uPh;
uniform vec3 uBg;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uBlink;
// where the scan band is along the ship (plan y), or far away when it is off
uniform float uSweep;
out vec4 outColor;

// an anti-aliased line every \`period\` units, \`width\` wide (in units)
float lines(float x, float period, float width)
{
    float t = x / period;
    float d = abs(fract(t - 0.5) - 0.5) * period;
    float aa = fwidth(x);
    return 1.0 - smoothstep(width - aa, width + aa, d);
}

float panel(vec2 uv, vec2 period, float width)
{
    return max(lines(uv.x, period.x, width), lines(uv.y, period.y, width));
}

void main()
{
    vec3 n = normalize(vNormal);
    float mat = vMat;
    float albedo = 0.16;
    float emit = vEmit;
    float extra = 0.0;
    vec3 tint = uPh;

    if (mat < ${F(MAT.wall)} + 0.5)
    {
        // wall: panel seams, a darker skirting and a bright rail
        albedo = 0.05 + 0.6 * panel(vUv, vec2(2.0, 1.4), 0.018);
        albedo *= mix(0.55, 1.0, smoothstep(0.25, 0.35, vUv.y));
        albedo += 0.6 * (1.0 - smoothstep(0.0, 0.03, abs(vUv.y - 1.05)));
    }
    else if (mat < ${F(MAT.floor)} + 0.5)
    {
        albedo = 0.035 + 0.4 * panel(vUv, vec2(1.0, 1.0), 0.012) + 0.4 * panel(vUv, vec2(4.0, 4.0), 0.02);
    }
    else if (mat < ${F(MAT.ceiling)} + 0.5)
    {
        albedo = 0.02 + 0.35 * panel(vUv, vec2(3.0, 3.0), 0.04);
    }
    else if (mat < ${F(MAT.prop)} + 0.5)
    {
        albedo = 0.07 + 0.6 * panel(vUv, vec2(1.0, 0.8), 0.014);
    }
    else if (mat < ${F(MAT.screen)} + 0.5)
    {
        vec3 pic = texture(uAtlas, vUv).rgb;
        float scan = 0.94 + 0.06 * sin(vUv.y * 900.0 + uTime * 6.0);
        outColor = vec4(pic * scan * 1.15, 1.0);
        return;
    }
    else if (mat < ${F(MAT.glow)} + 0.5)
    {
        albedo = 0.3;
        emit = max(emit, 0.85);
    }
    else if (mat < ${F(MAT.frame)} + 0.5)
    {
        albedo = 0.22;
    }
    else if (mat < ${F(MAT.crew)} + 0.5)
    {
        // people and Jones: dark bodies outlined by a rim of light
        albedo = 0.1;
        emit = 0.12;
        vec3 view = normalize(uEye - vPos);
        extra = pow(1.0 - abs(dot(n, view)), 2.0) * 0.75;
    }
    else
    {
        // door leaf: a panel with a bright seam round the edge
        albedo = 0.12 + 0.5 * panel(vUv, vec2(1.5, 1.3), 0.02);
    }

    // light: lamps and monitors, with a wrap so surfaces turned away are not black
    float light = 0.03;
    for (int i = 0; i < ${MAX_LIGHTS}; i++)
    {
        vec4 l = uLights[i];
        if (l.w <= 0.0) continue;
        vec3 to = l.xyz - vPos;
        float d2 = dot(to, to);
        float ndl = max(dot(n, to * inversesqrt(d2)), 0.0) * 0.8 + 0.2;
        light += l.w * ndl / (1.0 + 0.2 * d2);
    }

    float level = albedo * light * 2.6 + emit + extra;
    // the scan band: a soft line of light sweeping the length of the ship
    level += 0.35 * exp(-pow((vPos.z - uSweep) / 1.4, 2.0)) * smoothstep(0.0, 0.04, albedo);
    float dist = length(uEye - vPos);
    level *= exp(-dist * 0.02);
    level = 1.0 - exp(-level * 1.35);

    vec3 col = mix(uBg, tint, clamp(level, 0.0, 1.0));
    outColor = vec4(col, 1.0);
}`;

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

/** the frame plus its glow, screen-blended so it saturates at the phosphor instead of clipping */
export const COMPOSITE_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uGain;
${LEVEL}
out vec4 outColor;
void main()
{
    float l = levelOf(texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb);
    float g = clamp(texture(uBloom, vUv).r * uGain, 0.0, 1.0);
    outColor = vec4(mix(uBg, uPh, l + g * (1.0 - l)), 1.0);
}`;
