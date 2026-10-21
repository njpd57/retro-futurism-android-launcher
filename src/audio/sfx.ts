import { getAudio, noiseBuffer, type Bus } from './context';
import { currentGain } from './mix';
import { PROFILES, profileAllows, type SoundProfile } from './profiles';

export type SfxName = 'key' | 'select' | 'back' | 'alert' | 'ping' | 'tick' | 'step' | 'door' | 'hiss' | 'screech' | 'vent' | 'flame' | 'clatter'
    | 'pulse' | 'reload' | 'hurt' | 'kill' | 'dry' | 'shotgun' | 'smart' | 'burn' | 'launch' | 'blast' | 'acid' | 'rattle'
    | 'thunk' | 'klaxon' | 'chirp'
    | 'open' | 'close' | 'tab' | 'minimize' | 'error' | 'deny' | 'confirm' | 'toggleOn' | 'toggleOff'
    | 'notify' | 'notifyCall' | 'notifySys' | 'boot' | 'powerOff' | 'powerOn' | 'relay';

/** Which channel each sound belongs to; the games and the tube-sized sounds have their own volume. */
const GAME_SOUNDS: readonly SfxName[] = ['step', 'door', 'hiss', 'screech', 'vent', 'flame', 'clatter', 'pulse', 'reload', 'hurt', 'kill', 'dry',
    'shotgun', 'smart', 'burn', 'launch', 'blast', 'acid', 'rattle'];

export function busOf(name: SfxName): Bus
{
    return GAME_SOUNDS.includes(name) ? 'game' : 'ui';
}

// the sound being played right now: set by playSfx, read by the primitives (everything is scheduled synchronously)
let bus: Bus = 'ui';
// the user's level for that sound (see mix.ts)
let soundGain = 1;
let profile: SoundProfile = PROFILES.terminal;

export function setProfile(p: SoundProfile) { profile = p; }

interface Opts
{
    /** Send to the room reverb, 0..1. */
    wet?: number;
    /** Seconds of attack; 0 = instant. */
    attack?: number;
}

function connectOut(a: NonNullable<ReturnType<typeof getAudio>>, node: AudioNode, wet = 0)
{
    let dest: AudioNode = a.out;
    if (soundGain !== 1)
    {
        const mix = a.ctx.createGain();
        mix.gain.value = soundGain;
        mix.connect(a.out);
        dest = mix;
    }
    node.connect(dest);
    if (wet > 0)
    {
        const send = a.ctx.createGain();
        send.gain.value = wet * soundGain;
        node.connect(send).connect(a.reverb);
    }
}

function beep(freq: number, ms: number, type: OscillatorType, gain: number, delayMs = 0, endFreq = freq, opts: Opts = {})
{
    const a = getAudio(bus);
    if (!a) return;
    const { ctx } = a;
    const ui = bus === 'ui';

    const pitch = ui ? profile.pitch : 1;
    const t = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = ui && profile.wave && type === 'square' ? profile.wave : type;
    osc.frequency.setValueAtTime(freq * pitch, t);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq * pitch, t + ms / 1000);

    const peak = gain * (ui ? profile.level : 1);
    if (opts.attack)
    {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + opts.attack);
    }
    else g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);

    let node: AudioNode = osc;
    if (ui && profile.cutoff)
    {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = profile.cutoff;
        node = osc.connect(f);
    }
    node.connect(g);
    connectOut(a, g, opts.wet);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
}

