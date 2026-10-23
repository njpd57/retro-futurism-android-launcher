import { MAT, MAT_STYLE, MAT_SURFACE } from '../mesh';
import { F } from './common';

/** The vertex stage: lifts the door leaves by how open each door is, and passes the material and its baked light on. */

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
