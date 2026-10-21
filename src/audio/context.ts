export type Bus = 'ui' | 'ambient' | 'game';

interface Graph
{
    ctx: AudioContext;
    master: GainNode;
    buses: Record<Bus, GainNode>;
    reverb: GainNode;
}

let graph: Graph | null = null;
let volume = 0.5;
const busVolume: Record<Bus, number> = { ui: 1, ambient: 1, game: 1 };

/** A short, dark room: decaying noise, enough to put the sounds inside a metal corridor. */
function roomImpulse(ctx: AudioContext, seconds = 0.7)
{
    const length = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++)
    {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
    }
    return buf;
}

function build(): Graph | null
{
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();

    // master -> soft compressor (gunfire must not clip) -> speakers
    const master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(comp).connect(ctx.destination);

    const buses = {} as Record<Bus, GainNode>;
    for (const b of ['ui', 'ambient', 'game'] as Bus[])
    {
        buses[b] = ctx.createGain();
        buses[b].gain.value = busVolume[b];
        buses[b].connect(master);
    }

    // the reverb send: sounds connect to `reverb`, the wet signal returns to the master
    const reverb = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx);
    const wetFilter = ctx.createBiquadFilter();
    wetFilter.type = 'lowpass';
    wetFilter.frequency.value = 2400;
    reverb.connect(conv).connect(wetFilter).connect(master);

    return { ctx, master, buses, reverb };
}

/** The shared AudioContext, created on first use (browsers only allow that after a user gesture). */
export function getAudio(bus: Bus = 'ui'): { ctx: AudioContext; out: GainNode; reverb: GainNode } | null
{
    if (!graph) graph = build();
    if (!graph) return null;
    return { ctx: graph.ctx, out: graph.buses[bus], reverb: graph.reverb };
}

export function setMasterVolume(v: number)
{
    volume = Math.min(1, Math.max(0, v));
    if (graph) graph.master.gain.setTargetAtTime(volume, graph.ctx.currentTime, 0.02);
}

/** Volume of one channel (UI, ambient, games), 0..1, on top of the master. */
export function setBusVolume(bus: Bus, v: number)
{
    busVolume[bus] = Math.min(1, Math.max(0, v));
    if (graph) graph.buses[bus].gain.setTargetAtTime(busVolume[bus], graph.ctx.currentTime, 0.02);
}

export function resumeAudio() { void graph?.ctx.resume(); }
export function suspendAudio() { void graph?.ctx.suspend(); }

/** A second of white noise, shared by every sound that needs it. */
let noise: AudioBuffer | null = null;
export function noiseBuffer(c: AudioContext)
{
    if (!noise)
    {
        noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
}
