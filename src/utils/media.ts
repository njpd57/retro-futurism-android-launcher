import type { BridgeMediaSession } from '@/types/bridge-fork';

/** The session position is a snapshot: while playing, extrapolate from `positionUpdatedAt`, clamped to the duration. */
export function mediaPosition(s: BridgeMediaSession, now: number)
{
    if (s.state !== 'playing') return Math.min(s.positionMs, s.durationMs || s.positionMs);

    const position = s.positionMs + (now - s.positionUpdatedAt) * s.playbackSpeed;
    return Math.max(0, s.durationMs > 0 ? Math.min(s.durationMs, position) : position);
}

/** `m:ss` */
export function formatMediaTime(ms: number)
{
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ---- UNIDAD DE CINTA: the tape-unit skin of the media widget ----

/** `0347 / 1200`: elapsed and total seconds, four digits each (capped at 9999); `---- / ----` when the length is unknown. */
export function tapeCounter(positionMs: number, durationMs: number)
{
    const four = (ms: number) => String(Math.min(9999, Math.max(0, Math.floor(ms / 1000)))).padStart(4, '0');
    return `${four(positionMs)} / ${durationMs > 0 ? four(durationMs) : '----'}`;
}

const SPOKES = ['|', '/', '-', '\\'];

/** A reel `( | )`. It turns through four frames while the tape runs and shows a hub `( ◉ )` when stopped. */
export function reelGlyph(frame: number, running: boolean)
{
    return `( ${running ? SPOKES[((Math.floor(frame) % 4) + 4) % 4] : '◉'} )`;
}

/** The tape between the reels: `═─` shifting one step per frame while it runs, still when it does not. */
export function tapeRun(frame: number, running: boolean, width: number)
{
    const w = Math.max(0, Math.floor(width));
    const shift = running ? ((Math.floor(frame) % 2) + 2) % 2 : 0;
    return Array.from({ length: w }, (_, i) => (i + shift) % 2 === 0 ? '═' : '─').join('');
}

/** Spanish status of the unit for a session state. */
export function tapeStatus(state: BridgeMediaSession['state'])
{
    switch (state)
    {
        case 'playing': return 'REPRODUCIENDO';
        case 'buffering': return 'CARGANDO CINTA';
        case 'paused': return 'EN PAUSA';
        default: return 'DETENIDA';
    }
}

/** `02` from a widget id such as `media-2` (the instance number), so each unit has its own label. */
export function tapeUnit(id: string)
{
    const n = Number(id.match(/(\d+)$/)?.[1] ?? 1);
    return String(Number.isFinite(n) ? n % 100 : 1).padStart(2, '0');
}
