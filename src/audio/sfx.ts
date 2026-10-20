import { getAudio, noiseBuffer } from './context';

export type SfxName = 'key' | 'select' | 'back' | 'alert' | 'ping' | 'tick' | 'step' | 'door' | 'hiss' | 'screech' | 'vent' | 'flame' | 'clatter'
    | 'pulse' | 'reload' | 'hurt' | 'kill' | 'dry' | 'shotgun' | 'smart' | 'burn' | 'launch' | 'blast' | 'acid' | 'rattle';

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
    // AISLAMIENTO: a boot on the deck plating, a pressure door, the creature breathing, the end, the ducts
    step: () => noise('lowpass', 260, 120, 5, 90, 0.5),
    door: () => { noise('bandpass', 1400, 260, 20, 520, 0.35); beep(90, 260, 'square', 0.05, 380); },
    hiss: () => noise('highpass', 2600, 5200, 380, 1100, 0.18),
    // something heavy moving in the ducts
    vent: () => { for (let i = 0; i < 4; i++) beep(55 + Math.random() * 30, 110, 'square', 0.07, i * 170 + Math.random() * 60); },
    // the flamethrower: a roar that opens up, with a low thump under it
    flame: () => { noise('lowpass', 500, 2400, 60, 700, 0.42); beep(70, 300, 'square', 0.08); },
    // a decoy rattling on the plating
    clatter: () => { for (let i = 0; i < 3; i++) beep(900 + Math.random() * 900, 25, 'square', 0.07, i * 55 + Math.random() * 30); },
    // MARINES: a burst round from the pulse rifle, a magazine out / in / bolt, a blow taken, a creature falling, a dry trigger
    pulse: () => { noise('bandpass', 2600, 900, 2, 45, 0.3); beep(150, 45, 'square', 0.07, 0, 60); },
    reload: () => { beep(480, 30, 'square', 0.1); beep(320, 40, 'square', 0.1, 60, 260); beep(700, 30, 'square', 0.1, 900); beep(520, 50, 'square', 0.12, 1450, 420); },
    hurt: () => { noise('lowpass', 420, 90, 4, 230, 0.55); beep(110, 200, 'sawtooth', 0.12, 0, 50); },
    kill: () => { noise('highpass', 3200, 700, 8, 280, 0.2); beep(1100, 240, 'sawtooth', 0.07, 0, 220); },
    dry: () => beep(260, 25, 'square', 0.1),
    // the extra weapons: a shotgun blast with its pump, the smartgun's fast chatter, a lick of flame, the launcher's thump and the burst
    shotgun: () => { noise('lowpass', 1400, 180, 2, 230, 0.8); beep(90, 170, 'sawtooth', 0.16, 0, 40); beep(300, 30, 'square', 0.08, 330, 220); beep(220, 40, 'square', 0.08, 430, 330); },
    smart: () => { noise('bandpass', 3400, 1500, 2, 30, 0.2); beep(210, 30, 'square', 0.05, 0, 120); },
    burn: () => noise('lowpass', 900, 2000, 12, 110, 0.26),
    launch: () => { beep(130, 160, 'square', 0.16, 0, 45); noise('lowpass', 800, 200, 3, 130, 0.4); },
    blast: () => { noise('lowpass', 1800, 70, 3, 650, 0.9); beep(65, 420, 'sawtooth', 0.2, 0, 28); },
    // acid on the floor and on the armour
    acid: () => { noise('highpass', 4200, 6500, 20, 170, 0.15); beep(1700, 60, 'sawtooth', 0.04, 0, 900); },
    // a marine's rifle, heard a little way off
    rattle: () => noise('bandpass', 1800, 700, 2, 35, 0.11),
    screech: () =>
    {
        beep(700, 900, 'sawtooth', 0.14, 0, 2600);
        beep(520, 900, 'sawtooth', 0.1, 40, 1900);
        noise('bandpass', 3000, 900, 30, 1000, 0.3);
    },
};

export function playSfx(name: SfxName) { SOUNDS[name](); }
