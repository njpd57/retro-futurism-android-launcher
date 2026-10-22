import { MAX_LIGHTS } from './lights';
import { BLUR_TAPS } from './bloom';
import { ATLAS_H, CELL_H, COLS } from './atlas';
import { MAX_MATERIALS, MAX_STYLES } from './materials';
import { MAT, MAT_STYLE, MAT_SURFACE } from './mesh';
import { DOOR } from './world';

/** A material number as a GLSL float literal. */
const F = (n: number) => n.toFixed(1);

/**
 * One tint only: everything is the phosphor colour, light and dark. Surfaces get a procedural panel pattern from their
 * uv (metres), the lamps and monitors light the rooms, and distance fades into the background like fog.
 */

/** Far plane in metres; the depth written for the outlines is the distance over this. */
export const FAR_PLANE = 90;

export const VERTEX = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNormal;
in vec2 aUv;
in float aMat;
in float aEmit;
// the occlusion and the lamp light baked into the vertex, and the way the light comes (see bake.ts)
in float aAo;
in float aLit;
in vec3 aDir;
uniform mat4 uViewProj;
uniform float uDoor[16];
out vec3 vPos;
out vec3 vNormal;
out vec2 vUv;
out float vMat;
out float vStyle;
out float vSurf;
out float vEmit;
out float vAo;
out float vLit;
out vec3 vDir;
void main()
{
    // the material number carries the room's surface style and, if the surface names one, its material: mat + 16 * style + 256 * (material + 1)
    float surf = floor(aMat / ${F(MAT_SURFACE)} + 0.01);
    float rest = aMat - surf * ${F(MAT_SURFACE)};
    float style = floor(rest / ${F(MAT_STYLE)} + 0.01);
    float mat = rest - style * ${F(MAT_STYLE)};
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
    vSurf = surf;
    vEmit = emit;
    vAo = aAo;
    vLit = aLit;
    vDir = aDir;
    gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
in float vMat;
in float vStyle;
in float vSurf;
in float vEmit;
in float vAo;
in float vLit;
in vec3 vDir;
uniform vec3 uEye;
uniform vec3 uPh;
uniform vec3 uBg;
uniform vec4 uLights[${MAX_LIGHTS}];
uniform sampler2D uAtlas;
// the detail textures, one layer each: brightness in red, the normal's x and y in green and blue; and what each
// material makes of them (see materials.ts)
uniform highp sampler2DArray uDetail;
uniform float uLayer[${MAX_MATERIALS}];
uniform float uTile[${MAX_MATERIALS}];
uniform float uStrength[${MAX_MATERIALS}];
uniform float uAlbedo[${MAX_MATERIALS}];
uniform float uShin[${MAX_MATERIALS}];
uniform float uKs[${MAX_MATERIALS}];
uniform float uStyled[${MAX_MATERIALS}];
// the material of each kind of surface, indexed by the kind's number
uniform float uKindMat[16];
// how bright a style's walls are
uniform float uStyleBase[${MAX_STYLES}];
uniform float uTime;
uniform float uBlink;
// how fast the crew's scan lines climb; 0 holds them still
uniform float uHolo;
// where the scan band is along the ship (plan y), or far away when it is off
uniform float uSweep;
// the map editor's plan view cuts everything above this height; far above the ship otherwise
uniform float uCut;
layout(location = 0) out vec4 outColor;
// for the outlines: the distance in three bytes and the kind of surface
layout(location = 1) out vec4 outNd;

vec3 pack24(float v)
{
    v = clamp(v, 0.0, 0.9999999);
    vec3 enc = fract(v * vec3(1.0, 255.0, 65025.0));
    enc -= enc.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
    return enc;
}

// the frame that takes a normal from texture space to the world, from the derivatives of the position and the uv;
// they are constant over a face, so unlike a pattern computed per pixel this does not shimmer
mat3 cotangentFrame(vec3 n, vec3 p, vec2 uv)
{
    vec3 dp1 = dFdx(p);
    vec3 dp2 = dFdy(p);
    vec2 duv1 = dFdx(uv);
    vec2 duv2 = dFdy(uv);
    vec3 dp2perp = cross(dp2, n);
    vec3 dp1perp = cross(n, dp1);
    vec3 t = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 b = dp2perp * duv1.y + dp1perp * duv2.y;
    float invmax = inversesqrt(max(max(dot(t, t), dot(b, b)), 1e-12));
    return mat3(t * invmax, b * invmax, n);
}

// the material a surface is made of: the one its vertices name, or the one of its kind
int materialOf(float mat)
{
    int named = int(vSurf + 0.5);
    return named > 0 ? named - 1 : int(uKindMat[int(mat + 0.5)] + 0.5);
}

// reads the material's detail texture: returns its brightness and bends \`n\` by its normal
float detail(int m, inout vec3 n)
{
    float tile = uTile[m];
    vec3 t = texture(uDetail, vec3(vUv / tile, uLayer[m])).rgb;
    vec2 xy = (t.gb * 2.0 - 1.0) * uStrength[m];
    vec3 tn = vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
    n = normalize(cotangentFrame(n, vPos, vUv / tile) * tn);
    return t.r * 2.0;
}

// the brightness, relief and shine of material \`m\`; a styled one is as bright as its room's style says
void surface(int m, int st, inout vec3 n, inout float albedo, inout float shin, inout float ks)
{
    float base = uStyled[m] > 0.5 ? uStyleBase[min(st, ${MAX_STYLES - 1})] : uAlbedo[m];
    albedo = base * detail(m, n);
    shin = uShin[m];
    ks = uKs[m];
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
    // how shiny the surface is: the sharpness of its highlight and its strength
    float shin = 8.0;
    float ks = 0.0;

    if (vPos.y > uCut) discard;

    // a door leaf slides up into the lintel: what has gone above the doorway is inside the wall, not in front of it
    if (abs(mat - ${F(MAT.door)}) < 0.5 && vPos.y > ${F(DOOR.height)}) discard;

    outNd = vec4(pack24((1.0 / gl_FragCoord.w) / ${F(FAR_PLANE)}), mat / 16.0);

    if (mat < ${F(MAT.wall)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks);
        albedo *= mix(0.6, 1.0, smoothstep(0.0, 0.6, vUv.y));
    }
    else if (mat < ${F(MAT.floor)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks);
    }
    else if (mat < ${F(MAT.ceiling)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks);
    }
    else if (mat < ${F(MAT.prop)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks);
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
        // the picture's own scan lines fade out as they get finer than a pixel, or they would crawl
        float amp = 0.06 * (1.0 - smoothstep(1.0, 3.0, fwidth(vUv.y * 900.0)));
        float scan = 1.0 - amp + amp * sin(vUv.y * 900.0 + uTime * 6.0);
        float vig = 1.0 - 0.4 * pow(max(abs(c.x), abs(c.y)), 4.0);
        outColor = vec4(pic * scan * vig * 1.15, 1.0);
        return;
    }
    else if (abs(mat - ${F(MAT.label)}) < 0.5)
    {
        // a name plate or a wall stencil: only its letters, floating; the emit slot says how strong
        vec4 t = texture(uAtlas, vUv);
        if (t.a < 0.35) discard;
        float fog = exp(-length(uEye - vPos) * 0.03);
        outColor = vec4(mix(uBg, t.rgb, t.a * vEmit * fog), 1.0);
        return;
    }
    else if (mat > ${F(MAT.hazard)} - 0.5)
    {
        // chevrons on the floor: diagonal stripes that melt into an even tone when they get finer than a pixel
        float t = (vPos.x + vPos.z) / 0.7;
        float s = abs(fract(t) - 0.5) * 2.0;
        float fw = fwidth(t) * 2.0;
        float stripe = mix(smoothstep(0.5 - fw, 0.5 + fw, s), 0.5, smoothstep(0.3, 0.6, fw));
        albedo = 0.05 + 0.2 * stripe;
        ks = 0.2;
    }
    else if (mat < ${F(MAT.glow)} + 0.5)
    {
        // things that shine: lamps, columns of light, capsules, engines
        albedo = 0.25;
        emit *= 0.85;
    }
    else if (mat < ${F(MAT.frame)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks);
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
        float climb = vPos.y * 14.0 - uTime * uHolo;
        float scan = smoothstep(0.55, 0.7, fract(climb)) * (1.0 - smoothstep(0.5, 1.5, fwidth(climb)));
        extra = edge * 0.95 + rim * 0.55 + scan * 0.12 * (0.4 + rim);
        // a crew member whose app is busy blinks with the urgent monitors
        if (vEmit > 0.5) extra *= 0.35 + 1.3 * uBlink;
    }
    else
    {
        // door leaf
        surface(materialOf(mat), st, n, albedo, shin, ks);
    }

    // light: what the lamps of the room gave this vertex, turned by the surface's own relief (the baked direction
    // makes a normal map answer to light that was never computed this frame), plus a share of the nearest lights of the
    // frame, which is what makes a room that wants attention shine brighter or blink
    vec3 view = normalize(uEye - vPos);
    float lit = 0.03 + vLit * (0.15 + 0.85 * max(dot(n, vDir), 0.0));
    float spec = vLit * pow(max(dot(n, normalize(vDir + view)), 0.0), shin);
    float live = 0.0;
    float liveSpec = 0.0;
    for (int i = 0; i < ${MAX_LIGHTS}; i++)
    {
        vec4 l = uLights[i];
        if (l.w <= 0.0) continue;
        vec3 to = l.xyz - vPos;
        float d2 = dot(to, to);
        vec3 ld = to * inversesqrt(d2);
        float att = l.w / (1.0 + 0.3 * d2);
        live += att * (max(dot(n, ld), 0.0) * 0.8 + 0.2);
        liveSpec += att * pow(max(dot(n, normalize(ld + view)), 0.0), shin);
    }
    lit += 0.4 * live;
    spec += 0.4 * liveSpec;

    // the baked occlusion darkens corners and the foot of everything
    float level = (albedo * lit * 4.0 + ks * spec * 0.5) * vAo + emit + extra;
    // the scan band: a soft line of light sweeping the length of the ship
    level += 0.2 * exp(-pow((vPos.z - uSweep) / 1.4, 2.0)) * smoothstep(0.0, 0.04, albedo);
    float dist = length(uEye - vPos);
    level *= exp(-dist * 0.03);
    level = 1.0 - exp(-level * 1.35);
    // a little contrast: the lit parts stand out and the corners go properly dark
    level = pow(level, 1.35);

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
    float l = levelOf(texelFetch(uScene, px, 0).rgb);
    float g = clamp(texture(uBloom, vUv).r * uGain, 0.0, 1.0);
    l = l + g * (1.0 - l);

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
    }

    // grain: noise that stays fixed on the glass, enough to break the banding of a smooth gradient
    l += (interleavedNoise(gl_FragCoord.xy) - 0.5) * uGrain;
    outColor = vec4(mix(uBg, uPh, clamp(l, 0.0, 1.0)), 1.0);
}`;
