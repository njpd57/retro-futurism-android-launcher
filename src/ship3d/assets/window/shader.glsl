// The window onto space (asset `window`): the sky painted from the view ray alone, so the stars sit at infinity and
// never slide when you walk. The sky turns slowly (the ship rolls); every number comes from the plan (`asset.json`).
uniform float uSkyDrift;
uniform float uSkyDensity;
uniform vec4 uSkyPlanet;
uniform vec4 uSkyMoon;
uniform vec3 uSkySun;
uniform vec3 uSkyPlanetA;
uniform vec3 uSkyPlanetB;
uniform vec3 uSkyHalo;

vec3 shade_window()
{
    float t = shipTime();
    vec3 d = normalize(vPos - uEye);
    float ca = cos(t * uSkyDrift);
    float sa = sin(t * uSkyDrift);
    d = vec3(ca * d.x + sa * d.z, d.y, -sa * d.x + ca * d.z);

    // stars: some cells of a 3D lattice hold one, a soft point whose size follows the pixel
    vec3 p = d * 90.0;
    vec3 cell = floor(p);
    float h = hash12(cell.xy + cell.z * 57.0);
    float sky = 0.0;
    vec3 starColor = vec3(0.8, 0.88, 1.0);
    if (h > 1.0 - uSkyDensity)
    {
        vec3 at = cell + 0.3 + 0.4 * vec3(hash12(cell.yz + 3.1), hash12(cell.zx + 7.7), hash12(cell.xy + 11.3));
        float px = length(fwidth(p));
        float r = clamp(max(0.1 + 0.12 * fract(h * 37.0), px * 1.2), 0.0, 0.3);
        float core = smoothstep(r, 0.0, distance(p, at));
        // some blink, in steps, out of step with each other
        float tw = fract(h * 91.0) > 0.7 ? 0.45 + 0.55 * step(0.5, hash12(cell.xy + floor(t * 2.0 + h * 40.0))) : 1.0;
        sky = core * tw * (0.6 + 0.6 * fract(h * 13.0)) * min(1.0, 0.12 / r);
        starColor = mix(vec3(1.0, 0.86, 0.7), vec3(0.7, 0.82, 1.0), fract(h * 53.0));
    }
    vec3 col = starColor * sky;
    // a faint band of far stars across the sky
    col += vec3(0.05, 0.06, 0.09) * smoothstep(0.35, 0.0, abs(d.y * 0.8 + d.x * 0.6 - 0.05)) * (0.4 + 0.6 * valueNoise(d.xz * 14.0 + d.y * 9.0));

    // a planet, banded and lit from one side, with a haze at its edge, and a small grey moon
    vec3 pd = normalize(uSkyPlanet.xyz);
    float pr = uSkyPlanet.w;
    float pa = acos(clamp(dot(d, pd), -1.0, 1.0));
    if (pa < pr)
    {
        vec3 tx = normalize(cross(pd, vec3(0.0, 1.0, 0.0)));
        vec3 ty = cross(tx, pd);
        vec2 o = vec2(dot(d, tx), dot(d, ty)) / sin(pr);
        vec3 nrm = normalize(tx * o.x + ty * o.y + pd * sqrt(max(0.0, 1.0 - dot(o, o))));
        float band = 0.5 + 0.5 * sin(nrm.y * 16.0 + valueNoise(vec2(nrm.x * 3.0, nrm.y * 9.0)) * 3.0);
        vec3 surf = mix(uSkyPlanetA, uSkyPlanetB, band);
        float sun = max(dot(nrm, normalize(uSkySun)), 0.0);
        col = surf * (0.04 + 1.0 * sun) + uSkyHalo * 0.8 * pow(1.0 - dot(nrm, pd), 3.0) * sun * 0.4;
    }
    else col += uSkyHalo * exp(-(pa - pr) * 18.0) * 0.3;
    vec3 md = normalize(uSkyMoon.xyz);
    float ma = acos(clamp(dot(d, md), -1.0, 1.0));
    if (ma < uSkyMoon.w)
    {
        float shade = 0.55 + 0.45 * valueNoise(d.xy * 70.0) - 0.25 * valueNoise(d.xy * 190.0) + 0.5 * smoothstep(uSkyMoon.w, -0.02, ma - 0.01 * d.x * 4.0);
        col = vec3(0.55, 0.54, 0.52) * clamp(shade, 0.15, 1.0);
    }
    return monoTint(col);
}
