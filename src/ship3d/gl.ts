import { BLOOM_THRESHOLD, bloomSize, blurWeights } from './bloom';
import { BLUR_FRAGMENT, BRIGHT_FRAGMENT, COMPOSITE_FRAGMENT, FRAGMENT, QUAD_VERTEX, VERTEX } from './shaders';
import { STRIDE, type Mesh } from './mesh';
import { fovYFor, multiply, perspective, topDown, viewMatrix, type V3 } from './math';
import { MAX_LIGHTS } from './lights';
import { ATLAS_H, ATLAS_W } from './atlas';
import { FAR_PLANE } from './shaders';
import { DETAIL_SIZE, MAX_STYLES, packMaterialUniforms, type MaterialUniforms } from './materials';

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
    /** strength of the outlines, 0 for none (default 1) */
    edge?: number;
    /** amount of grain over the picture, 0 for none (default 0.04) */
    grain?: number;
    /** per style (kind of room), 0..1 how red its light has turned: an urgent room's alarm */
    alerts?: ArrayLike<number>;
    /** false paints the ship in the phosphor's one tint; in colour otherwise (the monitors and the crew are phosphor either way) */
    color?: boolean;
    /** the map editor's plan view: straight down on `(x, y)`, `half` metres to the top edge, everything above `cut` metres removed */
    top?: { x: number; y: number; half: number; cut: number };
}

export interface Palette { ph: [number, number, number]; bg: [number, number, number] }

/** Black, and white: what the glow pass measures brightness between when the picture is in colour. */
const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [1, 1, 1];

/** Texture unit of the detail textures (one array, a layer each) in the scene pass (0 is the monitors' atlas). */
const DETAIL_UNIT = 1;

export interface ShipGL
{
    /** sizes the drawing buffer to the canvas at `scale` device pixels per CSS pixel; true when it changed */
    resize(scale: number): boolean;
    render(frame: GLFrame): void;
    setAtlas(source: HTMLCanvasElement): void;
    /** swaps the ship's triangles (the map editor rebuilt them) */
    setMesh(mesh: Mesh): void;
    /** the picture of layer `layer` of the detail textures: brightness, and the normal's x and y (see `scripts/pack_ship_textures.py`) */
    setMaterialTexture(layer: number, source: TexImageSource): void;
    /** what each material makes of its texture, and how many layers there are; the table the module `materials.ts` holds is used until this is called */
    setMaterials(uniforms: MaterialUniforms): void;
    /** the people and Jones, rebuilt every frame: triangles in the same layout as the ship */
    setCrew(data: Float32Array): void;
    setPalette(p: Palette): void;
    /** how strongly the bright parts glow; 0 skips the glow passes */
    setBloom(gain: number): void;
    /** the context was lost (the phone was busy elsewhere); frames are skipped until it comes back */
    readonly lost: boolean;
    dispose(): void;
}

const NEAR = 0.08;

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

/** The frame is drawn here first: the picture, and the distance of every pixel for the outlines. */
interface Scene
{
    w: number;
    h: number;
    fbo: WebGLFramebuffer;
    color: WebGLTexture;
    nd: WebGLTexture;
    depth: WebGLRenderbuffer;
}

/** The half-size buffers of the glow. */
interface Glow { w: number; h: number; half: [Target, Target]; hw: number; hh: number }

const WEIGHTS = blurWeights();
/** blur taps spaced a little more than a texel apart (the linear filter fills the gaps), for a wider halo */
const SPREAD = 1.5;