/** Filtered noise with an attack and a release: steps, doors, the creature, and the mechanical parts of the UI. */
function noise(type: BiquadFilterType, freq: number, endFreq: number, attackMs: number, ms: number, gain: number, delayMs = 0, opts: Opts = {})
{
    const a = getAudio(bus);
    if (!a) return;
    const { ctx } = a;

    const t = ctx.currentTime + delayMs / 1000;
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
    g.gain.exponentialRampToValueAtTime(gain * (bus === 'ui' ? profile.level : 1), t + attackMs / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(filter).connect(g);
    connectOut(a, g, opts.wet);
    src.start(t, Math.random() * 0.5);
    src.stop(end + 0.02);
}

/** A key: filtered noise burst. The profile picks a dry tick, a low relay clack or a soft tap. */
function click()
{
    switch (profile.keyStyle)
    {
        case 'relay':
            noise('bandpass', 900 + Math.random() * 500, 400, 1, 40, 0.5);
            beep(110 + Math.random() * 30, 45, 'sine', 0.2, 0, 70);
            break;
        case 'soft':
            noise('lowpass', 1500 + Math.random() * 600, 500, 1, 30, 0.22);
            break;
        default:
            noise('bandpass', 1800 + Math.random() * 1200, 900, 1, 35, 0.5);
    }
}

/** A relay closing: a sharp tick over a low knock. */
function relay()
{
    noise('bandpass', 2200, 700, 1, 30, 0.35);
    beep(130, 60, 'sine', 0.25, 0, 70);
}

const SOUNDS: Record<SfxName, () => void> = {
    key: click,
    select: () => beep(1200, 40, 'square', 0.12),
    back: () => beep(700, 50, 'square', 0.12, 0, 450),
    alert: () => { for (let i = 0; i < 3; i++) beep(1500, 120, 'square', 0.15, i * 220); },
    ping: () => beep(1900, 160, 'sine', 0.2, 0, 1400, { wet: 0.3 }),
    // teletype chirp while MOTHER's answer streams in
    tick: () => beep(2200 + Math.random() * 600, 14, 'square', 0.06),

    // interface events
    open: () => { relay(); beep(520, 50, 'square', 0.09, 20); beep(880, 70, 'square', 0.09, 70); },
    close: () => { beep(880, 50, 'square', 0.09); beep(520, 70, 'square', 0.09, 50); },
    tab: () => { noise('bandpass', 1600, 500, 1, 28, 0.3); beep(1000, 30, 'square', 0.08, 10); },
    minimize: () => beep(800, 70, 'square', 0.1, 0, 380),
    error: () => { beep(190, 140, 'sawtooth', 0.14); beep(150, 220, 'sawtooth', 0.14, 160); },
    deny: () => { beep(220, 90, 'sawtooth', 0.12); beep(165, 140, 'sawtooth', 0.12, 110); },
    confirm: () => { beep(880, 50, 'square', 0.1); beep(1320, 90, 'square', 0.1, 60); },
    toggleOn: () => { beep(900, 35, 'square', 0.1); beep(1400, 45, 'square', 0.1, 40); },
    toggleOff: () => { beep(1400, 35, 'square', 0.1); beep(900, 45, 'square', 0.1, 40); },
    relay,

    // notifications: a two-note ping, a ringing double for a call, a low pair for the system
    notify: () => { beep(1320, 110, 'sine', 0.2, 0, 1320, { wet: 0.35 }); beep(1760, 190, 'sine', 0.2, 120, 1760, { wet: 0.35 }); },
    notifyCall: () => { for (let i = 0; i < 4; i++) beep(i % 2 ? 1480 : 1180, 130, 'sine', 0.2, i * 150, i % 2 ? 1480 : 1180, { wet: 0.25 }); },
    notifySys: () => { beep(660, 120, 'sine', 0.2, 0, 660, { wet: 0.3 }); beep(495, 220, 'sine', 0.2, 140, 495, { wet: 0.3 }); },

    // the tube: boot, power off and on, a low thump when it is degaussed, the ship's klaxon for alerts, a burst of data
    boot: () =>
    {
        beep(90, 700, 'sawtooth', 0.07, 0, 520, { attack: 0.2, wet: 0.4 });
        relay();
        for (let i = 0; i < 5; i++) beep(900 + (i % 4) * 330, 45, 'square', 0.05, 420 + i * 90);
    },
    powerOff: () => { beep(1100, 380, 'sine', 0.22, 0, 40); noise('highpass', 3000, 900, 2, 160, 0.18); },
    powerOn: () => { beep(45, 320, 'sine', 0.3, 0, 480, { attack: 0.03 }); noise('highpass', 800, 4000, 20, 220, 0.14); },
    thunk: () => { beep(60, 380, 'sine', 0.5, 0, 32, { wet: 0.2 }); noise('lowpass', 300, 70, 4, 260, 0.45); },
    klaxon: () => { for (let i = 0; i < 4; i++) beep(i % 2 ? 330 : 440, 200, 'square', 0.12, i * 230, i % 2 ? 330 : 440, { wet: 0.2 }); },
    chirp: () =>
    {
        const count = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) beep(900 + Math.floor(Math.random() * 8) * 220, 50, 'square', 0.04, i * 70);
    },

    // AISLAMIENTO: a boot on the deck plating, a pressure door, the creature breathing, the end, the ducts
    step: () =>
    {
        noise('lowpass', 220 + Math.random() * 90, 100, 4, 100, 0.5);
        noise('bandpass', 1400 + Math.random() * 600, 600, 1, 18, 0.12);
    },
    door: () =>
    {
        beep(85, 300, 'sawtooth', 0.05, 0, 140, { attack: 0.08, wet: 0.3 });
        noise('bandpass', 1400, 260, 20, 520, 0.35, 60, { wet: 0.3 });
        beep(90, 260, 'square', 0.07, 400);
        noise('lowpass', 300, 80, 2, 140, 0.4, 420);
    },
    hiss: () => noise('highpass', 2600, 5200, 380, 1100, 0.18, 0, { wet: 0.3 }),
    // something heavy moving in the ducts
    vent: () => { for (let i = 0; i < 4; i++) beep(55 + Math.random() * 30, 110, 'square', 0.07, i * 170 + Math.random() * 60, 40, { wet: 0.5 }); },
    // the flamethrower: a roar that opens up, with a low thump under it
    flame: () => { noise('lowpass', 500, 2400, 60, 700, 0.42, 0, { wet: 0.2 }); beep(70, 300, 'square', 0.08); },
    // a decoy rattling on the plating
    clatter: () => { for (let i = 0; i < 4; i++) beep(900 + Math.random() * 900, 25, 'square', 0.07, i * 55 + Math.random() * 30, 600, { wet: 0.4 }); },

    // MARINES: a burst round from the pulse rifle, a magazine out / in / bolt, a blow taken, a creature falling, a dry trigger
    pulse: () => { noise('bandpass', 2600, 900, 2, 45, 0.3, 0, { wet: 0.2 }); beep(150, 45, 'square', 0.07, 0, 60); noise('lowpass', 500, 120, 2, 80, 0.2); },
    reload: () =>
    {
        beep(480, 30, 'square', 0.1); noise('bandpass', 2400, 1200, 1, 25, 0.18);
        beep(320, 40, 'square', 0.1, 60, 260); noise('lowpass', 600, 200, 2, 60, 0.2, 60);
        beep(700, 30, 'square', 0.1, 900); noise('bandpass', 3000, 1500, 1, 20, 0.2, 900);
        beep(520, 50, 'square', 0.12, 1450, 420); noise('bandpass', 1800, 600, 1, 35, 0.25, 1450);
    },
    hurt: () => { noise('lowpass', 420, 90, 4, 230, 0.55); beep(110, 200, 'sawtooth', 0.12, 0, 50); },
    kill: () => { noise('highpass', 3200, 700, 8, 280, 0.2, 0, { wet: 0.3 }); beep(1100, 240, 'sawtooth', 0.07, 0, 220); },
    dry: () => { beep(260, 25, 'square', 0.1); noise('bandpass', 2000, 900, 1, 15, 0.15); },
    // the extra weapons: a shotgun blast with its pump, the smartgun's fast chatter, a lick of flame, the launcher's thump and the burst
    shotgun: () =>
    {
        noise('lowpass', 1400, 180, 2, 230, 0.8, 0, { wet: 0.35 });
        beep(90, 170, 'sawtooth', 0.16, 0, 40);
        beep(300, 30, 'square', 0.08, 330, 220); noise('bandpass', 1800, 800, 1, 20, 0.2, 330);
        beep(220, 40, 'square', 0.08, 430, 330); noise('bandpass', 1400, 600, 1, 25, 0.22, 430);
    },
    smart: () => { noise('bandpass', 3400, 1500, 2, 30, 0.2); beep(210, 30, 'square', 0.05, 0, 120); },
    burn: () => noise('lowpass', 900, 2000, 12, 110, 0.26),
    launch: () => { beep(130, 160, 'square', 0.16, 0, 45); noise('lowpass', 800, 200, 3, 130, 0.4, 0, { wet: 0.2 }); },
    blast: () => { noise('lowpass', 1800, 70, 3, 650, 0.9, 0, { wet: 0.5 }); beep(65, 420, 'sawtooth', 0.2, 0, 28); beep(40, 600, 'sine', 0.3, 0, 24); },
    // acid on the floor and on the armour
    acid: () => { noise('highpass', 4200, 6500, 20, 170, 0.15); beep(1700, 60, 'sawtooth', 0.04, 0, 900); },
    // a marine's rifle, heard a little way off
    rattle: () => noise('bandpass', 1800, 700, 2, 35, 0.11, 0, { wet: 0.4 }),
    screech: () =>
    {
        const vib = () => 1 + (Math.random() - 0.5) * 0.04;
        beep(700, 900, 'sawtooth', 0.14, 0, 2600 * vib(), { wet: 0.4 });
        beep(520, 900, 'sawtooth', 0.1, 40, 1900 * vib(), { wet: 0.4 });
        noise('bandpass', 3000, 900, 30, 1000, 0.3, 0, { wet: 0.4 });
    },
};

export function playSfx(name: SfxName)
{
    bus = busOf(name);
    soundGain = currentGain(name);
    if (soundGain === 0) return;
    if (bus === 'ui' && !profileAllows(profile, name)) return;
    SOUNDS[name]();
}
