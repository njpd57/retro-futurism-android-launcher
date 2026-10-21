import type { Bus } from './context';
import type { SfxName } from './sfx';

/** Every sound the user can set by itself: the channel it belongs to and its name in the mixer. */
export interface MixSound { id: string; bus: Bus; label: string }

/** The ambient layers. The first three run all the time; the others are one-shots scattered over the hum. */
export type AmbientLayer = 'ambHum' | 'ambAir' | 'ambHiss' | 'ambData' | 'ambRelay' | 'ambPing';

const SFX_LABELS: Record<SfxName, [Bus, string]> = {
    key: ['ui', 'TECLA'], select: ['ui', 'PULSACIÓN'], back: ['ui', 'ATRÁS'], tab: ['ui', 'PESTAÑA'],
    open: ['ui', 'ABRIR'], close: ['ui', 'CERRAR'], minimize: ['ui', 'MINIMIZAR'],
    toggleOn: ['ui', 'ACTIVAR'], toggleOff: ['ui', 'DESACTIVAR'], confirm: ['ui', 'CONFIRMAR'], deny: ['ui', 'DENEGAR'], error: ['ui', 'ERROR'],
    alert: ['ui', 'ALERTA'], klaxon: ['ui', 'KLAXON'], ping: ['ui', 'PING'], tick: ['ui', 'TIC'], thunk: ['ui', 'GOLPE'], chirp: ['ui', 'CHIRRIDO'], relay: ['ui', 'RELÉ'],
    notify: ['ui', 'AVISO'], notifyCall: ['ui', 'LLAMADA'], notifySys: ['ui', 'SISTEMA'],
    boot: ['ui', 'ARRANQUE'], powerOff: ['ui', 'APAGADO'], powerOn: ['ui', 'ENCENDIDO'],
    step: ['game', 'PASOS'], door: ['game', 'PUERTA'], hiss: ['game', 'SILBIDO'], screech: ['game', 'CHILLIDO'], vent: ['game', 'CONDUCTO'],
    flame: ['game', 'LLAMAS'], clatter: ['game', 'ESTRUENDO'], pulse: ['game', 'PULSO'], reload: ['game', 'RECARGA'], hurt: ['game', 'DAÑO'],
    kill: ['game', 'BAJA'], dry: ['game', 'SIN MUNICIÓN'], shotgun: ['game', 'ESCOPETA'], smart: ['game', 'FUSIL INTELIGENTE'], burn: ['game', 'QUEMADURA'],
    launch: ['game', 'LANZAMIENTO'], blast: ['game', 'EXPLOSIÓN'], acid: ['game', 'ÁCIDO'], rattle: ['game', 'TRACTEO'],
};

const AMBIENT_LABELS: Record<AmbientLayer, string> = {
    ambHum: 'ZUMBIDO', ambAir: 'AIRE DE CONDUCTOS', ambHiss: 'SISEO', ambData: 'RÁFAGAS DE DATOS', ambRelay: 'RELÉ LEJANO', ambPing: 'PING DE SENSOR',
};

export const SOUND_CATALOG: readonly MixSound[] = [
    ...(Object.entries(SFX_LABELS) as [SfxName, [Bus, string]][]).map(([id, [bus, label]]) => ({ id, bus, label })),
    ...(Object.entries(AMBIENT_LABELS) as [AmbientLayer, string][]).map(([id, label]) => ({ id, bus: 'ambient' as Bus, label })),
];

/** The layers that cannot be previewed: they are heard live while the ambient runs. */
export const CONTINUOUS_LAYERS: readonly string[] = ['ambHum', 'ambAir', 'ambHiss'];

export const soundsOf = (bus: Bus) => SOUND_CATALOG.filter(s => s.bus === bus);

/** A sound's share of its designed level: 1 = as designed, up to MIX_MAX to lift it. */
export const MIX_MAX = 1.5;

export type Mix = Readonly<Record<string, number>>;

const KNOWN = new Set(SOUND_CATALOG.map(s => s.id));

/** A stored mix cleaned up: unknown ids and non-numbers dropped, values clamped, 1 (the default) not kept. */
export function normalizeMix(raw: unknown): Mix
{
    const out: Record<string, number> = {};
    if (typeof raw !== 'object' || raw === null) return out;
    for (const [id, v] of Object.entries(raw))
    {
        if (!KNOWN.has(id) || typeof v !== 'number' || !Number.isFinite(v)) continue;
        const g = Math.min(MIX_MAX, Math.max(0, v));
        if (g !== 1) out[id] = g;
    }
    return out;
}

export const gainOf = (mix: Mix, id: string) => mix[id] ?? 1;

/** `mix` with one sound set; 1 removes it so the stored object only holds what differs. */
export function withGain(mix: Mix, id: string, g: number): Mix
{
    const { [id]: _drop, ...rest } = mix;
    const v = Math.min(MIX_MAX, Math.max(0, g));
    return v === 1 ? rest : { ...rest, [id]: v };
}

/** `mix` without the sounds of one channel. */
export function withoutBus(mix: Mix, bus: Bus): Mix
{
    const ids = new Set(soundsOf(bus).map(s => s.id));
    return Object.fromEntries(Object.entries(mix).filter(([id]) => !ids.has(id)));
}

// the mix the synthesizers read (the sound store keeps it in step with the settings)
let current: Mix = {};
export const setMix = (m: Mix) => { current = m; };
export const currentGain = (id: string) => gainOf(current, id);
