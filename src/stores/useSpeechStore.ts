import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { pickVoice, speakable, voiceStatus, VOICE_LANG, VOICE_MESSAGES, VOICE_PITCH, VOICE_RATE, type VoiceInfo } from "@/mother/voice";
import { bridgeHas } from "@/utils/bridgeHas";
import { useBridgeEventStore } from "./useBridgeEventStore";

const webApi = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';

/**
 * Speech output. Uses the WebView's `speechSynthesis` when it has a Spanish voice and otherwise Android's
 * text-to-speech through the fork. Speech has no runtime permission: what can be missing is an engine or a voice.
 */
export const useSpeechStore = defineStore('speech', () =>
{
    const bridgeEvents = useBridgeEventStore();

    const webVoices = ref<(VoiceInfo & { raw: SpeechSynthesisVoice })[]>([]);
    const bridgeReady = ref(false);
    const hasBridge = bridgeHas('requestSpeak') && bridgeHas('getTtsAvailable');

    function refresh()
    {
        if (webApi())
            webVoices.value = window.speechSynthesis.getVoices().map(v => ({ lang: v.lang, name: v.name, raw: v }));
        if (hasBridge) bridgeReady.value = Bridge.getTtsAvailable();
    }

    refresh();
    if (webApi()) window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
    // the Android engine binds a moment after the first call: look again a couple of times
    if (hasBridge) for (const ms of [800, 2500]) window.setTimeout(refresh, ms);
    bridgeEvents.addEventListener(ev => { if (ev.name === 'afterResume') refresh(); });

    const state = computed(() => voiceStatus({ webApi: webApi(), webVoices: webVoices.value, bridgeApi: hasBridge, bridgeReady: bridgeReady.value }));
    const engine = computed(() => state.value.engine);
    const status = computed(() => state.value.status);
    const available = computed(() => status.value === 'ok');
    const message = computed(() => `${VOICE_MESSAGES[status.value]}${engine.value === 'none' ? '' : engine.value === 'web' ? ' · WEBVIEW' : ' · ANDROID'}`);

    function stop()
    {
        if (webApi()) window.speechSynthesis.cancel();
        if (hasBridge) Bridge.requestStopSpeaking();
    }

    /** Speaks `text` (interface glyphs removed). False when nothing could speak. */
    function speak(text: string): boolean
    {
        const clean = speakable(text);
        if (!clean || !available.value) return false;
        stop();

        if (engine.value === 'web')
        {
            const u = new SpeechSynthesisUtterance(clean);
            const voice = pickVoice(webVoices.value);
            if (voice) u.voice = voice.raw;
            u.lang = voice?.lang ?? VOICE_LANG;
            u.pitch = VOICE_PITCH;
            u.rate = VOICE_RATE;
            window.speechSynthesis.speak(u);
            return true;
        }
        return Bridge.requestSpeak(clean, VOICE_LANG, VOICE_PITCH, VOICE_RATE);
    }

    function openSettings(): boolean
    {
        return bridgeHas('requestOpenTtsSettings') ? Bridge.requestOpenTtsSettings() : false;
    }

    return { status, engine, available, message, canOpenSettings: bridgeHas('requestOpenTtsSettings'), refresh, speak, stop, openSettings };
});
