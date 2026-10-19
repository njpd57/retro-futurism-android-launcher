import { getAudio, noiseBuffer } from './context';

interface Running
{
    nodes: AudioScheduledSourceNode[];
    gain: GainNode;
    chirpTimer: number;
}

let running: Running | null = null;

/** Quiet terminal room tone: a low mains hum, filtered hiss and an occasional burst of data chirps. */
export function startAmbient()
{
    if (running) return;
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.8);
    gain.connect(out);

    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 55;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 160;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.25;
    hum.connect(humFilter).connect(humGain).connect(gain);

    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx);
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 3200;
    hissFilter.Q.value = 0.6;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.03;
    hiss.connect(hissFilter).connect(hissGain).connect(gain);

    hum.start();
    hiss.start();

    const chirp = () =>
    {
        const c = getAudio();
        if (c && running)
        {
            const count = 2 + Math.floor(Math.random() * 5);
            for (let i = 0; i < count; i++)
            {
                const osc = c.ctx.createOscillator();
                const g = c.ctx.createGain();
                const t = c.ctx.currentTime + i * 0.07;
                osc.type = 'square';
                osc.frequency.value = 900 + Math.floor(Math.random() * 8) * 220;
                g.gain.setValueAtTime(0.03, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                osc.connect(g).connect(running.gain);
                osc.start(t);
                osc.stop(t + 0.06);
            }
        }
        if (running) running.chirpTimer = window.setTimeout(chirp, 3000 + Math.random() * 9000);
    };

    running = { nodes: [hum, hiss], gain, chirpTimer: window.setTimeout(chirp, 2000) };
}

export function stopAmbient()
{
    if (!running) return;
    const { nodes, gain, chirpTimer } = running;
    running = null;
    window.clearTimeout(chirpTimer);

    const a = getAudio();
    if (a) gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.2);
    window.setTimeout(() =>
    {
        for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
        gain.disconnect();
    }, 1200);
}
