import { ASSET_SHADERS } from '../assets';
import { ATLAS_H, CELL_H, COLS } from '../atlas';
import { MAX_LIGHTS } from '../lights';
import { DETAIL_SIZE, MAX_MATERIALS, MAX_STYLES } from '../materials';
import { MAT, MAT_STYLE, MAT_SURFACE } from '../mesh';
import { DOOR } from '../world';
import { F, FAR_PLANE } from './common';

/**
 * The ship is in colour: each material has its own, lamps are warm white, and distance fades into the dark like fog.
 * The monitors and the crew are phosphor, one tint, as on every CRT on board; with `uMono` the whole ship is (the
 * FÓSFORO look, the luminance of the colour picture painted in the phosphor's tint). Each asset with a shader adds its
 * own branch (see `assets.ts`).
 */

/** The GLSL of every asset that brings a shader, and the `else if` that runs each for its material number. */
const ASSET_GLSL = ASSET_SHADERS.map(a => a.source).join('\n');
const ASSET_BRANCHES = ASSET_SHADERS.map(a => `else if (abs(mat - ${F(a.mat)}) < 0.5) { outColor = vec4(shade_${a.kind}(), 1.0); return; }`).join('\n    ');

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
uniform vec3 uColor[${MAX_MATERIALS}];
// 1 paints the whole ship in the phosphor's tint, 0 in colour
uniform float uMono;
// per style (one per kind of room): the colour of its styled walls, of its lamps' light, and how far the light has
// gone over to alarm red (0..1, blinking with the urgent rooms)
uniform vec3 uStyleColor[${MAX_STYLES}];
uniform vec3 uStyleLamp[${MAX_STYLES}];
uniform float uStyleAlert[${MAX_STYLES}];
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
// the ship's lamps follow the phone's brightness: 1 is full, lower dims what the lamps lit (not the lamps themselves)
uniform float uDim;
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

