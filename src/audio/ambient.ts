import { getAudio, noiseBuffer } from './context';

export type AmbientMood = 'calm' | 'alert';

interface Running
{
    nodes: AudioScheduledSourceNode[];
    gain: GainNode;
    hum: GainNode;
    throb: GainNode;
    timers: Set<number>;
}

let running: Running | null = null;
let level = 1;
let mood: AmbientMood = 'calm';

const HUM = { calm: 0.22, alert: 0.34 };
const PULSE = { calm: 0, alert: 0.12 };

/** Room tone of a ship's computer deck: a mains hum with a slow beat, air in the ducts, far relays, a sensor sweep and bursts of data. */
export function startAmbient()
{
    if (running) return;
    const a = getAudio('ambient');
    if (!a) return;
    const { ctx, out, reverb } = a;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.35 * level, ctx.currentTime, 0.8);
    gain.connect(out);

    // two hum oscillators a hair apart beat slowly; the pulse gain throbs when the ship is on alert
    const pulse = ctx.createGain();
    pulse.gain.value = 1;
    const hum = ctx.createGain();
    hum.gain.value = HUM[mood];
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 170;
    const h1 = ctx.createOscillator();
    h1.type = 'sawtooth';
    h1.frequency.value = 55;
    const h2 = ctx.createOscillator();
    h2.type = 'sine';
    h2.frequency.value = 110.7;
    h1.connect(humFilter);
    h2.connect(humFilter);
    humFilter.connect(hum).connect(pulse).connect(gain);

    // LFOs: the throb on alert, and the drift of the air
    const throb = ctx.createOscillator();
    throb.frequency.value = 1.1;
    const throbDepth = ctx.createGain();
    throbDepth.gain.value = PULSE[mood];
    throb.connect(throbDepth).connect(pulse.gain);

    // air in the ducts: low noise whose cutoff slowly breathes
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer(ctx);
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 420;
    airFilter.Q.value = 0.7;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.05;
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.07;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 180;
    drift.connect(driftDepth).connect(airFilter.frequency);
    air.connect(airFilter).connect(airGain).connect(gain);

    // fine hiss on top
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx);
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 3200;
    hissFilter.Q.value = 0.6;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.025;
    hiss.connect(hissFilter).connect(hissGain).connect(gain);

    const nodes: AudioScheduledSourceNode[] = [h1, h2, throb, air, drift, hiss];
    for (const n of nodes) n.start();

    const timers = new Set<number>();
    const later = (fn: () => void, min: number, spread: number) =>
    {
        const id = window.setTimeout(() =>
        {
            timers.delete(id);
            if (running) { fn(); later(fn, min, spread); }
        }, min + Math.random() * spread);
        timers.add(id);
    };

    // bursts of data chirps
    later(() =>
    {
        const count = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) tone(900 + Math.floor(Math.random() * 8) * 220, 0.05, 0.03, i * 0.07, 'square');
    }, 3000, 9000);

    // a relay closing somewhere else on the deck
    later(() =>
    {
        const c = getAudio('ambient');
        if (!c || !running) return;
        const src = c.ctx.createBufferSource();
        src.buffer = noiseBuffer(c.ctx);
        const f = c.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900 + Math.random() * 600;
        const g = c.ctx.createGain();
        const t = c.ctx.currentTime;
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(f).connect(g).connect(running.gain);
        g.connect(c.reverb);
        src.start(t, Math.random() * 0.5);
        src.stop(t + 0.06);
    }, 9000, 25000);

    // a slow sensor ping, low and far away
    later(() => tone(330 + Math.floor(Math.random() * 3) * 110, 0.35, 0.05, 0, 'sine', true), 14000, 30000);

    running = { nodes, gain, hum, throb: throbDepth, timers };

    function tone(freq: number, dur: number, vol: number, delay: number, type: OscillatorType, wet = false)
    {
        const c = getAudio('ambient');
        if (!c || !running) return;
        const osc = c.ctx.createOscillator();
        const g = c.ctx.createGain();
        const t = c.ctx.currentTime + delay;
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(running.gain);
        if (wet) g.connect(reverb);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }
}

/** 0..1 share of the ambient layers (the sound profile sets it). */
export function setAmbientLevel(v: number)
{
    level = Math.min(1, Math.max(0, v));
    const a = getAudio('ambient');
    if (running && a) running.gain.gain.setTargetAtTime(0.35 * level, a.ctx.currentTime, 0.3);
}

/** On alert the hum rises and throbs. */
export function setAmbientMood(m: AmbientMood)
{
    mood = m;
    const a = getAudio('ambient');
    if (!running || !a) return;
    running.hum.gain.setTargetAtTime(HUM[m], a.ctx.currentTime, 0.6);
    running.throb.gain.setTargetAtTime(PULSE[m], a.ctx.currentTime, 0.6);
}

export function stopAmbient()
{
    if (!running) return;
    const { nodes, gain, timers } = running;
    running = null;
    for (const id of timers) window.clearTimeout(id);

    const a = getAudio('ambient');
    if (a) gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.2);
    window.setTimeout(() =>
    {
        for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
        gain.disconnect();
    }, 1200);
}
