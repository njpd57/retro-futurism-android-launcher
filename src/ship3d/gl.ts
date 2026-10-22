import { BLOOM_THRESHOLD, bloomSize, blurWeights } from './bloom';
import { BLUR_FRAGMENT, BRIGHT_FRAGMENT, COMPOSITE_FRAGMENT, FRAGMENT, QUAD_VERTEX, VERTEX } from './shaders';
import { STRIDE, type Mesh } from './mesh';
import { fovYFor, multiply, perspective, viewMatrix, type V3 } from './math';
import { MAX_LIGHTS } from './lights';
import { ATLAS_H, ATLAS_W } from './atlas';

/** Everything one frame needs. */
export interface GLFrame
{
    eye: V3;
    yaw: number;
    pitch: number;
    /** `vec4(x, up, y, power)` per light, `MAX_LIGHTS` of them */
    lights: Float32Array;
    /** seconds, for the little shimmer on the monitors */
    time: number;
    /** how open each doorway is, 0..1, in the order of `PORTALS` */
    doors: ArrayLike<number>;
    /** plan y of the scan band, anything far outside the ship for none */
    sweep: number;
    /** the urgent blink is on (busy crew lit, not dimmed) */
    blink?: boolean;
    /** how fast the crew's scan lines climb, 0 for still */
    holo?: number;
}

export interface Palette { ph: [number, number, number]; bg: [number, number, number] }

export interface ShipGL
{
    /** sizes the drawing buffer to the canvas at `scale` device pixels per CSS pixel; true when it changed */
    resize(scale: number): boolean;
    render(frame: GLFrame): void;
    setAtlas(source: HTMLCanvasElement): void;
    /** the people and Jones, rebuilt every frame: triangles in the same layout as the ship */
    setCrew(data: Float32Array): void;
    setPalette(p: Palette): void;
    /** how strongly the bright parts glow; 0 draws straight to the screen, as without bloom */
    setBloom(gain: number): void;
    /** the context was lost (the phone was busy elsewhere); frames are skipped until it comes back */
    readonly lost: boolean;
    dispose(): void;
}

const NEAR = 0.08;
const FAR = 90;

function compile(gl: WebGL2RenderingContext, type: number, source: string)
{
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
    return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string, names: string[])
{
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
    return { program, uniforms };
}

type Pass = ReturnType<typeof link>;

/** a texture to draw into, with its framebuffer */
interface Target { fbo: WebGLFramebuffer; tex: WebGLTexture }

/** the offscreen buffers of the bloom, sized to the canvas */
interface BloomBuffers
{
    w: number;
    h: number;
    /** multisampled frame, resolved into `scene`; null when the device has no multisampling */
    ms: { fbo: WebGLFramebuffer; color: WebGLRenderbuffer; depth: WebGLRenderbuffer } | null;
    scene: Target;
    /** depth for `scene` when there is no `ms` */
    depth: WebGLRenderbuffer | null;
    half: [Target, Target];
    hw: number;
    hh: number;
}

const WEIGHTS = blurWeights();
/** blur taps spaced a little more than a texel apart (the linear filter fills the gaps), for a wider halo */
const SPREAD = 1.5;

