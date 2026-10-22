import { MAX_LIGHTS } from './lights';
import { BLUR_TAPS } from './bloom';
import { ATLAS_H, CELL_H, COLS } from './atlas';
import { MAT, MAT_STYLE } from './mesh';

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
out float vStyle;
out float vEmit;
void main()
{
    // the material number carries the room's surface style: mat + 16 * style
    float style = floor(aMat / ${F(MAT_STYLE)} + 0.01);
    float mat = aMat - style * ${F(MAT_STYLE)};
    vec3 p = aPos;
    float emit = aEmit;
    // a door leaf slides up into the lintel as its door opens; its emit slot only carries the door's number
    if (abs(mat - ${F(MAT.door)}) < 0.5)
    {
        int d = int(aEmit * 16.0 + 0.5);
        p.y += uDoor[d] * 2.45;
        emit = 0.0;
    }
    vPos = p;
    vNormal = aNormal;
    vUv = aUv;
    vMat = mat;
    vStyle = style;
    vEmit = emit;
    gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
in float vMat;
in float vStyle;
in float vEmit;
uniform vec3 uEye;
uniform vec3 uPh;
uniform vec3 uBg;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform sampler2D uAtlas;
uniform float uTime;
uniform float uBlink;
// how fast the crew's scan lines climb; 0 holds them still
uniform float uHolo;
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

// a round rivet at every crossing of a seam grid
float rivets(vec2 uv, vec2 period, float r)
{
    vec2 v = (fract(uv / period + 0.5) - 0.5) * period;
    float aa = fwidth(uv.x) + fwidth(uv.y);
    return 1.0 - smoothstep(r - aa, r + aa, length(v));
}

// hexagons of width \`size\`: the cell outlines
float hexLines(vec2 uv, float size, float width)
{
    vec2 p = uv / size;
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(p, p - vec2(1.0, 1.5)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
    vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
    q = abs(q);
    float edge = 0.5 - max(dot(q, vec2(0.5, 0.8660254)), q.x);
    float aa = fwidth(p.x) + fwidth(p.y);
    return 1.0 - smoothstep(width / size - aa, width / size + aa, edge);
}

// the pattern of a wall, floor or ceiling in room style \`st\`: how much of the surface is seam (0..1+)
float surface(int kind, int st, vec2 uv)
{
    if (kind == 0)
    {
        // wall
        if (st == 1) return 0.55 * panel(uv, vec2(1.0, 0.9), 0.012) + 0.5 * rivets(uv, vec2(1.0, 0.9), 0.035);
        if (st == 2) return 0.5 * panel(uv, vec2(2.0, 1.2), 0.018) + 0.6 * lines(uv.y, 2.4, 0.05);
        if (st == 3) return 0.5 * panel(uv, vec2(2.0, 1.4), 0.018) + 0.7 * lines(uv.x, 3.0, 0.05);
        if (st == 4) return 0.4 * panel(uv, vec2(4.0, 2.0), 0.012);
        if (st == 5) return 0.7 * hexLines(uv, 0.55, 0.018);
        if (st == 6) return 0.5 * lines(uv.y, 0.7, 0.012) + 0.5 * lines(uv.x, 6.0, 0.03);
        return 0.6 * panel(uv, vec2(2.0, 1.4), 0.018);
    }
    if (kind == 1)
    {
        // floor (uv is the plan)
        if (st == 1) return 0.4 * panel(uv, vec2(0.5), 0.008) + 0.4 * panel(uv, vec2(4.0), 0.02);
        if (st == 2)
        {
            vec2 r = vec2(uv.x + uv.y, uv.x - uv.y) * 0.70711;
            return 0.55 * panel(r, vec2(0.5), 0.02) + 0.3 * panel(uv, vec2(4.0), 0.03);
        }
        if (st == 3) return 0.5 * panel(uv, vec2(2.0), 0.02) + 0.4 * panel(uv, vec2(4.0), 0.035);
        if (st == 4) return 0.2 * panel(uv, vec2(2.0), 0.01);
        if (st == 5) return 0.6 * hexLines(uv, 0.9, 0.015);
        if (st == 6) return 0.25 * panel(uv, vec2(0.25), 0.02) + 0.4 * panel(uv, vec2(4.0), 0.02);
        return 0.4 * panel(uv, vec2(1.0), 0.012) + 0.4 * panel(uv, vec2(4.0), 0.02);
    }
    // ceiling
    if (st == 5) return 0.4 * hexLines(uv, 1.1, 0.03);
    if (st == 6) return 0.4 * lines(uv.x + uv.y, 1.0, 0.03);
    return 0.35 * panel(uv, vec2(3.0), 0.04);
}

void main()
{
    vec3 n = normalize(vNormal);
    float mat = vMat;
    int st = int(vStyle + 0.5);
    float albedo = 0.16;
    float emit = vEmit;
    float extra = 0.0;
    vec3 tint = uPh;
    // surfaces that get their seams lifted into the light
    bool bump = false;

    if (mat < ${F(MAT.wall)} + 0.5)
    {
        // wall: seams, a darker skirting and a bright rail
        albedo = (st == 4 ? 0.075 : 0.05) + surface(0, st, vUv);
        albedo *= mix(0.55, 1.0, smoothstep(0.25, 0.35, vUv.y));
        albedo += 0.6 * (1.0 - smoothstep(0.0, 0.03, abs(vUv.y - 1.05)));
        bump = true;
    }
    else if (mat < ${F(MAT.floor)} + 0.5)
    {
        albedo = (st == 4 ? 0.05 : 0.035) + surface(1, st, vUv);
        bump = true;
    }
    else if (mat < ${F(MAT.ceiling)} + 0.5)
    {
        albedo = 0.02 + surface(2, st, vUv);
    }
    else if (mat < ${F(MAT.prop)} + 0.5)
    {
        albedo = 0.07 + 0.6 * panel(vUv, vec2(1.0, 0.8), 0.014);
        bump = true;
    }
    else if (mat < ${F(MAT.screen)} + 0.5)
    {
        // a monitor: the picture of its cell of the atlas, on slightly curved glass that darkens at the corners
        vec2 grid = vec2(${F(COLS)}, ${F(ATLAS_H / CELL_H)});
        vec2 origin = floor(vUv * grid) / grid;
        vec2 c = fract(vUv * grid) * 2.0 - 1.0;
        c *= 1.0 + 0.06 * vec2(c.y * c.y, c.x * c.x);
        if (max(abs(c.x), abs(c.y)) > 1.0) { outColor = vec4(uBg, 1.0); return; }
        vec3 pic = texture(uAtlas, origin + (c * 0.5 + 0.5) / grid).rgb;
        float scan = 0.94 + 0.06 * sin(vUv.y * 900.0 + uTime * 6.0);
        float vig = 1.0 - 0.4 * pow(max(abs(c.x), abs(c.y)), 4.0);
        outColor = vec4(pic * scan * vig * 1.15, 1.0);
        return;
    }
    else if (abs(mat - ${F(MAT.label)}) < 0.5)
    {
        // a name plate or a wall stencil: only its letters, floating; the emit slot says how strong
        vec4 t = texture(uAtlas, vUv);
        if (t.a < 0.35) discard;
        float fog = exp(-length(uEye - vPos) * 0.02);
        outColor = vec4(mix(uBg, t.rgb, t.a * vEmit * fog), 1.0);
        return;
    }
    else if (mat > ${F(MAT.hazard)} - 0.5)
    {
        // chevrons on the floor: diagonal stripes, framed
        float stripe = step(0.5, fract((vPos.x + vPos.z) / 0.7));
        albedo = 0.04 + 0.5 * stripe;
        bump = true;
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
        // people and Jones: silhouettes of light. The body is nearly black, so it hides what is behind it; the edges
        // of every box are traced in a thin line, the faces turned away glow at the rim, and scan lines climb it
        albedo = 0.03;
        emit = 0.04;
        vec3 view = normalize(uEye - vPos);
        float rim = pow(1.0 - abs(dot(n, view)), 2.5);
        vec2 e = min(vUv, 1.0 - vUv) / max(fwidth(vUv), vec2(1e-4));
        float edge = 1.0 - smoothstep(0.6, 1.6, min(e.x, e.y));
        float scan = step(0.6, fract(vPos.y * 14.0 - uTime * uHolo));
        extra = edge * 0.95 + rim * 0.55 + scan * 0.12 * (0.4 + rim);
        // a crew member whose app is busy blinks with the urgent monitors
        if (vEmit > 0.5) extra *= 0.35 + 1.3 * uBlink;
    }
    else
    {
        // door leaf: a panel with a bright seam round the edge
        albedo = 0.12 + 0.5 * panel(vUv, vec2(1.5, 1.3), 0.02);
    }

    // fake relief: the seams are grooves, so they catch the lamps at their edges
    if (bump)
    {
        vec3 sx = dFdx(vPos);
        vec3 sy = dFdy(vPos);
        vec3 r1 = cross(sy, n);
        vec3 r2 = cross(n, sx);
        float det = dot(sx, r1);
        vec3 grad = sign(det) * (dFdx(albedo * 0.012) * r1 + dFdy(albedo * 0.012) * r2);
        n = normalize(abs(det) * n - grad);
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
