export const VOICE_PITCH = 0.5;
export const VOICE_RATE = 0.8;
export const VOICE_LANG = 'es-ES';

export const canSpeak = (w: { speechSynthesis?: unknown } | undefined = typeof window === 'undefined' ? undefined : window) => !!w?.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';

/** Text to read aloud: no glyphs of the interface, no speaker prefix, single spaces. */
export function speakable(text: string)
{
    return text
        .replace(/^MOTHER:\s*/i, '')
        .replace(/[█▓░▁▂▃▄▅▆▇»›·]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