/** Null when the device has no WebGL2. */
export function createShipGL(canvas: HTMLCanvasElement, mesh: Mesh): ShipGL | null
{
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return null;

    let lost = false;
    let palette: Palette = { ph: [1, 0.69, 0], bg: [0.02, 0.015, 0] };
    let atlasSource: HTMLCanvasElement | null = null;
    let crewData = new Float32Array(0);

    // resources, rebuilt after a lost context
    let program: WebGLProgram;
    let vao: WebGLVertexArrayObject;
    let buffer: WebGLBuffer;
    let crewVao: WebGLVertexArrayObject;
    let crewBuffer: WebGLBuffer;
    let texture: WebGLTexture;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    let post: { bright: Pass; blur: Pass; composite: Pass } | null = null;
    let gain = 0;
    let bloom: BloomBuffers | null = null;
    // a device whose framebuffers won't complete just goes without bloom
    let bloomBroken = false;

    function build()
    {
        program = gl!.createProgram()!;
        gl!.attachShader(program, compile(gl!, gl!.VERTEX_SHADER, VERTEX));
        gl!.attachShader(program, compile(gl!, gl!.FRAGMENT_SHADER, FRAGMENT));
        gl!.linkProgram(program);
        if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error(gl!.getProgramInfoLog(program) ?? 'link failed');
        // the bloom passes are extra: if they don't build, the ship is drawn without them
        try
        {
            post = {
                bright: link(gl!, QUAD_VERTEX, BRIGHT_FRAGMENT, ['uSrc', 'uThreshold', 'uPh', 'uBg']),
                blur: link(gl!, QUAD_VERTEX, BLUR_FRAGMENT, ['uSrc', 'uStep', 'uWeights']),
                composite: link(gl!, QUAD_VERTEX, COMPOSITE_FRAGMENT, ['uScene', 'uBloom', 'uGain', 'uPh', 'uBg']),
            };
        }
        catch (e)
        {
            console.error('ship GL: bloom', e);
            post = null;
        }

        const layout: [string, number, number][] = [['aPos', 3, 0], ['aNormal', 3, 3], ['aUv', 2, 6], ['aMat', 1, 8], ['aEmit', 1, 9]];
        const attach = (buf: WebGLBuffer) =>
        {
            const v = gl!.createVertexArray()!;
            gl!.bindVertexArray(v);
            gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
            for (const [name, size, offset] of layout)
            {
                const at = gl!.getAttribLocation(program, name);
                gl!.enableVertexAttribArray(at);
                gl!.vertexAttribPointer(at, size, gl!.FLOAT, false, STRIDE * 4, offset * 4);
            }
            return v;
        };
        buffer = gl!.createBuffer()!;
        gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
        gl!.bufferData(gl!.ARRAY_BUFFER, mesh.data, gl!.STATIC_DRAW);
        vao = attach(buffer);
        crewBuffer = gl!.createBuffer()!;
        crewVao = attach(crewBuffer);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, crewBuffer);
        gl!.bufferData(gl!.ARRAY_BUFFER, crewData, gl!.DYNAMIC_DRAW);

        texture = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, ATLAS_W, ATLAS_H, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        const aniso = gl!.getExtension('EXT_texture_filter_anisotropic');
        if (aniso) gl!.texParameterf(gl!.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);

        uniforms = {};
        for (const name of ['uViewProj', 'uEye', 'uPh', 'uBg', 'uLights', 'uAtlas', 'uTime', 'uBlink', 'uHolo', 'uDoor', 'uSweep'])
            uniforms[name] = gl!.getUniformLocation(program, name);
        if (atlasSource) upload(atlasSource);
    }

    function upload(source: HTMLCanvasElement)
    {
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source);
        gl!.generateMipmap(gl!.TEXTURE_2D);
    }

    function target(w: number, h: number): Target
    {
        const tex = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D, tex);
        gl!.texStorage2D(gl!.TEXTURE_2D, 1, gl!.RGBA8, w, h);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        const fbo = gl!.createFramebuffer()!;
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
        gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0);
        return { fbo, tex };
    }

    function renderbuffer(samples: number, format: number, w: number, h: number)
    {
        const rb = gl!.createRenderbuffer()!;
        gl!.bindRenderbuffer(gl!.RENDERBUFFER, rb);
        if (samples > 0) gl!.renderbufferStorageMultisample(gl!.RENDERBUFFER, samples, format, w, h);
        else gl!.renderbufferStorage(gl!.RENDERBUFFER, format, w, h);
        return rb;
    }

    function freeBloom()
    {
        if (!bloom) return;
        if (!gl!.isContextLost())
        {
            if (bloom.ms)
            {
                gl!.deleteFramebuffer(bloom.ms.fbo);
                gl!.deleteRenderbuffer(bloom.ms.color);
                gl!.deleteRenderbuffer(bloom.ms.depth);
            }
            if (bloom.depth) gl!.deleteRenderbuffer(bloom.depth);
            for (const t of [bloom.scene, ...bloom.half])
            {
                gl!.deleteFramebuffer(t.fbo);
                gl!.deleteTexture(t.tex);
            }
        }
        bloom = null;
    }

    /** buffers for the canvas's current size, made the first time and again after a resize; false if they can't be */
    function ensureBloom(): boolean
    {
        const w = canvas.width;
        const h = canvas.height;
        if (bloom && bloom.w === w && bloom.h === h) return true;
        freeBloom();
        const complete = () => gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
        let ok = true;

        const samples = Math.min(4, gl!.getParameter(gl!.MAX_SAMPLES) as number);
        const scene = target(w, h);
        let depth: WebGLRenderbuffer | null = null;
        let ms: BloomBuffers['ms'] = null;
        if (samples > 0)
        {
            ok &&= complete();
            const color = renderbuffer(samples, gl!.RGBA8, w, h);
            const msDepth = renderbuffer(samples, gl!.DEPTH_COMPONENT24, w, h);
            const fbo = gl!.createFramebuffer()!;
            gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
            gl!.framebufferRenderbuffer(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.RENDERBUFFER, color);
            gl!.framebufferRenderbuffer(gl!.FRAMEBUFFER, gl!.DEPTH_ATTACHMENT, gl!.RENDERBUFFER, msDepth);
            ok &&= complete();
            ms = { fbo, color, depth: msDepth };
        }
        else
        {
            depth = renderbuffer(0, gl!.DEPTH_COMPONENT24, w, h);
            gl!.framebufferRenderbuffer(gl!.FRAMEBUFFER, gl!.DEPTH_ATTACHMENT, gl!.RENDERBUFFER, depth);
            ok &&= complete();
        }
        const [hw, hh] = bloomSize(w, h);
        const a = target(hw, hh);
        ok &&= complete();
        const b = target(hw, hh);
        ok &&= complete();

        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
        bloom = { w, h, ms, scene, depth, half: [a, b], hw, hh };
        if (!ok)
        {
            console.error('ship GL: bloom framebuffers incomplete, going without');
            freeBloom();
            bloomBroken = true;
        }
        return ok;
    }

    /** a full-screen pass from `src` into `into` (null for the screen) */
    function pass(p: Pass, into: WebGLFramebuffer | null, w: number, h: number, src: WebGLTexture)
    {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, into);
        gl!.viewport(0, 0, w, h);
        gl!.useProgram(p.program);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, src);
    }

    function draw() { gl!.drawArrays(gl!.TRIANGLES, 0, 3); }

    /** cut out the bright parts, blur them both ways at half size and add them over the frame on screen */
    function postBloom(b: BloomBuffers)
    {
        const { bright, blur, composite } = post!;
        if (b.ms)
        {
            gl!.bindFramebuffer(gl!.READ_FRAMEBUFFER, b.ms.fbo);
            gl!.bindFramebuffer(gl!.DRAW_FRAMEBUFFER, b.scene.fbo);
            gl!.blitFramebuffer(0, 0, b.w, b.h, 0, 0, b.w, b.h, gl!.COLOR_BUFFER_BIT, gl!.NEAREST);
            gl!.bindFramebuffer(gl!.READ_FRAMEBUFFER, null);
        }
        gl!.disable(gl!.DEPTH_TEST);
        gl!.bindVertexArray(null);

        pass(bright, b.half[0].fbo, b.hw, b.hh, b.scene.tex);
        gl!.uniform1i(bright.uniforms.uSrc, 0);
        gl!.uniform1f(bright.uniforms.uThreshold, BLOOM_THRESHOLD);
        gl!.uniform3fv(bright.uniforms.uPh, palette.ph);
        gl!.uniform3fv(bright.uniforms.uBg, palette.bg);
        draw();

        pass(blur, b.half[1].fbo, b.hw, b.hh, b.half[0].tex);
        gl!.uniform1i(blur.uniforms.uSrc, 0);
        gl!.uniform1fv(blur.uniforms.uWeights, WEIGHTS);
        gl!.uniform2f(blur.uniforms.uStep, SPREAD / b.hw, 0);
        draw();
        pass(blur, b.half[0].fbo, b.hw, b.hh, b.half[1].tex);
        gl!.uniform2f(blur.uniforms.uStep, 0, SPREAD / b.hh);
        draw();

        pass(composite, null, b.w, b.h, b.scene.tex);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, b.half[0].tex);
        gl!.uniform1i(composite.uniforms.uScene, 0);
        gl!.uniform1i(composite.uniforms.uBloom, 1);
        gl!.uniform1f(composite.uniforms.uGain, gain);
        gl!.uniform3fv(composite.uniforms.uPh, palette.ph);
        gl!.uniform3fv(composite.uniforms.uBg, palette.bg);
        draw();
        gl!.activeTexture(gl!.TEXTURE0);
    }

    // a lost context takes every buffer with it; they are made again on the next frame that wants them
    function onLost(e: Event) { e.preventDefault(); lost = true; bloom = null; }
    function onRestored() { build(); lost = false; }
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    try { build(); }
    catch (e)
    {
        console.error('ship GL', e);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        return null;
    }

    return {
        get lost() { return lost || gl.isContextLost(); },

        resize(scale)
        {
            const w = Math.max(1, Math.round(canvas.clientWidth * scale));
            const h = Math.max(1, Math.round(canvas.clientHeight * scale));
            if (canvas.width === w && canvas.height === h) return false;
            canvas.width = w;
            canvas.height = h;
            return true;
        },

        render(f)
        {
            if (lost || gl.isContextLost()) return;
            const glow = gain > 0 && post && !bloomBroken && ensureBloom() ? bloom : null;
            gl.bindFramebuffer(gl.FRAMEBUFFER, glow ? glow.ms?.fbo ?? glow.scene.fbo : null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(palette.bg[0], palette.bg[1], palette.bg[2], 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);

            const viewProj = multiply(perspective(fovYFor(canvas.width / canvas.height), canvas.width / canvas.height, NEAR, FAR), viewMatrix(f.eye, f.yaw, f.pitch));
            gl.useProgram(program);
            gl.bindVertexArray(vao);
            gl.uniformMatrix4fv(uniforms.uViewProj, false, viewProj);
            gl.uniform3f(uniforms.uEye, f.eye[0], f.eye[1], f.eye[2]);
            gl.uniform3fv(uniforms.uPh, palette.ph);
            gl.uniform3fv(uniforms.uBg, palette.bg);
            gl.uniform4fv(uniforms.uLights, f.lights.length === MAX_LIGHTS * 4 ? f.lights : new Float32Array(MAX_LIGHTS * 4));
            gl.uniform1f(uniforms.uTime, f.time);
            gl.uniform1f(uniforms.uBlink, f.blink ? 1 : 0);
            gl.uniform1f(uniforms.uHolo, f.holo ?? 0.6);
            gl.uniform1f(uniforms.uSweep, f.sweep);
            gl.uniform1fv(uniforms.uDoor, Float32Array.from({ length: 16 }, (_, i) => f.doors[i] ?? 0));
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(uniforms.uAtlas, 0);
            gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices);
            if (crewData.length)
            {
                gl.bindVertexArray(crewVao);
                gl.drawArrays(gl.TRIANGLES, 0, crewData.length / STRIDE);
            }
            if (glow) postBloom(glow);
        },

        setAtlas(source) { atlasSource = source; if (!lost) upload(source); },
        setCrew(data)
        {
            crewData = data;
            if (lost || gl.isContextLost()) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, crewBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        },
        setPalette(p) { palette = p; },
        setBloom(g)
        {
            gain = g > 0 ? g : 0;
            if (gain === 0) freeBloom();
        },

        dispose()
        {
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
            freeBloom();
            if (!gl.isContextLost())
            {
                if (post) for (const p of [post.bright, post.blur, post.composite]) gl.deleteProgram(p.program);
                gl.deleteProgram(program);
                gl.deleteBuffer(buffer);
                gl.deleteBuffer(crewBuffer);
                gl.deleteVertexArray(vao);
                gl.deleteVertexArray(crewVao);
                gl.deleteTexture(texture);
            }
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}
