let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.5;

/** The shared AudioContext, created on first use (browsers only allow that after a user gesture). */
export function getAudio(): { ctx: AudioContext; out: GainNode } | null
{
    if (!ctx)
    {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);
    }
    return { ctx, out: master! };
}

export function setMasterVolume(v: number)
{
    volume = Math.min(1, Math.max(0, v));
    if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

export function resumeAudio() { void ctx?.resume(); }
export function suspendAudio() { void ctx?.suspend(); }

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
