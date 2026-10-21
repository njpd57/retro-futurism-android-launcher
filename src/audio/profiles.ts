/** How the interface sounds: the timbre of the UI bus. Pure data, so it is testable; `sfx.ts` and `ambient.ts` read it. */
export type SoundProfileId = 'terminal' | 'rele' | 'suave' | 'minimo';

export type KeyStyle = 'noise' | 'relay' | 'soft';

export interface SoundProfile
{
    id: SoundProfileId;
    label: string;
    /** Replaces the square wave of the UI beeps; null keeps what each sound asks for. */
    wave: OscillatorType | null;
    /** Multiplier of every UI pitch. */
    pitch: number;
    /** Low-pass cutoff in Hz for UI beeps; 0 = none. */
    cutoff: number;
    /** Multiplier of the UI gain. */
    level: number;
    keyStyle: KeyStyle;
    /** Share of the ambient layers, 0..1. */
    ambient: number;
    /** When set, only these UI sounds play (alerts always do). */
    only: readonly string[] | null;
}

export const PROFILES: Record<SoundProfileId, SoundProfile> = {
    terminal: { id: 'terminal', label: 'TERMINAL', wave: null, pitch: 1, cutoff: 0, level: 1, keyStyle: 'noise', ambient: 1, only: null },
    rele: { id: 'rele', label: 'RELÉ', wave: 'triangle', pitch: 0.7, cutoff: 3200, level: 1.1, keyStyle: 'relay', ambient: 1, only: null },
    suave: { id: 'suave', label: 'SUAVE', wave: 'sine', pitch: 0.9, cutoff: 1800, level: 0.8, keyStyle: 'soft', ambient: 0.7, only: null },
    minimo: { id: 'minimo', label: 'MÍNIMO', wave: null, pitch: 1, cutoff: 0, level: 0.8, keyStyle: 'soft', ambient: 0.4, only: ['key', 'select'] },
};

export const PROFILE_IDS = Object.keys(PROFILES) as SoundProfileId[];

/** Sounds that must always be heard, whatever the profile: they carry information. */
export const ALWAYS_AUDIBLE: readonly string[] = ['alert', 'klaxon', 'error', 'deny', 'notify', 'notifyCall', 'notifySys'];

/** The profile for a stored id; anything unknown falls back to TERMINAL. */
export function profileOf(id: unknown): SoundProfile
{
    return typeof id === 'string' && id in PROFILES ? PROFILES[id as SoundProfileId] : PROFILES.terminal;
}

export function profileAllows(profile: SoundProfile, name: string): boolean
{
    return !profile.only || profile.only.includes(name) || ALWAYS_AUDIBLE.includes(name);
}
