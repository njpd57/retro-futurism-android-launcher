import { getAudio, noiseBuffer } from './context';

export type SfxName = 'key' | 'select' | 'back' | 'alert' | 'ping' | 'tick' | 'step' | 'door' | 'hiss' | 'screech';

function beep(freq: number, ms: number, type: OscillatorType, gain: number, delayMs = 0, endFreq = freq)
{
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;

    const t = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + ms / 1000);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
}

/** A short filtered noise burst: a mechanical key click. */
function click()
{
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 1200;
    filter.Q.value = 1.5;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.05);
}

/** Filtered noise with an attack and a release, for the game: steps, doors, the creature. */
function noise(type: BiquadFilterType, freq: number, endFreq: number, attackMs: number, ms: number, gain: number)
{
    const a = getAudio();
    if (!a) return;
    const { ctx, out } = a;

    const t = ctx.currentTime;
    const end = t + ms / 1000;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(endFreq, end);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attackMs / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(end + 0.02);
}

const SOUNDS: Record<SfxName, () => void> = {
    key: click,
    select: () => beep(1200, 40, 'square', 0.12),
    back: () => beep(700, 50, 'square', 0.12, 0, 450),
    alert: () => { for (let i = 0; i < 3; i++) beep(1500, 120, 'square', 0.15, i * 220); },
    ping: () => beep(1900, 160, 'sine', 0.2, 0, 1400),
    // teletype chirp while MOTHER's answer streams in
    tick: () => beep(2200 + Math.random() * 600, 14, 'square', 0.06),
    // AISLAMIENTO: a boot on the deck plating, a pressure door, the creature breathing, the end
    step: () => noise('lowpass', 260, 120, 5, 90, 0.5),
    door: () => { noise('bandpass', 1400, 260, 20, 520, 0.35); beep(90, 260, 'square', 0.05, 380); },
    hiss: () => noise('highpass', 2600, 5200, 380, 1100, 0.18),
    screech: () =>
    {
        beep(700, 900, 'sawtooth', 0.14, 0, 2600);
        beep(520, 900, 'sawtooth', 0.1, 40, 1900);
        noise('bandpass', 3000, 900, 30, 1000, 0.3);
    },
};

export function playSfx(name: SfxName) { SOUNDS[name](); }