/** Null when the device has no WebGL2. */
export function createShipGL(canvas: HTMLCanvasElement, initialMesh: Mesh): ShipGL | null
{
    let mesh = initialMesh;
    // no multisampling: the scene is drawn into our own buffers at the canvas size, which is already twice the CSS size
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return null;

    let lost = false;
    let palette: Palette = { ph: [1, 0.69, 0], bg: [0.02, 0.015, 0] };
    let atlasSource: HTMLCanvasElement | null = null;
    const layerSources = new Map<number, TexImageSource>();
    let materialUniforms: MaterialUniforms = packMaterialUniforms();
    let layers = 0;
    let crewData = new Float32Array(0);

    // resources, rebuilt after a lost context
    let program: WebGLProgram;
    let vao: WebGLVertexArrayObject;
    let buffer: WebGLBuffer;
    let crewVao: WebGLVertexArrayObject;
    let crewBuffer: WebGLBuffer;
    let texture: WebGLTexture;
    let details: WebGLTexture;
    let black: WebGLTexture;
    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    let post: { bright: Pass; blur: Pass; composite: Pass } | null = null;
    let gain = 0;
    let scene: Scene | null = null;
    let glow: Glow | null = null;
    // a device whose framebuffers won't complete just draws straight to the screen, without outlines
    let sceneBroken = false;
    let glowBroken = false;

    const anisotropy = () => gl!.getExtension('EXT_texture_filter_anisotropic');

    /** a texture with mipmaps, repeating, filtered as sharply as the device allows */
    function surfaceTexture(wrap: number, aniso: number): WebGLTexture
    {
        const t = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D, t);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, wrap);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, wrap);
        const ext = anisotropy();
        if (ext) gl!.texParameterf(gl!.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, aniso);
        return t;
    }

    function build()
    {
        program = gl!.createProgram()!;
        gl!.attachShader(program, compile(gl!, gl!.VERTEX_SHADER, VERTEX));
        gl!.attachShader(program, compile(gl!, gl!.FRAGMENT_SHADER, FRAGMENT));
        gl!.linkProgram(program);
        if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) throw new Error(gl!.getProgramInfoLog(program) ?? 'link failed');
        // the post passes are extra: if they don't build, the ship is drawn straight to the screen
        try
        {
            post = {
                bright: link(gl!, QUAD_VERTEX, BRIGHT_FRAGMENT, ['uSrc', 'uThreshold', 'uPh', 'uBg']),
                blur: link(gl!, QUAD_VERTEX, BLUR_FRAGMENT, ['uSrc', 'uStep', 'uWeights']),
                composite: link(gl!, QUAD_VERTEX, COMPOSITE_FRAGMENT, ['uScene', 'uNd', 'uBloom', 'uGain', 'uTexel', 'uEdge', 'uGrain', 'uPh', 'uBg', 'uMono']),
            };
        }
        catch (e)
        {
            console.error('ship GL: post', e);
            post = null;
        }

        const layout: [string, number, number][] = [['aPos', 3, 0], ['aNormal', 3, 3], ['aUv', 2, 6], ['aMat', 1, 8], ['aEmit', 1, 9], ['aAo', 1, 10], ['aLit', 1, 11], ['aDir', 3, 12]];
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

        texture = surfaceTexture(gl!.CLAMP_TO_EDGE, 4);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, ATLAS_W, ATLAS_H, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);

        allocateDetails(materialUniforms.layers);

        black = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D, black);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 1, 1, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);

        uniforms = {};
        for (const name of ['uViewProj', 'uEye', 'uPh', 'uBg', 'uLights', 'uAtlas', 'uTime', 'uBlink', 'uHolo', 'uDoor', 'uSweep', 'uCut', 'uDetail', 'uLayer', 'uTile', 'uStrength', 'uAlbedo', 'uShin', 'uKs', 'uStyled', 'uKindMat', 'uStyleBase', 'uColor', 'uMono', 'uStyleColor', 'uStyleLamp', 'uStyleAlert'])
            uniforms[name] = gl!.getUniformLocation(program, name);
        if (atlasSource) upload(atlasSource);
        for (const [layer, src] of layerSources) uploadLayer(layer, src);
    }

    function upload(source: HTMLCanvasElement)
    {
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, source);
        gl!.generateMipmap(gl!.TEXTURE_2D);
    }

    /** The array of detail textures with `n` layers, flat average brightness until a picture arrives (0.5 is "as bright as average"). */
    function allocateDetails(n: number)
    {
        const old = details;
        details = gl!.createTexture()!;
        gl!.bindTexture(gl!.TEXTURE_2D_ARRAY, details);
        gl!.texParameteri(gl!.TEXTURE_2D_ARRAY, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D_ARRAY, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D_ARRAY, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
        gl!.texParameteri(gl!.TEXTURE_2D_ARRAY, gl!.TEXTURE_WRAP_T, gl!.REPEAT);
        const ext = anisotropy();
        if (ext) gl!.texParameterf(gl!.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
        gl!.texImage3D(gl!.TEXTURE_2D_ARRAY, 0, gl!.RGB8, DETAIL_SIZE, DETAIL_SIZE, n, 0, gl!.RGB, gl!.UNSIGNED_BYTE,
            new Uint8Array(DETAIL_SIZE * DETAIL_SIZE * 3 * n).fill(128));
        gl!.generateMipmap(gl!.TEXTURE_2D_ARRAY);
        layers = n;
        if (old && old !== details) gl!.deleteTexture(old);
    }

    let resampler: HTMLCanvasElement | null = null;

    function uploadLayer(layer: number, source: TexImageSource)
    {
        if (layer < 0 || layer >= layers) return;
        let src = source;
        const w = (source as { width?: number }).width ?? DETAIL_SIZE;
        const h = (source as { height?: number }).height ?? DETAIL_SIZE;
        if (w !== DETAIL_SIZE || h !== DETAIL_SIZE)
        {
            // the array's layers are one size: bring a picture of another size to it
            resampler ??= document.createElement('canvas');
            resampler.width = resampler.height = DETAIL_SIZE;
            resampler.getContext('2d')!.drawImage(source as CanvasImageSource, 0, 0, DETAIL_SIZE, DETAIL_SIZE);
            src = resampler;
        }
        gl!.bindTexture(gl!.TEXTURE_2D_ARRAY, details);
        // the picture holds data, not colour: no premultiplying, no colour conversion
        gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl!.pixelStorei(gl!.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl!.NONE);
        gl!.texSubImage3D(gl!.TEXTURE_2D_ARRAY, 0, 0, 0, layer, DETAIL_SIZE, DETAIL_SIZE, 1, gl!.RGB, gl!.UNSIGNED_BYTE, src);
        gl!.pixelStorei(gl!.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl!.BROWSER_DEFAULT_WEBGL);
        gl!.generateMipmap(gl!.TEXTURE_2D_ARRAY);
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

    function freeScene()
    {
        if (!scene) return;
        if (!gl!.isContextLost())
        {
            gl!.deleteFramebuffer(scene.fbo);
            gl!.deleteTexture(scene.color);
            gl!.deleteTexture(scene.nd);
            gl!.deleteRenderbuffer(scene.depth);
        }
        scene = null;
    }

    function freeGlow()
    {
        if (!glow) return;
        if (!gl!.isContextLost())
            for (const t of glow.half)
            {
                gl!.deleteFramebuffer(t.fbo);
                gl!.deleteTexture(t.tex);
            }
        glow = null;
    }

    /** the scene buffers for the canvas's current size, made the first time and again after a resize; false if they can't be */
    function ensureScene(): boolean
    {
        const w = canvas.width;
        const h = canvas.height;
        if (scene && scene.w === w && scene.h === h) return true;
        freeScene();

        const make = () =>
        {
            const t = gl!.createTexture()!;
            gl!.bindTexture(gl!.TEXTURE_2D, t);
            gl!.texStorage2D(gl!.TEXTURE_2D, 1, gl!.RGBA8, w, h);
            // sampled at exactly one texel per pixel: the outlines need the true neighbours, not a blend
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
            gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
            return t;
        };
        const color = make();
        const nd = make();
        const depth = gl!.createRenderbuffer()!;
        gl!.bindRenderbuffer(gl!.RENDERBUFFER, depth);
        gl!.renderbufferStorage(gl!.RENDERBUFFER, gl!.DEPTH_COMPONENT24, w, h);
        const fbo = gl!.createFramebuffer()!;
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
        gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, color, 0);
        gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT1, gl!.TEXTURE_2D, nd, 0);
        gl!.framebufferRenderbuffer(gl!.FRAMEBUFFER, gl!.DEPTH_ATTACHMENT, gl!.RENDERBUFFER, depth);
        gl!.drawBuffers([gl!.COLOR_ATTACHMENT0, gl!.COLOR_ATTACHMENT1]);
        const ok = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
        scene = { w, h, fbo, color, nd, depth };
        if (!ok)
        {
            console.error('ship GL: scene framebuffer incomplete, drawing straight to the screen');
            freeScene();
            sceneBroken = true;
        }
        return ok;
    }

    /** the half-size buffers of the glow; false if they can't be made */
    function ensureGlow(): boolean
    {
        const w = canvas.width;
        const h = canvas.height;
        if (glow && glow.w === w && glow.h === h) return true;
        freeGlow();
        const [hw, hh] = bloomSize(w, h);
        const a = target(hw, hh);
        const aOk = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
        const b = target(hw, hh);
        const bOk = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) === gl!.FRAMEBUFFER_COMPLETE;
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
        glow = { w, h, half: [a, b], hw, hh };
        if (!aOk || !bOk)
        {
            console.error('ship GL: glow framebuffers incomplete, going without');
            freeGlow();
            glowBroken = true;
            return false;
        }
        return true;
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

    /** cut out the bright parts of the scene, blur them both ways at half size; the result is in `glow.half[0]` */
    function glowPasses(s: Scene, g: Glow, mono: boolean)
    {
        const { bright, blur } = post!;
        pass(bright, g.half[0].fbo, g.hw, g.hh, s.color);
        gl!.uniform1i(bright.uniforms.uSrc, 0);
        gl!.uniform1f(bright.uniforms.uThreshold, BLOOM_THRESHOLD);
        gl!.uniform3fv(bright.uniforms.uPh, mono ? palette.ph : WHITE);
        gl!.uniform3fv(bright.uniforms.uBg, mono ? palette.bg : BLACK);
        draw();

        pass(blur, g.half[1].fbo, g.hw, g.hh, g.half[0].tex);
        gl!.uniform1i(blur.uniforms.uSrc, 0);
        gl!.uniform1fv(blur.uniforms.uWeights, WEIGHTS);
        gl!.uniform2f(blur.uniforms.uStep, SPREAD / g.hw, 0);
        draw();
        pass(blur, g.half[0].fbo, g.hw, g.hh, g.half[1].tex);
        gl!.uniform2f(blur.uniforms.uStep, 0, SPREAD / g.hh);
        draw();
    }

    /** the scene, its outlines, its glow and its grain onto the screen */
    function composite(s: Scene, g: Glow | null, f: GLFrame)
    {
        const { composite: c } = post!;
        gl!.disable(gl!.DEPTH_TEST);
        gl!.bindVertexArray(null);
        const mono = f.color === false;
        if (g) glowPasses(s, g, mono);

        pass(c, null, s.w, s.h, s.color);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, s.nd);
        gl!.activeTexture(gl!.TEXTURE2);
        gl!.bindTexture(gl!.TEXTURE_2D, g ? g.half[0].tex : black);
        gl!.uniform1i(c.uniforms.uScene, 0);
        gl!.uniform1i(c.uniforms.uNd, 1);
        gl!.uniform1i(c.uniforms.uBloom, 2);
        gl!.uniform1f(c.uniforms.uGain, g ? gain : 0);
        gl!.uniform2f(c.uniforms.uTexel, 1 / s.w, 1 / s.h);
        gl!.uniform1f(c.uniforms.uEdge, f.edge ?? 1);
        gl!.uniform1f(c.uniforms.uGrain, f.grain ?? 0.04);
        gl!.uniform3fv(c.uniforms.uPh, palette.ph);
        gl!.uniform3fv(c.uniforms.uBg, palette.bg);
        gl!.uniform1f(c.uniforms.uMono, mono ? 1 : 0);
        draw();
        gl!.activeTexture(gl!.TEXTURE0);
    }

    // a lost context takes every buffer with it; they are made again on the next frame that wants them
    function onLost(e: Event) { e.preventDefault(); lost = true; scene = null; glow = null; }
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
            const target = post && !sceneBroken && ensureScene() ? scene : null;
            const g = target && gain > 0 && !glowBroken && ensureGlow() ? glow : null;

            if (target)
            {
                gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
                gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.clearBufferfv(gl.COLOR, 0, [palette.bg[0], palette.bg[1], palette.bg[2], 1]);
                // beyond the far plane, and no kind of surface
                gl.clearBufferfv(gl.COLOR, 1, [1, 1, 1, 0]);
                gl.clearBufferfv(gl.DEPTH, 0, [1]);
            }
            else
            {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.clearColor(palette.bg[0], palette.bg[1], palette.bg[2], 1);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            }
            gl.enable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);

            const aspect = canvas.width / canvas.height;
            const viewProj = f.top
                ? topDown(f.top.x, f.top.y, f.top.half, aspect, 100, 200)
                : multiply(perspective(fovYFor(aspect), aspect, NEAR, FAR_PLANE), viewMatrix(f.eye, f.yaw, f.pitch));
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
            gl.uniform1f(uniforms.uCut, f.top ? f.top.cut : 1e4);
            gl.uniform1fv(uniforms.uDoor, Float32Array.from({ length: 16 }, (_, i) => f.doors[i] ?? 0));
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(uniforms.uAtlas, 0);
            gl.activeTexture(gl.TEXTURE0 + DETAIL_UNIT);
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, details);
            gl.uniform1i(uniforms.uDetail, DETAIL_UNIT);
            const mu = materialUniforms;
            gl.uniform1fv(uniforms.uLayer, mu.layer);
            gl.uniform1fv(uniforms.uTile, mu.tile);
            gl.uniform1fv(uniforms.uStrength, mu.strength);
            gl.uniform1fv(uniforms.uAlbedo, mu.albedo);
            gl.uniform1fv(uniforms.uShin, mu.shin);
            gl.uniform1fv(uniforms.uKs, mu.ks);
            gl.uniform1fv(uniforms.uStyled, mu.styled);
            gl.uniform1fv(uniforms.uKindMat, mu.kind);
            gl.uniform1fv(uniforms.uStyleBase, mu.style);
            gl.uniform3fv(uniforms.uColor, mu.color);
            gl.uniform1f(uniforms.uMono, f.color === false ? 1 : 0);
            gl.uniform3fv(uniforms.uStyleColor, mu.styleColor);
            gl.uniform3fv(uniforms.uStyleLamp, mu.styleLamp);
            gl.uniform1fv(uniforms.uStyleAlert, Float32Array.from({ length: MAX_STYLES }, (_, i) => f.alerts?.[i] ?? 0));
            gl.activeTexture(gl.TEXTURE0);
            gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices);
            if (crewData.length)
            {
                gl.bindVertexArray(crewVao);
                gl.drawArrays(gl.TRIANGLES, 0, crewData.length / STRIDE);
            }
            if (target) composite(target, g, f);
            else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        },

        setAtlas(source) { atlasSource = source; if (!lost) upload(source); },
        setMesh(next)
        {
            mesh = next;
            if (lost || gl.isContextLost()) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
        },
        setMaterialTexture(layer, source) { layerSources.set(layer, source); if (!lost) uploadLayer(layer, source); },
        setMaterials(uniforms)
        {
            materialUniforms = uniforms;
            if (lost || gl.isContextLost() || uniforms.layers === layers) return;
            // more or fewer layers: a new array, with the pictures that are known put back
            allocateDetails(uniforms.layers);
            for (const [layer, src] of layerSources) uploadLayer(layer, src);
        },
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
            if (gain === 0) freeGlow();
        },

        dispose()
        {
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
            freeScene();
            freeGlow();
            if (!gl.isContextLost())
            {
                if (post) for (const p of [post.bright, post.blur, post.composite]) gl.deleteProgram(p.program);
                gl.deleteProgram(program);
                gl.deleteBuffer(buffer);
                gl.deleteBuffer(crewBuffer);
                gl.deleteVertexArray(vao);
                gl.deleteVertexArray(crewVao);
                gl.deleteTexture(texture);
                gl.deleteTexture(black);
                gl.deleteTexture(details);
            }
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        },
    };
}
