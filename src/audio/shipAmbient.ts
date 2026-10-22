import { VOICES } from '../ship3d/acoustics';
import type { Heard } from '../ship3d/acoustics';
import type { Zone } from '../ship3d/world';
import { getAudio, noiseBuffer } from './context';

/** The ship's rooms humming, each from where it is: one voice per room, panned and softened by `acoustics.hear`. */

interface Voice { gain: GainNode; pan: StereoPannerNode; level: number }

interface Running { master: GainNode; voices: Map<Zone, Voice>; nodes: AudioScheduledSourceNode[] }

let running: Running | null = null;

/** Overall share of the voices next to the terminal hum. */
const MASTER = 0.55;

export const shipAmbientRunning = () => running !== null;

export function startShipAmbient()
{
    if (running) return;
    const a = getAudio('ambient');
    if (!a) return;
    const { ctx, out } = a;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.6);
    master.connect(out);

    const nodes: AudioScheduledSourceNode[] = [];
    const voices = new Map<Zone, Voice>();
    for (const [zone, v] of Object.entries(VOICES) as [Zone, (typeof VOICES)[Zone]][])
    {
        // tone and noise share one gain that breathes, then the voice's own gain and its place between the speakers
        const mix = ctx.createGain();
        mix.gain.value = v.wobble ? 1 - v.wobble.depth : 1;
        if (v.tone)
        {
            const osc = ctx.createOscillator();
            osc.type = v.tone.wave;
            osc.frequency.value = v.tone.freq;
            const g = ctx.createGain();
            g.gain.value = v.tone.gain;
            osc.connect(g).connect(mix);
            osc.start();
            nodes.push(osc);
        }
        if (v.hush)
        {
            const src = ctx.createBufferSource();
            src.buffer = noiseBuffer(ctx);
            src.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = v.hush.filter;
            f.frequency.value = v.hush.freq;
            f.Q.value = v.hush.q;
            const g = ctx.createGain();
            g.gain.value = v.hush.gain;
            src.connect(f).connect(g).connect(mix);
            src.start(0, Math.random() * 0.5);
            nodes.push(src);
        }
        if (v.wobble)
        {
            const lfo = ctx.createOscillator();
            lfo.frequency.value = v.wobble.hz;
            const depth = ctx.createGain();
            depth.gain.value = v.wobble.depth;
            lfo.connect(depth).connect(mix.gain);
            lfo.start();
            nodes.push(lfo);
        }
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        mix.connect(gain).connect(pan).connect(master);
        voices.set(zone, { gain, pan, level: v.level });
    }
    running = { master, voices, nodes };
}

/** Sets what each voice is heard at: its loudness and side. */
export function updateShipAmbient(heard: Readonly<Record<Zone, Heard>>)
{
    const a = getAudio('ambient');
    if (!running || !a) return;
    const t = a.ctx.currentTime;
    for (const [zone, v] of running.voices)
    {
        const h = heard[zone];
        v.gain.gain.setTargetAtTime(h.gain < 0.01 ? 0 : v.level * h.gain, t, 0.15);
        v.pan.pan.setTargetAtTime(h.pan, t, 0.15);
    }
}

export function stopShipAmbient()
{
    if (!running) return;
    const { master, nodes } = running;
    running = null;
    const a = getAudio('ambient');
    if (a) master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.15);
    window.setTimeout(() =>
    {
        for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
        master.disconnect();
    }, 900);
}
