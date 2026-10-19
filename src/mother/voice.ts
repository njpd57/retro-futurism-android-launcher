export const VOICE_PITCH = 0.5;
export const VOICE_RATE = 0.8;
export const VOICE_LANG = 'es-ES';

export interface VoiceInfo
{
    lang: string;
    name: string;
}

/** What the phone can do for speech right now. */
export interface VoiceProbe
{
    /** `speechSynthesis` and `SpeechSynthesisUtterance` exist in the WebView */
    webApi: boolean;
    webVoices: readonly VoiceInfo[];
    /** the fork exposes `requestSpeak` */
    bridgeApi: boolean;
    /** the Android text-to-speech engine has bound */
    bridgeReady: boolean;
}

export type VoiceStatus = 'ok' | 'no-api' | 'no-voices' | 'no-spanish';
export type VoiceEngine = 'web' | 'bridge' | 'none';

export const isSpanish = (v: VoiceInfo) => v.lang.toLowerCase().replace('_', '-').startsWith('es');

/** Which engine will speak and, if none, why not. The WebView's own Spanish voice wins; Bridge's engine is the fallback. */
export function voiceStatus(p: VoiceProbe): { engine: VoiceEngine; status: VoiceStatus }
{
    if (p.webApi && p.webVoices.some(isSpanish)) return { engine: 'web', status: 'ok' };
    if (p.bridgeApi && p.bridgeReady) return { engine: 'bridge', status: 'ok' };
    if (p.webApi && p.webVoices.length) return { engine: 'none', status: 'no-spanish' };
    if (p.webApi || p.bridgeApi) return { engine: 'none', status: 'no-voices' };
    return { engine: 'none', status: 'no-api' };
}

/** Best voice for Spanish: `es-ES` first, then any `es-*`; null when there is none. */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[]): T | null
{
    return voices.find(v => v.lang.toLowerCase().replace('_', '-') === 'es-es') ?? voices.find(isSpanish) ?? null;
}

export const VOICE_MESSAGES: Record<VoiceStatus, string> = {
    ok: 'VOZ LISTA',
    'no-api': 'SIN MOTOR DE VOZ EN ESTE WEBVIEW',
    'no-voices': 'SIN VOCES INSTALADAS',
    'no-spanish': 'SIN VOZ EN ESPAÑOL',
};

/** Text to read aloud: no glyphs of the interface, no speaker prefix, single spaces. */
export function speakable(text: string)
{
    return text
        .replace(/^MOTHER:\s*/i, '')
        .replace(/[█▓░▁▂▃▄▅▆▇»›·]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