float hash12(vec2 p)
{
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

// smooth value noise, for the slow unevenness that keeps a wall of identical panels from looking printed
float valueNoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

// reads the material's detail texture: returns its brightness and bends \`n\` by its normal. Each repeat (one panel,
// one plate) is a touch lighter or darker than its neighbours, as real panels are, and the relief flattens where the
// texture gets finer than the pixels so it never shimmers
float detail(int m, inout vec3 n)
{
    vec2 uv = vUv / uTile[m];
    vec3 t = texture(uDetail, vec3(uv, uLayer[m])).rgb;
    vec2 fw = fwidth(uv) * ${F(DETAIL_SIZE)};
    float fine = 1.0 - 0.75 * smoothstep(2.0, 8.0, max(fw.x, fw.y));
    vec2 xy = (t.gb * 2.0 - 1.0) * uStrength[m] * fine;
    vec3 tn = vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
    n = normalize(cotangentFrame(n, vPos, uv) * tn);
    float panel = 0.95 + 0.1 * hash12(floor(uv) + float(m) * 17.0);
    return t.r * 2.0 * panel;
}

// the brightness, relief and shine of material \`m\`; a styled one is as bright as its room's style says
void surface(int m, int st, inout vec3 n, inout float albedo, inout float shin, inout float ks, inout vec3 color)
{
    bool styled = uStyled[m] > 0.5;
    color = styled ? uStyleColor[min(st, ${MAX_STYLES - 1})] : uColor[m];
    // a slow unevenness over the whole ship, so no two stretches of wall are quite the same
    float macro = valueNoise(vPos.xz * 0.35 + vPos.y * 0.5) * 0.6 + valueNoise(vPos.zx * 1.3 + vPos.y) * 0.4;
    color *= 0.93 + 0.1 * macro;
    float base = styled ? uStyleBase[min(st, ${MAX_STYLES - 1})] : uAlbedo[m];
    albedo = base * detail(m, n);
    shin = uShin[m];
    ks = uKs[m];
}

// what an asset's shader (assets/<kind>/shader.glsl) can use besides the varyings and uniforms above: the clock, which
// holds still under reduced motion (the sweep parked at -1000), and the colour turned into the one phosphor tint when
// the ship is shown in one
float shipTime()
{
    return uSweep < -500.0 ? 0.0 : uTime;
}

vec3 monoTint(vec3 col)
{
    if (uMono < 0.5) return clamp(col, 0.0, 1.0);
    return mix(uBg, uPh, clamp(dot(col, vec3(0.2126, 0.7152, 0.0722)) * 1.4, 0.0, 1.0));
}

${ASSET_GLSL}

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
    // the surface's own colour and the colour of what it gives off; people of light stay phosphor
    vec3 color = vec3(1.0);
    int sti = min(st, ${MAX_STYLES - 1});
    vec3 lampColor = mix(uStyleLamp[sti], vec3(1.0, 0.1, 0.06), uStyleAlert[sti]);
    vec3 glowColor = lampColor;
    bool phosphor = false;

    if (vPos.y > uCut) discard;

    // a door leaf slides up into the lintel: what has gone above the doorway is inside the wall, not in front of it
    if (abs(mat - ${F(MAT.door)}) < 0.5 && vPos.y > ${F(DOOR.height)}) discard;

    outNd = vec4(pack24((1.0 / gl_FragCoord.w) / ${F(FAR_PLANE)}), mat / 16.0);

    if (mat < ${F(MAT.wall)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
        albedo *= mix(0.6, 1.0, smoothstep(0.0, 0.6, vUv.y));
    }
    else if (mat < ${F(MAT.floor)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
    }
    else if (mat < ${F(MAT.ceiling)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
    }
    else if (mat < ${F(MAT.prop)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
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
        // in colour, what is painted on the ship is ink, not light: a stencil (emit 0.5) in dark paint, a printed sign
        // (0.75) in white; plates of light over the crew and the shuttles stay phosphor
        if (uMono < 0.5 && vEmit < 0.6) { outColor = vec4(vec3(0.16, 0.16, 0.15) * fog, 1.0); return; }
        if (uMono < 0.5 && vEmit < 0.9) { outColor = vec4(vec3(0.92, 0.9, 0.86) * fog, 1.0); return; }
        outColor = vec4(mix(uBg, t.rgb, t.a * vEmit * fog), 1.0);
        return;
    }
    ${ASSET_BRANCHES}
    else if (abs(mat - ${F(MAT.hazard)}) < 0.5)
    {
        // chevrons on the floor: diagonal stripes that melt into an even tone when they get finer than a pixel
        float t = (vPos.x + vPos.z) / 0.7;
        float s = abs(fract(t) - 0.5) * 2.0;
        float fw = fwidth(t) * 2.0;
        float stripe = mix(smoothstep(0.5 - fw, 0.5 + fw, s), 0.5, smoothstep(0.3, 0.6, fw));
        albedo = 0.25;
        color = mix(vec3(0.2), vec3(1.0, 0.72, 0.08), stripe);
        ks = 0.2;
    }
    else if (mat < ${F(MAT.glow)} + 0.5)
    {
        // things that shine: lamps, columns of light, capsules, engines
        albedo = 0.25;
        emit *= 0.85;
        // a light that names a material shines in its colour (a red pilot, an orange status cell)
        if (vSurf > 0.5) glowColor = uColor[int(vSurf + 0.5) - 1];
    }
    else if (mat < ${F(MAT.frame)} + 0.5)
    {
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
    }
    else if (mat < ${F(MAT.crew)} + 0.5)
    {
        // people and Jones: silhouettes of light. The body is nearly black, so it hides what is behind it; the edges
        // of every box are traced in a thin line, the faces turned away glow at the rim, and scan lines climb it
        phosphor = true;
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
        surface(materialOf(mat), st, n, albedo, shin, ks, color);
    }

    // light: what the lamps of the room gave this vertex, turned by the surface's own relief (the baked direction
    // makes a normal map answer to light that was never computed this frame), plus a share of the nearest lights of the
    // frame, which is what makes a room that wants attention shine brighter or blink
    vec3 view = normalize(uEye - vPos);
    float lit = 0.03 + uDim * vLit * (0.15 + 0.85 * max(dot(n, vDir), 0.0));
    float spec = uDim * vLit * pow(max(dot(n, normalize(vDir + view)), 0.0), shin);
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

    // one tint: white light on white surfaces, so the picture is the luminance the old phosphor look had
    bool oneTint = phosphor || uMono > 0.5;
    vec3 lamp = oneTint ? vec3(1.0) : lampColor;
    if (oneTint) { glowColor = vec3(1.0); color = vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))); }
    // the baked occlusion darkens corners and the foot of everything
    // in colour a light source is far brighter than the lit walls round it (they are pale too), so it reads as a light
    vec3 level = (albedo * color * lit * 4.0 + ks * spec * 0.5) * lamp * vAo + emit * glowColor * (oneTint ? 1.0 : 3.0) + extra;
    // the scan band: a soft line of light sweeping the length of the ship (a phosphor thing, not in colour)
    if (oneTint) level += 0.2 * exp(-pow((vPos.z - uSweep) / 1.4, 2.0)) * smoothstep(0.0, 0.04, albedo);
    float dist = length(uEye - vPos);
    level *= exp(-dist * 0.03);
    level = 1.0 - exp(-level * 1.35);
    // a little contrast: the lit parts stand out and the corners go properly dark
    level = pow(level, vec3(1.35));

    vec3 col = oneTint ? mix(uBg, tint, clamp(level.g, 0.0, 1.0)) : clamp(level, 0.0, 1.0);
    outColor = vec4(col, 1.0);
}`;
